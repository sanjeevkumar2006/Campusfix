import { X, CheckCheck, Bell, ShieldAlert, CheckCircle, ArrowRight, Trash2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import type { Notification } from '../types';

interface NotificationDrawerProps {
  onSelectIssueById: (issueId: number) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ onSelectIssueById }) => {
  const { isDrawerOpen, closeDrawer, notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  if (!isDrawerOpen) return null;

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }
    if (notif.issue_id) {
      onSelectIssueById(notif.issue_id);
      closeDrawer();
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'resolution':
        return <CheckCircle size={18} color="#10b981" />;
      case 'system':
        return <ShieldAlert size={18} color="#ef4444" />;
      case 'status_change':
      default:
        return <Bell size={18} color="#2563eb" />;
    }
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={closeDrawer} />
      <div className="drawer-panel">
        {/* Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={20} color="var(--primary-light)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Notifications</h3>
            {unreadCount > 0 && (
              <span
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={markAllAsRead}
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                title="Mark all as read"
              >
                <CheckCheck size={14} />
                <span>Mark All Read</span>
              </button>
            )}
            <button
              onClick={closeDrawer}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* List Body */}
        <div className="drawer-body">
          {notifications.length === 0 ? (
            <div className="empty-state" style={{ margin: '40px 0', border: 'none' }}>
              <div className="empty-state-icon">
                <Bell size={28} />
              </div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>No Notifications Yet</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                You will be notified here whenever your reported issues change status or receive staff notes.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`notif-item ${notif.is_read ? '' : 'unread'}`}
                onClick={() => handleNotificationClick(notif)}
              >
                <div style={{ marginTop: '2px' }}>{getNotifIcon(notif.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: notif.is_read ? 600 : 700, color: 'var(--text-primary)' }}>
                      {notif.title}
                    </div>
                    {!notif.is_read && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary-light)',
                        }}
                      />
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {notif.message}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>{new Date(notif.created_at).toLocaleString()}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {notif.issue_id && (
                        <span style={{ color: 'var(--primary-light)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <span>View Issue</span>
                          <ArrowRight size={10} />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif.id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '2px 4px'
                        }}
                        title="Delete notification"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
