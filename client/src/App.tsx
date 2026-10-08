import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Grid, 
  List, 
  RefreshCw, 
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Navbar } from './components/Navbar';
import { IssueCard } from './components/IssueCard';
import { CampusMap } from './components/CampusMap';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ReportIssueModal } from './components/ReportIssueModal';
import { IssueDetailModal } from './components/IssueDetailModal';
import { AuthModal } from './components/AuthModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { api } from './services/api';
import type { Issue, CampusLocation } from './types';
import type { AppTab } from './components/Navbar';

function MainApp() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<AppTab>(user ? 'dashboard' : 'feed');

  // Issues Data
  const [issues, setIssues] = useState<Issue[]>([]);
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [mineOnly, setMineOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);

  // Fetch all issues & locations
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [issuesRes, locRes] = await Promise.all([
        api.issues.getAll(),
        api.locations.getAll().catch(() => ({ locations: [] })),
      ]);
      setIssues(issuesRes.issues);
      setLocations(locRes.locations);
    } catch (err) {
      console.error('Failed to load campus issues:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    if (user && currentTab === 'feed') {
      setCurrentTab('dashboard');
    } else if (!user && currentTab === 'dashboard') {
      setCurrentTab('feed');
    }
  }, [fetchAllData, user]);

  const handleIssueCreated = (newIssue: Issue) => {
    setIssues((prev) => [newIssue, ...prev]);
    setSelectedIssueId(newIssue.id);
  };

  const handleIssueUpdated = (updatedIssue: Issue) => {
    setIssues((prev) =>
      prev.map((i) => (i.id === updatedIssue.id ? updatedIssue : i))
    );
  };

  // Client-side filtering
  const filteredIssues = issues.filter((issue) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = issue.title.toLowerCase().includes(q);
      const matchDesc = issue.description.toLowerCase().includes(q);
      const matchCode = issue.issue_code.toLowerCase().includes(q);
      const matchLoc = issue.location_name.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCode && !matchLoc) return false;
    }

    if (selectedStatus !== 'all' && issue.status !== selectedStatus) return false;
    if (selectedPriority !== 'all' && issue.priority !== selectedPriority) return false;
    if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false;

    if (mineOnly && user) {
      if (issue.student_id !== user.id) return false;
    }

    return true;
  });

  // Calculate quick badge stats
  const pendingCount = issues.filter((i) => i.status === 'pending').length;
  const inProgressCount = issues.filter((i) => i.status === 'in_progress').length;
  const resolvedCount = issues.filter((i) => i.status === 'resolved' || i.status === 'closed').length;
  const criticalCount = issues.filter((i) => i.priority === 'critical' && i.status !== 'resolved' && i.status !== 'closed').length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="main-content">
        <div className="container">
          {/* TAB 0: ROLE-BASED DASHBOARDS */}
          {currentTab === 'dashboard' && user?.role === 'student' && (
            <StudentDashboard
              issues={issues}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              onSelectIssue={(id) => setSelectedIssueId(id)}
            />
          )}

          {currentTab === 'dashboard' && user?.role === 'admin' && (
            <AdminDashboard
              issues={issues}
              locations={locations}
              onSelectIssue={(id) => setSelectedIssueId(id)}
              onRefreshData={fetchAllData}
            />
          )}

          {/* TAB 1: ISSUES FEED */}
          {currentTab === 'feed' && (
            <div>
              {/* Hero Banner with Quick Stats */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #06b6d4 100%)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '32px 36px',
                  color: '#ffffff',
                  marginBottom: '28px',
                  boxShadow: 'var(--shadow-lg)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '12px' }}>
                    <Sparkles size={14} />
                    <span>AI-Powered Facilities Management</span>
                  </div>

                  <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                    CampusFix Incident Feed
                  </h1>
                  <p style={{ fontSize: '1rem', color: '#e0f2fe', maxWidth: '640px', lineHeight: 1.5, marginBottom: '24px' }}>
                    Report hazards, broken infrastructure, sanitation issues, and electrical faults. Track resolution progress in real-time with photo verification.
                  </p>

                  {/* Summary metric chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px)', padding: '8px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{issues.length}</span>
                      <span style={{ fontSize: '0.85rem', color: '#e0f2fe' }}>Total Reports</span>
                    </div>

                    <div style={{ background: 'rgba(245, 158, 11, 0.3)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245, 158, 11, 0.45)', padding: '8px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{pendingCount}</span>
                      <span style={{ fontSize: '0.85rem', color: '#fef08a' }}>Pending Triage</span>
                    </div>

                    <div style={{ background: 'rgba(239, 68, 68, 0.35)', backdropFilter: 'blur(8px)', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '8px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{criticalCount}</span>
                      <span style={{ fontSize: '0.85rem', color: '#fecaca' }}>Critical Hazards</span>
                    </div>

                    <div style={{ background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px)', padding: '8px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{inProgressCount}</span>
                      <span style={{ fontSize: '0.85rem', color: '#e0f2fe' }}>In Progress</span>
                    </div>

                    <div style={{ background: 'rgba(16, 185, 129, 0.3)', backdropFilter: 'blur(8px)', padding: '8px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{resolvedCount}</span>
                      <span style={{ fontSize: '0.85rem', color: '#a7f3d0' }}>Resolved</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div
                className="card"
                style={{
                  padding: '18px 20px',
                  marginBottom: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* Search & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Search Input */}
                  <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                    <Search
                      size={18}
                      color="var(--text-muted)"
                      style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search by title, description, code (#CF-1001), or building location..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: '40px' }}
                    />
                  </div>

                  {/* My Issues Toggle if user logged in */}
                  {user && (
                    <button
                      type="button"
                      className={`btn btn-sm ${mineOnly ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setMineOnly(!mineOnly)}
                    >
                      <GraduationCap size={16} />
                      <span>My Reports</span>
                    </button>
                  )}

                  {/* View Mode Toggle */}
                  <div style={{ display: 'flex', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      style={{
                        padding: '8px 12px',
                        background: viewMode === 'grid' ? 'var(--primary-subtle)' : '#ffffff',
                        color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Grid View"
                    >
                      <Grid size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      style={{
                        padding: '8px 12px',
                        background: viewMode === 'table' ? 'var(--primary-subtle)' : '#ffffff',
                        color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Table View"
                    >
                      <List size={16} />
                    </button>
                  </div>

                  {/* Refresh Button */}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={fetchAllData}
                    title="Refresh data"
                    disabled={loading}
                  >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* Filter Selectors Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                  {/* Status Pills */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status:</span>
                    {['all', 'pending', 'in_progress', 'resolved', 'reopened'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSelectedStatus(st)}
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.8rem',
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: selectedStatus === st ? 'var(--primary)' : 'var(--bg-subtle)',
                          color: selectedStatus === st ? '#ffffff' : 'var(--text-secondary)',
                          border: 'none',
                        }}
                      >
                        {st === 'all' ? 'All' : st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  {/* Priority Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Priority:</span>
                    <select
                      className="form-select"
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value)}
                      style={{ padding: '6px 12px', fontSize: '0.825rem', width: 'auto' }}
                    >
                      <option value="all">All Priorities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  {/* Category Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Category:</span>
                    <select
                      className="form-select"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      style={{ padding: '6px 12px', fontSize: '0.825rem', width: 'auto' }}
                    >
                      <option value="all">All Categories</option>
                      <option value="Water Leakage">Water Leakage</option>
                      <option value="Electricity">Electricity</option>
                      <option value="Waste Management">Waste Management</option>
                      <option value="Street/Indoor Lighting">Street/Indoor Lighting</option>
                      <option value="Sanitation">Sanitation</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Classroom Equipment">Classroom Equipment</option>
                      <option value="Internet/Wi-Fi">Internet/Wi-Fi</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Feed Content: Grid or Table */}
              {loading && issues.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--primary-light)' }} />
                  <div>Loading campus reports...</div>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Search size={28} />
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
                    No matching campus issues found
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Try adjusting your search terms or filters to discover active reports.
                  </p>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedStatus('all');
                      setSelectedPriority('all');
                      setSelectedCategory('all');
                      setMineOnly(false);
                    }}
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '24px',
                  }}
                >
                  {filteredIssues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      onClick={() => setSelectedIssueId(issue.id)}
                    />
                  ))}
                </div>
              ) : (
                /* Table View */
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light)' }}>
                        <tr>
                          <th style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--text-secondary)' }}>Code & Title</th>
                          <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Category</th>
                          <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Location</th>
                          <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Priority</th>
                          <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
                          <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Reported</th>
                          <th style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredIssues.map((issue) => (
                          <tr
                            key={issue.id}
                            onClick={() => setSelectedIssueId(issue.id)}
                            style={{
                              borderBottom: '1px solid var(--border-light)',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '14px 20px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--primary-light)', fontSize: '0.8rem' }}>#{issue.issue_code}</div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{issue.title}</div>
                            </td>
                            <td style={{ padding: '14px 16px' }}>{issue.category}</td>
                            <td style={{ padding: '14px 16px' }}>📍 {issue.location_name}</td>
                            <td style={{ padding: '14px 16px' }}>
                              <span className={`priority-badge priority-${issue.priority}`}>
                                {issue.priority}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span className={`badge badge-${issue.status}`}>
                                {issue.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {new Date(issue.created_at).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedIssueId(issue.id);
                                }}
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INTERACTIVE CAMPUS MAP */}
          {currentTab === 'map' && (
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Campus Geolocation & Incident Map</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Interactive live spatial view of reported facility issues across university quad, hostel towers, engineering labs, and study commons.
                </p>
              </div>

              <CampusMap
                issues={issues}
                locations={locations}
                onSelectIssue={(issue) => setSelectedIssueId(issue.id)}
              />
            </div>
          )}

          {/* TAB 3: FACILITIES ANALYTICS */}
          {currentTab === 'analytics' && (
            <AnalyticsDashboard
              onSelectIssue={(issue) => setSelectedIssueId(issue.id)}
              allIssues={issues}
            />
          )}
        </div>
      </main>

      {/* Global Modals & Sliding Drawers */}
      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onIssueCreated={handleIssueCreated}
      />

      <IssueDetailModal
        issueId={selectedIssueId}
        isOpen={selectedIssueId !== null}
        onClose={() => setSelectedIssueId(null)}
        onIssueUpdated={handleIssueUpdated}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <NotificationDrawer
        onSelectIssueById={(issueId: number) => setSelectedIssueId(issueId)}
      />

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-light)',
          backgroundColor: '#ffffff',
          padding: '24px 0',
          marginTop: 'auto',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>CampusFix</span>
            <span>•</span>
            <span>Smart University Issue Reporting & Dispatch System</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>Campus Dispatch Hotline: <strong>(555) 987-HELP</strong></span>
            <span>•</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>● API & AI Services Online</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <MainApp />
      </NotificationProvider>
    </AuthProvider>
  );
}
