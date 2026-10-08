import { db } from '../db/database.js';
import { Notification } from '../types/index.js';

export class NotificationService {
  static createNotification(data: {
    userId: number;
    issueId?: number | null;
    issueCode?: string | null;
    title: string;
    message: string;
    type?: string;
  }): Notification {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, issue_id, issue_code, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
      data.userId,
      data.issueId ?? null,
      data.issueCode ?? null,
      data.title,
      data.message,
      data.type || 'status_change'
    );

    const getStmt = db.prepare('SELECT * FROM notifications WHERE id = ?');
    return getStmt.get(result.lastInsertRowid) as unknown as Notification;
  }

  static getUserNotifications(userId: number, limit: number = 50): Notification[] {
    const stmt = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(userId, limit) as unknown as Notification[];
  }

  static getUnreadCount(userId: number): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = ? AND is_read = 0
    `);
    const row = stmt.get(userId) as { count: number };
    return row?.count || 0;
  }

  static markAsRead(notificationId: number, userId: number): boolean {
    const stmt = db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE id = ? AND user_id = ?
    `);
    const result = stmt.run(notificationId, userId);
    return Number(result.changes) > 0;
  }

  static markAllAsRead(userId: number): number {
    const stmt = db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND is_read = 0
    `);
    const result = stmt.run(userId);
    return Number(result.changes);
  }

  static notifyAdmins(data: {
    issueId?: number | null;
    issueCode?: string | null;
    title: string;
    message: string;
    type?: string;
  }): void {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all() as { id: number }[];
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

  static deleteNotification(notificationId: number, userId: number): boolean {
    const stmt = db.prepare(`
      DELETE FROM notifications 
      WHERE id = ? AND user_id = ?
    `);
    const result = stmt.run(notificationId, userId);
    return Number(result.changes) > 0;
  }
}
