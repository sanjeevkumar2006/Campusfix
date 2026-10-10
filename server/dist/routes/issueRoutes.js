import { Router } from 'express';
import fs from 'node:fs';
import { db } from '../db/database.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { NotificationService } from '../services/notificationService.js';
import { cleanupExpiredDuplicateConfirmations, createDuplicateConfirmation, consumeDuplicateConfirmation, findPotentialDuplicates, parseDuplicateCandidate } from '../services/duplicateDetectionService.js';
const router = Router();
// Helper to generate next issue code
function generateIssueCode() {
    const lastRow = db.prepare('SELECT id FROM issues ORDER BY id DESC LIMIT 1').get();
    const nextId = (lastRow?.id || 0) + 1;
    return `CF-${1000 + nextId}`;
}
// POST /api/issues/check-duplicates - Check for unresolved reports before submission
router.post('/check-duplicates', requireAuth, (req, res) => {
    try {
        const parsed = parseDuplicateCandidate(req.body);
        if (!parsed.candidate) {
            res.status(400).json({ error: parsed.error });
            return;
        }
        cleanupExpiredDuplicateConfirmations(db);
        const result = findPotentialDuplicates(db, parsed.candidate);
        const confirmationToken = result.matches.length > 0
            ? createDuplicateConfirmation(db, parsed.candidate, req.user.userId, result.matchIds)
            : undefined;
        res.json({
            potentialMatches: result.matches,
            ...(confirmationToken ? { confirmationToken } : {})
        });
    }
    catch (err) {
        console.error('Duplicate issue check error:', err);
        res.status(500).json({ error: 'Failed to check for similar campus reports.' });
    }
});
// POST /api/issues - Submit a new issue
router.post('/', requireAuth, upload.single('image'), (req, res) => {
    let transactionStarted = false;
    try {
        const studentId = req.user.userId;
        const parsed = parseDuplicateCandidate(req.body);
        if (!parsed.candidate) {
            res.status(400).json({ error: parsed.error });
            return;
        }
        const candidate = parsed.candidate;
        const { priority, ai_detected_category, ai_confidence, existing_image_url, additional_info } = req.body;
        let imageUrl = existing_image_url;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }
        if (!imageUrl) {
            res.status(400).json({ error: 'Please capture or upload a photo of the campus issue.' });
            return;
        }
        db.exec('BEGIN IMMEDIATE');
        transactionStarted = true;
        cleanupExpiredDuplicateConfirmations(db);
        const duplicateCheck = findPotentialDuplicates(db, candidate);
        if (duplicateCheck.matches.length > 0) {
            const confirmed = consumeDuplicateConfirmation(db, req.body.duplicate_confirmation_token, candidate, studentId, duplicateCheck.matchIds);
            if (!confirmed) {
                db.exec('ROLLBACK');
                transactionStarted = false;
                if (req.file) {
                    try {
                        fs.unlinkSync(req.file.path);
                    }
                    catch (err) {
                        console.error('Failed to remove unsubmitted duplicate report image:', err);
                    }
                }
                res.status(409).json({
                    error: 'A similar issue may already have been reported. Review the potential matches before continuing.',
                    potentialMatches: duplicateCheck.matches
                });
                return;
            }
        }
        const issueCode = generateIssueCode();
        const issuePriority = ['low', 'medium', 'high', 'critical'].includes(priority)
            ? priority
            : 'medium';
        const conf = ai_confidence ? parseFloat(ai_confidence) : null;
        const stmt = db.prepare(`
      INSERT INTO issues (
        issue_code, student_id, category, title, description, image_url,
        ai_detected_category, ai_confidence, priority, location_name,
        latitude, longitude, additional_info, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
        const result = stmt.run(issueCode, studentId, candidate.category, candidate.title, candidate.description, imageUrl, ai_detected_category || null, conf, issuePriority, candidate.location_name, candidate.latitude, candidate.longitude, additional_info?.trim() || null);
        const issueId = Number(result.lastInsertRowid);
        // Add initial entry to issue_updates timeline
        db.prepare(`
      INSERT INTO issue_updates (issue_id, user_id, action, new_status, notes, created_at)
      VALUES (?, ?, 'created', 'pending', 'Issue reported by student', CURRENT_TIMESTAMP)
    `).run(issueId, studentId);
        // Send confirmation notification to student
        NotificationService.createNotification({
            userId: studentId,
            issueId,
            issueCode,
            title: 'Issue Submitted',
            message: `Your issue #${issueCode} has been received and logged into CampusFix.`,
            type: 'status_change'
        });
        // Notify administrators of new issue or critical hazard
        const isCritical = issuePriority === 'critical';
        NotificationService.notifyAdmins({
            issueId,
            issueCode,
            title: isCritical ? '🚨 Critical Hazard Reported' : 'New Issue Reported',
            message: `${isCritical ? 'CRITICAL: ' : ''}Issue #${issueCode} (${candidate.category}): "${candidate.title}" reported at ${candidate.location_name}`,
            type: isCritical ? 'system' : 'status_change'
        });
        const newIssue = db.prepare(`
      SELECT i.*, u.full_name as student_name, u.email as student_email
      FROM issues i
      JOIN users u ON i.student_id = u.id
      WHERE i.id = ?
    `).get(issueId);
        db.exec('COMMIT');
        transactionStarted = false;
        res.status(201).json({
            message: 'Issue reported successfully!',
            issue: newIssue
        });
    }
    catch (err) {
        if (transactionStarted) {
            try {
                db.exec('ROLLBACK');
            }
            catch (rollbackError) {
                console.error('Issue creation rollback error:', rollbackError);
            }
        }
        console.error('Issue creation error:', err);
        res.status(500).json({ error: 'Failed to create issue. Please check all fields.' });
    }
});
// GET /api/issues - List issues with rich filtering, search, and sorting
router.get('/', requireAuth, (req, res) => {
    try {
        const { status, priority, category, location, student_id, search, sort } = req.query;
        const isAdmin = req.user.role === 'admin';
        let query = `
      SELECT i.*${isAdmin ? `,
        u.full_name as student_name,
        u.email as student_email,
        a.full_name as assigned_name` : ''}
      FROM issues i
      JOIN users u ON i.student_id = u.id
      LEFT JOIN users a ON i.assigned_to = a.id
      WHERE 1=1
    `;
        const params = [];
        if (!isAdmin) {
            query += ` AND i.student_id = ?`;
            params.push(req.user.userId);
        }
        else if (student_id) {
            query += ` AND i.student_id = ?`;
            params.push(Number(student_id));
        }
        if (status && status !== 'all') {
            query += ` AND i.status = ?`;
            params.push(status);
        }
        if (priority && priority !== 'all') {
            query += ` AND i.priority = ?`;
            params.push(priority);
        }
        if (category && category !== 'all') {
            query += ` AND i.category = ?`;
            params.push(category);
        }
        if (location && location !== 'all') {
            query += ` AND i.location_name = ?`;
            params.push(location);
        }
        if (search && typeof search === 'string' && search.trim() !== '') {
            const term = `%${search.trim().toLowerCase()}%`;
            query += ` AND (
        LOWER(i.issue_code) LIKE ? OR 
        LOWER(i.title) LIKE ? OR 
        LOWER(i.description) LIKE ? OR 
        LOWER(u.full_name) LIKE ? OR 
        LOWER(i.location_name) LIKE ?
      )`;
            params.push(term, term, term, term, term);
        }
        // Sorting
        switch (sort) {
            case 'oldest':
                query += ` ORDER BY i.created_at ASC`;
                break;
            case 'priority':
                query += ` ORDER BY CASE i.priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 END ASC, i.created_at DESC`;
                break;
            case 'status':
                query += ` ORDER BY i.status ASC, i.created_at DESC`;
                break;
            case 'newest':
            default:
                query += ` ORDER BY i.created_at DESC`;
                break;
        }
        const issues = db.prepare(query).all(...params);
        res.json({ issues, total: issues.length });
    }
    catch (err) {
        console.error('Fetch issues error:', err);
        res.status(500).json({ error: 'Failed to fetch issues.' });
    }
});
// GET /api/issues/:id - Detailed issue view with updates timeline
router.get('/:id', requireAuth, (req, res) => {
    try {
        const issueId = Number(req.params.id);
        const isAdmin = req.user.role === 'admin';
        const issue = db.prepare(`
      SELECT i.*${isAdmin ? `,
        u.full_name as student_name,
        u.email as student_email,
        a.full_name as assigned_name` : ''}
      FROM issues i
      JOIN users u ON i.student_id = u.id
      LEFT JOIN users a ON i.assigned_to = a.id
      WHERE i.id = ?${isAdmin ? '' : ' AND i.student_id = ?'}
    `).get(...(isAdmin ? [issueId] : [issueId, req.user.userId]));
        if (!issue) {
            res.status(404).json({ error: 'Issue not found.' });
            return;
        }
        // Load timeline updates
        const updates = db.prepare(`
      SELECT iu.*, u.full_name as user_name, u.role as user_role
      FROM issue_updates iu
      JOIN users u ON iu.user_id = u.id
      WHERE iu.issue_id = ?
      ORDER BY iu.created_at ASC
    `).all(issueId);
        res.json({ issue, updates });
    }
    catch (err) {
        console.error('Get issue details error:', err);
        res.status(500).json({ error: 'Failed to retrieve issue details.' });
    }
});
// PATCH /api/issues/:id/status - Update issue status (Admin only or system)
router.patch('/:id/status', requireAuth, requireAdmin, (req, res) => {
    try {
        const issueId = Number(req.params.id);
        const { status, notes } = req.body;
        const validStatuses = ['pending', 'acknowledged', 'in_progress', 'resolved', 'reopened', 'closed'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ error: 'Invalid status value.' });
            return;
        }
        const currentIssue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
        if (!currentIssue) {
            res.status(404).json({ error: 'Issue not found.' });
            return;
        }
        const oldStatus = currentIssue.status;
        db.prepare(`
      UPDATE issues 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, issueId);
        // Record in timeline
        db.prepare(`
      INSERT INTO issue_updates (issue_id, user_id, action, old_status, new_status, notes, created_at)
      VALUES (?, ?, 'status_change', ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(issueId, req.user.userId, oldStatus, status, notes || `Status updated to ${status}`);
        // Notify student
        const statusMessages = {
            acknowledged: `🔔 Your issue #${currentIssue.issue_code} has been acknowledged by administration.`,
            in_progress: `⚙️ Your issue #${currentIssue.issue_code} is now In Progress. Maintenance crew dispatched.`,
            resolved: `✅ Your issue #${currentIssue.issue_code} has been resolved!`,
            reopened: `🔄 Your issue #${currentIssue.issue_code} has been reopened for further work.`,
            closed: `🔒 Your issue #${currentIssue.issue_code} has been closed.`
        };
        if (statusMessages[status]) {
            NotificationService.createNotification({
                userId: currentIssue.student_id,
                issueId: currentIssue.id,
                issueCode: currentIssue.issue_code,
                title: `Issue ${status.replace('_', ' ').toUpperCase()}`,
                message: statusMessages[status],
                type: status === 'resolved' ? 'resolution' : 'status_change'
            });
        }
        const updatedIssue = db.prepare(`
      SELECT i.*, u.full_name as student_name, u.email as student_email, a.full_name as assigned_name
      FROM issues i
      JOIN users u ON i.student_id = u.id
      LEFT JOIN users a ON i.assigned_to = a.id
      WHERE i.id = ?
    `).get(issueId);
        res.json({ message: 'Status updated successfully', status, issue: updatedIssue });
    }
    catch (err) {
        console.error('Update status error:', err);
        res.status(500).json({ error: 'Failed to update issue status.' });
    }
});
// PATCH /api/issues/:id/priority - Update issue priority (Admin only)
router.patch('/:id/priority', requireAuth, requireAdmin, (req, res) => {
    try {
        const issueId = Number(req.params.id);
        const { priority, notes } = req.body;
        const validPriorities = ['low', 'medium', 'high', 'critical'];
        if (!validPriorities.includes(priority)) {
            res.status(400).json({ error: 'Invalid priority level.' });
            return;
        }
        const currentIssue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
        if (!currentIssue) {
            res.status(404).json({ error: 'Issue not found.' });
            return;
        }
        db.prepare(`
      UPDATE issues 
      SET priority = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(priority, issueId);
        db.prepare(`
      INSERT INTO issue_updates (issue_id, user_id, action, notes, created_at)
      VALUES (?, ?, 'priority_change', ?, CURRENT_TIMESTAMP)
    `).run(issueId, req.user.userId, notes || `Priority adjusted from ${currentIssue.priority} to ${priority}`);
        const updatedIssue = db.prepare(`
      SELECT i.*, u.full_name as student_name, u.email as student_email, a.full_name as assigned_name
      FROM issues i
      JOIN users u ON i.student_id = u.id
      LEFT JOIN users a ON i.assigned_to = a.id
      WHERE i.id = ?
    `).get(issueId);
        res.json({ message: 'Priority updated successfully', priority, issue: updatedIssue });
    }
    catch (err) {
        console.error('Update priority error:', err);
        res.status(500).json({ error: 'Failed to update priority.' });
    }
});
// PATCH /api/issues/:id/category - Update issue category (Admin only)
router.patch('/:id/category', requireAuth, requireAdmin, (req, res) => {
    try {
        const issueId = Number(req.params.id);
        const { category, notes } = req.body;
        if (!category) {
            res.status(400).json({ error: 'Category is required.' });
            return;
        }
        db.prepare(`
      UPDATE issues 
      SET category = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(category, issueId);
        db.prepare(`
      INSERT INTO issue_updates (issue_id, user_id, action, notes, created_at)
      VALUES (?, ?, 'category_change', ?, CURRENT_TIMESTAMP)
    `).run(issueId, req.user.userId, notes || `Category reclassified to ${category}`);
        const updatedIssue = db.prepare(`
      SELECT i.*, u.full_name as student_name, u.email as student_email, a.full_name as assigned_name
      FROM issues i
      JOIN users u ON i.student_id = u.id
      LEFT JOIN users a ON i.assigned_to = a.id
      WHERE i.id = ?
    `).get(issueId);
        res.json({ message: 'Category updated successfully', category, issue: updatedIssue });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update category.' });
    }
});
// PATCH /api/issues/:id/assign - Assign issue to administrator/staff
router.patch('/:id/assign', requireAuth, requireAdmin, (req, res) => {
    try {
        const issueId = Number(req.params.id);
        const { assigned_to, notes } = req.body;
        let targetAdmin;
        if (assigned_to !== null && assigned_to !== undefined && assigned_to !== '') {
            targetAdmin = db.prepare("SELECT id, full_name FROM users WHERE id = ? AND role = 'admin'").get(assigned_to);
            if (!targetAdmin) {
                res.status(400).json({ error: 'Selected administrator not found.' });
                return;
            }
        }
        const currentIssue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
        if (!currentIssue) {
            res.status(404).json({ error: 'Issue not found.' });
            return;
        }
        const assignedId = targetAdmin ? targetAdmin.id : null;
        const assignedName = targetAdmin ? targetAdmin.full_name : 'Unassigned';
        db.prepare(`
      UPDATE issues 
      SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(assignedId, issueId);
        db.prepare(`
      INSERT INTO issue_updates (issue_id, user_id, action, notes, created_at)
      VALUES (?, ?, 'assigned', ?, CURRENT_TIMESTAMP)
    `).run(issueId, req.user.userId, notes || `Assigned to ${assignedName}`);
        if (targetAdmin) {
            // Notify assigned staff
            NotificationService.createNotification({
                userId: targetAdmin.id,
                issueId: currentIssue.id,
                issueCode: currentIssue.issue_code,
                title: 'New Issue Assignment',
                message: `You have been assigned to handle issue #${currentIssue.issue_code}: ${currentIssue.title}.`,
                type: 'assignment'
            });
            // Notify student
            NotificationService.createNotification({
                userId: currentIssue.student_id,
                issueId: currentIssue.id,
                issueCode: currentIssue.issue_code,
                title: 'Issue Assigned',
                message: `Your issue #${currentIssue.issue_code} has been assigned to ${targetAdmin.full_name}.`,
                type: 'assignment'
            });
        }
        const updatedIssue = db.prepare(`
      SELECT i.*, u.full_name as student_name, u.email as student_email, a.full_name as assigned_name
      FROM issues i
      JOIN users u ON i.student_id = u.id
      LEFT JOIN users a ON i.assigned_to = a.id
      WHERE i.id = ?
    `).get(issueId);
        res.json({ message: `Assigned to ${assignedName}`, assigned_name: assignedName, issue: updatedIssue });
    }
    catch (err) {
        console.error('Assign error:', err);
        res.status(500).json({ error: 'Failed to assign issue.' });
    }
});
// POST /api/issues/:id/notes - Add custom note / comment to timeline
router.post('/:id/notes', requireAuth, (req, res) => {
    try {
        const issueId = Number(req.params.id);
        const { notes } = req.body;
        if (!notes || notes.trim() === '') {
            res.status(400).json({ error: 'Note text cannot be empty.' });
            return;
        }
        db.prepare(`
      INSERT INTO issue_updates (issue_id, user_id, action, notes, created_at)
      VALUES (?, ?, 'comment', ?, CURRENT_TIMESTAMP)
    `).run(issueId, req.user.userId, notes.trim());
        res.status(201).json({ message: 'Note added to issue timeline.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to post note.' });
    }
});
// POST /api/issues/:id/resolve - Mark as resolved with resolution notes and photo
router.post('/:id/resolve', requireAuth, requireAdmin, upload.single('resolution_image'), (req, res) => {
    try {
        const issueId = Number(req.params.id);
        const { resolution_notes } = req.body;
        if (!resolution_notes || resolution_notes.trim() === '') {
            res.status(400).json({ error: 'Please describe the resolution details and actions taken.' });
            return;
        }
        const currentIssue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
        if (!currentIssue) {
            res.status(404).json({ error: 'Issue not found.' });
            return;
        }
        let resolutionImageUrl = null;
        if (req.file) {
            resolutionImageUrl = `/uploads/${req.file.filename}`;
        }
        db.prepare(`
      UPDATE issues 
      SET status = 'resolved', 
          resolution_notes = ?, 
          resolution_image_url = COALESCE(?, resolution_image_url), 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(resolution_notes.trim(), resolutionImageUrl, issueId);
        db.prepare(`
      INSERT INTO issue_updates (issue_id, user_id, action, old_status, new_status, notes, created_at)
      VALUES (?, ?, 'resolved', ?, 'resolved', ?, CURRENT_TIMESTAMP)
    `).run(issueId, req.user.userId, currentIssue.status, `Resolved: ${resolution_notes.trim()}`);
        NotificationService.createNotification({
            userId: currentIssue.student_id,
            issueId: currentIssue.id,
            issueCode: currentIssue.issue_code,
            title: 'Issue Resolved',
            message: `✅ Your issue #${currentIssue.issue_code} has been resolved! Check the resolution notes.`,
            type: 'resolution'
        });
        res.json({ message: 'Issue marked as resolved', resolutionImageUrl });
    }
    catch (err) {
        console.error('Resolve error:', err);
        res.status(500).json({ error: 'Failed to resolve issue.' });
    }
});
// POST /api/issues/:id/reopen - Reopen issue
router.post('/:id/reopen', requireAuth, (req, res) => {
    try {
        const issueId = Number(req.params.id);
        const { reason } = req.body;
        const currentIssue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
        if (!currentIssue) {
            res.status(404).json({ error: 'Issue not found.' });
            return;
        }
        // Only student who created the issue or an admin can reopen
        if (req.user.role !== 'admin' && currentIssue.student_id !== req.user.userId) {
            res.status(403).json({ error: 'You are not authorized to reopen this issue.' });
            return;
        }
        const noteText = reason?.trim() || 'Issue reopened by user as problem persists';
        db.prepare(`
      UPDATE issues 
      SET status = 'reopened', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(issueId);
        db.prepare(`
      INSERT INTO issue_updates (issue_id, user_id, action, old_status, new_status, notes, created_at)
      VALUES (?, ?, 'reopened', ?, 'reopened', ?, CURRENT_TIMESTAMP)
    `).run(issueId, req.user.userId, currentIssue.status, noteText);
        // Notify assigned admin or student
        if (currentIssue.assigned_to) {
            NotificationService.createNotification({
                userId: currentIssue.assigned_to,
                issueId: currentIssue.id,
                issueCode: currentIssue.issue_code,
                title: 'Issue Reopened',
                message: `🔄 Issue #${currentIssue.issue_code} was reopened: "${noteText}"`,
                type: 'reopen'
            });
        }
        if (req.user.role === 'admin') {
            NotificationService.createNotification({
                userId: currentIssue.student_id,
                issueId: currentIssue.id,
                issueCode: currentIssue.issue_code,
                title: 'Issue Reopened',
                message: `🔄 Your issue #${currentIssue.issue_code} was reopened by an administrator.`,
                type: 'reopen'
            });
        }
        res.json({ message: 'Issue reopened successfully' });
    }
    catch (err) {
        console.error('Reopen error:', err);
        res.status(500).json({ error: 'Failed to reopen issue.' });
    }
});
export default router;
