import { 
  Building2, 
  MapPin, 
  PlusCircle, 
  BarChart3, 
  Bell, 
  LogOut, 
  User as UserIcon, 
  Compass, 
  ArrowRightLeft,
  GraduationCap,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export type AppTab = 'dashboard' | 'feed' | 'map' | 'analytics';

interface NavbarProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  onOpenReportModal: () => void;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenReportModal,
  onOpenAuthModal,
}) => {
  const { user, logout, quickDemoLogin } = useAuth();
  const { unreadCount, toggleDrawer } = useNotifications();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="brand-logo" onClick={() => setCurrentTab(user ? 'dashboard' : 'feed')}>
          <div className="brand-icon-box">
            <Building2 size={24} />
          </div>
          <div>
            <div className="brand-title">
              Campus<span>Fix</span>
            </div>
            <div className="brand-subtitle">Smart Issue Resolution</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav>
          <ul className="nav-links">
            {/* Dashboard Tab for Logged in Users */}
            {user && (
              <li>
                <button
                  className={`nav-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('dashboard')}
                >
                  {user.role === 'admin' ? <ShieldCheck size={18} /> : <GraduationCap size={18} />}
                  <span>{user.role === 'admin' ? 'Admin Hub' : 'My Dashboard'}</span>
                </button>
              </li>
            )}

            <li>
              <button
                className={`nav-btn ${currentTab === 'feed' ? 'active' : ''}`}
                onClick={() => setCurrentTab('feed')}
              >
                <Compass size={18} />
                <span>Campus Feed</span>
              </button>
            </li>

            <li>
              <button
                className={`nav-btn ${currentTab === 'map' ? 'active' : ''}`}
                onClick={() => setCurrentTab('map')}
              >
                <MapPin size={18} />
                <span>Campus Map</span>
              </button>
            </li>

            {/* Analytics Tab (Admin only or all) */}
            {(!user || user.role === 'admin') && (
              <li>
                <button
                  className={`nav-btn ${currentTab === 'analytics' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('analytics')}
                >
                  <BarChart3 size={18} />
                  <span>Facilities Analytics</span>
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* Action Controls & User Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Quick Report Button */}
          <button
            className="btn btn-primary btn-sm"
            onClick={user ? onOpenReportModal : onOpenAuthModal}
            style={{ borderRadius: 'var(--radius-full)', padding: '8px 16px' }}
          >
            <PlusCircle size={16} />
            <span>Report Issue</span>
          </button>

          {/* Quick Demo Switcher */}
          {user && (
            <button
              className="btn btn-secondary btn-sm"
              title={`Currently ${user.role}. Click to switch demo role.`}
              onClick={() => quickDemoLogin(user.role === 'admin' ? 'student' : 'admin')}
              style={{
                fontSize: '0.8rem',
                padding: '6px 12px',
                borderColor: user.role === 'admin' ? '#cbd5e1' : '#bfdbfe',
                backgroundColor: user.role === 'admin' ? '#f8fafc' : '#eff6ff',
                color: user.role === 'admin' ? '#475569' : '#1d4ed8',
              }}
            >
              <ArrowRightLeft size={14} />
              <span>Switch to {user.role === 'admin' ? 'Student' : 'Admin'}</span>
            </button>
          )}

          {/* Notification Bell */}
          {user && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={toggleDrawer}
              style={{
                position: 'relative',
                padding: '8px',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
              }}
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    borderRadius: '999px',
                    minWidth: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    border: '2px solid #ffffff',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {/* User Profile or Sign-in */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 10px 4px 6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-subtle)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: user.role === 'admin' ? '#3b82f6' : '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {user.full_name.split(' ')[0]}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: user.role === 'admin' ? '#2563eb' : '#059669', fontWeight: 600, textTransform: 'uppercase' }}>
                    {user.role}
                  </div>
                </div>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={logout}
                title="Sign Out"
                style={{ padding: '8px', borderRadius: '50%', width: '38px', height: '38px' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={onOpenAuthModal}>
              <UserIcon size={16} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
