import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
const router = Router();
// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, full_name, role, department, phone } = req.body;
        if (!email || !password || !full_name) {
            res.status(400).json({ error: 'Please provide full name, email, and password.' });
            return;
        }
        const emailClean = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
            res.status(400).json({ error: 'Please enter a valid email address.' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters long.' });
            return;
        }
        // Check if user already exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailClean);
        if (existing) {
            res.status(409).json({ error: 'An account with this email already exists.' });
            return;
        }
        const userRole = role === 'admin' ? 'admin' : 'student';
        const passwordHash = await bcrypt.hash(password, 10);
        const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role, department, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(emailClean, passwordHash, full_name.trim(), userRole, department?.trim() || null, phone?.trim() || null);
        const newUser = db.prepare('SELECT id, email, full_name, role, department, phone, avatar, created_at FROM users WHERE id = ?')
            .get(result.lastInsertRowid);
        const token = generateToken({
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role,
            fullName: newUser.full_name
        });
        res.status(201).json({
            message: 'Account registered successfully',
            token,
            user: newUser
        });
    }
    catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Failed to register account. Please try again.' });
    }
});
// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required.' });
            return;
        }
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }
        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            fullName: user.full_name
        });
        const { password_hash, ...safeUser } = user;
        res.json({
            message: 'Login successful',
            token,
            user: safeUser
        });
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'An unexpected error occurred during login.' });
    }
});
// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
    try {
        const user = db.prepare('SELECT id, email, full_name, role, department, phone, avatar, created_at FROM users WHERE id = ?')
            .get(req.user.userId);
        if (!user) {
            res.status(404).json({ error: 'User profile not found.' });
            return;
        }
        res.json({ user });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve profile.' });
    }
});
// PUT /api/auth/profile
router.put('/profile', requireAuth, (req, res) => {
    try {
        const { full_name, department, phone } = req.body;
        if (!full_name || full_name.trim().length === 0) {
            res.status(400).json({ error: 'Full name cannot be empty.' });
            return;
        }
        const stmt = db.prepare(`
      UPDATE users 
      SET full_name = ?, department = ?, phone = ?
      WHERE id = ?
    `);
        stmt.run(full_name.trim(), department?.trim() || null, phone?.trim() || null, req.user.userId);
        const updatedUser = db.prepare('SELECT id, email, full_name, role, department, phone, avatar, created_at FROM users WHERE id = ?')
            .get(req.user.userId);
        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});
// GET /api/auth/admins - retrieve admin list for assignment
router.get('/admins', requireAuth, (_req, res) => {
    try {
        const admins = db.prepare("SELECT id, full_name, email, department FROM users WHERE role = 'admin' ORDER BY full_name ASC").all();
        res.json({ admins });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to load staff list.' });
    }
});
export default router;
