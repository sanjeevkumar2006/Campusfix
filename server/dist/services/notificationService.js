import { db } from '../db/database.js';
export class NotificationService {
    static createNotification(data) {
        const stmt = db.prepare(`
      INSERT INTO notifications (user_id, issue_id, issue_code, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);
        const result = stmt.run(data.userId, data.issueId ?? null, data.issueCode ?? null, data.title, data.message, data.type || 'status_change');
        const getStmt = db.prepare('SELECT * FROM notifications WHERE id = ?');
        return getStmt.get(result.lastInsertRowid);
    }
    static getUserNotifications(userId, limit = 50) {
        const stmt = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
        return stmt.all(userId, limit);
    }
    static getUnreadCount(userId) {
        const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = ? AND is_read = 0
    `);
        const row = stmt.get(userId);
        return row?.count || 0;
    }
    static markAsRead(notificationId, userId) {
        const stmt = db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE id = ? AND user_id = ?
    `);
        const result = stmt.run(notificationId, userId);
        return Number(result.changes) > 0;
    }
    static markAllAsRead(userId) {
        const stmt = db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND is_read = 0
    `);
        const result = stmt.run(userId);
        return Number(result.changes);
    }
    static notifyAdmins(data) {
        const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
        for (const admin of admins) {
            this.createNotification({
                userId: admin.id,
                issueId: data.issueId,
                issueCode: data.issueCode,
                title: data.title,
                message: data.message,
                type: data.type || 'system'
            });
        }
    }
    static deleteNotification(notificationId, userId) {
        const stmt = db.prepare(`
      DELETE FROM notifications 
      WHERE id = ? AND user_id = ?
    `);
        const result = stmt.run(notificationId, userId);
        return Number(result.changes) > 0;
    }
}
