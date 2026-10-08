import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { NotificationService } from '../services/notificationService.js';
const router = Router();
// GET /api/notifications
router.get('/', requireAuth, (req, res) => {
    try {
        const userId = req.user.userId;
        const notifications = NotificationService.getUserNotifications(userId);
        const unreadCount = NotificationService.getUnreadCount(userId);
        res.json({
            notifications,
            unreadCount
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve notifications.' });
    }
});
// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        const userId = req.user.userId;
        const success = NotificationService.markAsRead(notificationId, userId);
        if (!success) {
            res.status(404).json({ error: 'Notification not found or unauthorized.' });
            return;
        }
        const unreadCount = NotificationService.getUnreadCount(userId);
        res.json({ success: true, unreadCount });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update notification.' });
    }
});
// POST /api/notifications/mark-all-read
router.post('/mark-all-read', requireAuth, (req, res) => {
    try {
        const userId = req.user.userId;
        NotificationService.markAllAsRead(userId);
        res.json({
            success: true,
            unreadCount: 0
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to mark notifications as read.' });
    }
});
// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        const userId = req.user.userId;
        const success = NotificationService.deleteNotification(notificationId, userId);
        if (!success) {
            res.status(404).json({ error: 'Notification not found or unauthorized.' });
            return;
        }
        const unreadCount = NotificationService.getUnreadCount(userId);
        res.json({ success: true, unreadCount });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete notification.' });
    }
});
export default router;
