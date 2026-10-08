import { useState, useMemo } from 'react';
import { 
  PlusCircle, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Layers, 
  ChevronRight, 
  Calendar, 
  MapPin, 
  Grid, 
  List, 
  Bell, 
  GraduationCap
} from 'lucide-react';
import type { Issue } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

interface StudentDashboardProps {
  issues: Issue[];
  onOpenReportModal: () => void;
  onSelectIssue: (issueId: number) => void;
}

const STATUS_TIMELINE_STEPS = [
  { key: 'reported', label: 'Reported' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' }
];

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  issues,
  onOpenReportModal,
  onSelectIssue
}) => {
  const { user } = useAuth();
  const { notifications, unreadCount, openDrawer } = useNotifications();

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority' | 'status'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filter issues created by this logged-in student
  const studentIssues = useMemo(() => {
    if (!user) return [];
    return issues.filter((i) => i.student_id === user.id);
  }, [issues, user]);

  // Metric counts
  const totalSubmitted = studentIssues.length;
  const pendingCount = studentIssues.filter((i) => i.status === 'pending').length;
  const inProgressCount = studentIssues.filter((i) => i.status === 'in_progress' || i.status === 'acknowledged').length;
  const resolvedCount = studentIssues.filter((i) => i.status === 'resolved' || i.status === 'closed').length;

  // Filtered and sorted student issues
  const filteredIssues = useMemo(() => {
    let result = studentIssues.filter((issue) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = issue.title.toLowerCase().includes(q);
        const matchDesc = issue.description.toLowerCase().includes(q);
        const matchCode = issue.issue_code.toLowerCase().includes(q);
        const matchLoc = issue.location_name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCode && !matchLoc) return false;
      }

      if (selectedStatus !== 'all') {
        if (selectedStatus === 'in_progress' && (issue.status === 'in_progress' || issue.status === 'acknowledged')) {
          // treat as in-progress grouping
        } else if (issue.status !== selectedStatus) {
          return false;
        }
      }

      if (selectedPriority !== 'all' && issue.priority !== selectedPriority) return false;
      if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'priority') {
        const priorityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      }
      if (sortBy === 'status') {
        return a.status.localeCompare(b.status);
      }
      // default: newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [studentIssues, searchQuery, selectedStatus, selectedPriority, selectedCategory, sortBy]);

  // Helper for timeline step active index
  const getTimelineStepIndex = (status: string) => {
    switch (status) {
      case 'pending': return 0;
      case 'acknowledged': return 1;
      case 'in_progress':
      case 'reopened': return 2;
      case 'resolved': return 3;
      case 'closed': return 4;
      default: return 0;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Student Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #06b6d4 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 36px',
          color: '#ffffff',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px'
        }}
      >
        <div style={{ maxWidth: '640px', position: 'relative', zIndex: 2 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              padding: '4px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '14px',
              backdropFilter: 'blur(6px)'
            }}
          >
            <GraduationCap size={16} />
            <span>Student Portal • {user?.department || 'University Scholar'}</span>
          </div>

          <h1
            style={{
              fontSize: '2.2rem',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              marginBottom: '10px'
            }}
          >
            Welcome back, {user?.full_name || 'Student'}!
          </h1>
          <p
            style={{
              fontSize: '1rem',
              color: '#e0f2fe',
              lineHeight: 1.5,
              marginBottom: '20px'
            }}
          >
            Report broken campus facilities, track real-time resolution updates, and inspect photo verified maintenance work across campus.
          </p>

          {/* Quick Primary Report CTA */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenReportModal}
            style={{
              backgroundColor: '#ffffff',
              color: 'var(--primary)',
              fontWeight: 700,
              fontSize: '0.95rem',
              padding: '12px 24px',
              borderRadius: 'var(--radius-full)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <PlusCircle size={20} color="var(--primary-light)" />
            <span>Report an Issue</span>
          </button>
        </div>

        {/* Quick notification status card */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
            minWidth: '240px',
            position: 'relative',
            zIndex: 2
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e0f2fe' }}>Campus Activity</span>
            <button
              onClick={openDrawer}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem'
              }}
            >
              <Bell size={14} />
              <span>{unreadCount > 0 ? `${unreadCount} new` : 'All caught up'}</span>
            </button>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalSubmitted}</div>
          <div style={{ fontSize: '0.8rem', color: '#bae6fd' }}>Total Reports Submitted by You</div>
        </div>
      </div>

      {/* 4 Dashboard Metric Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '18px'
        }}
      >
        {/* Total Submitted */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-subtle)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Layers size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Submitted Issues</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalSubmitted}</div>
          </div>
        </div>

        {/* Pending Issues */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pending Review</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#d97706' }}>{pendingCount}</div>
          </div>
        </div>

        {/* In Progress */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: '#ede9fe',
              color: '#7c3aed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>In Progress / Dispatched</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7c3aed' }}>{inProgressCount}</div>
          </div>
        </div>

        {/* Resolved */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Resolved & Closed</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d' }}>{resolvedCount}</div>
          </div>
        </div>
      </div>

      {/* Notifications Recent Activity Banner */}
      {notifications.length > 0 && (
        <div
          className="card"
          style={{
            padding: '16px 20px',
            backgroundColor: '#ffffff',
            borderLeft: '4px solid var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-subtle)',
                color: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Bell size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {notifications[0].title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {notifications[0].message}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={openDrawer}
            style={{ fontSize: '0.8rem' }}
          >
            <span>View All Notifications ({notifications.length})</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* "My Issues" Main Section */}
      <div className="card" style={{ padding: '24px' }}>
        {/* Section Title and Primary Report CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              My Reported Issues
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Manage and track the status of all facility requests you have submitted.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onOpenReportModal}
              style={{ borderRadius: 'var(--radius-full)', padding: '8px 18px' }}
            >
              <PlusCircle size={16} />
              <span>Report an Issue</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            backgroundColor: 'var(--bg-subtle)',
            padding: '16px',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '24px'
          }}
        >
          {/* Top row: Search input & view switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <Search
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Search your reports by title, ID (#CF-1001), or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', height: '40px' }}
              />
            </div>

            {/* View Mode Switcher */}
            <div style={{ display: 'flex', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: '#ffffff' }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '8px 12px',
                  background: viewMode === 'grid' ? 'var(--primary-subtle)' : '#ffffff',
                  color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer'
                }}
                title="Grid Cards"
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
                  cursor: 'pointer'
                }}
                title="Table List"
              >
                <List size={16} />
              </button>
            </div>
          </div>

          {/* Bottom row: Filter selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Status pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Status:</span>
              {['all', 'pending', 'in_progress', 'resolved', 'closed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className="btn btn-sm"
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: selectedStatus === st ? 'var(--primary)' : '#ffffff',
                    color: selectedStatus === st ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  {st === 'all' ? 'All' : st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Category:</span>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="all">All Categories</option>
                <option value="Water Leakage">Water Leakage</option>
                <option value="Electricity">Electricity</option>
                <option value="Waste Management">Waste Management</option>
                <option value="Lighting">Lighting</option>
                <option value="Sanitation">Sanitation</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Classroom Equipment">Classroom Equipment</option>
                <option value="Internet/Wi-Fi">Internet/Wi-Fi</option>
                <option value="Safety">Safety</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Priority Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Priority:</span>
              <select
                className="form-select"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Sort:</span>
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="priority">Priority (High to Low)</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Issues List or Empty State */}
        {filteredIssues.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 20px' }}>
            <div className="empty-state-icon">
              <AlertCircle size={32} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '6px' }}>
              {studentIssues.length === 0 ? 'You have not submitted any issues yet' : 'No matching issues found'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '420px' }}>
              {studentIssues.length === 0
                ? 'Spot a broken light, dripping pipe, or safety hazard on campus? Take a photo and file your first report.'
                : 'Try clearing your search query or adjusting your filters to locate your reports.'}
            </p>
            {studentIssues.length === 0 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onOpenReportModal}
              >
                <PlusCircle size={18} />
                <span>Report Your First Issue</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStatus('all');
                  setSelectedPriority('all');
                  setSelectedCategory('all');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '20px'
            }}
          >
            {filteredIssues.map((issue) => {
              const activeStep = getTimelineStepIndex(issue.status);
              return (
                <div
                  key={issue.id}
                  className="card issue-card"
                  onClick={() => onSelectIssue(issue.id)}
                  style={{
                    padding: '0',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    border: '1px solid var(--border-light)'
                  }}
                >
                  {/* Image Preview with Badges */}
                  <div style={{ position: 'relative', width: '100%', height: '170px', backgroundColor: '#0f172a' }}>
                    <img
                      src={issue.image_url}
                      alt={issue.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        // Fallback image if svg or link fails
                        (e.target as HTMLImageElement).src = '/uploads/damaged-staircase.svg';
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        display: 'flex',
                        gap: '6px'
                      }}
                    >
                      <span className={`badge badge-${issue.status}`}>
                        {issue.status.replace('_', ' ')}
                      </span>
                      <span className={`priority-badge priority-${issue.priority}`}>
                        {issue.priority}
                      </span>
                    </div>

                    <div
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '12px',
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(4px)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#93c5fd'
                      }}
                    >
                      #{issue.issue_code}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>
                      {issue.category}
                    </div>

                    <h4
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '8px',
                        lineHeight: 1.3
                      }}
                    >
                      {issue.title}
                    </h4>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '14px'
                      }}
                    >
                      <MapPin size={14} color="#0284c7" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {issue.location_name}
                      </span>
                    </div>

                    {/* Professional Status Timeline */}
                    <div
                      style={{
                        marginTop: 'auto',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border-light)'
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Status Timeline
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                        {/* Connecting line */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '6px',
                            right: '6px',
                            top: '5px',
                            height: '2px',
                            backgroundColor: '#e2e8f0',
                            zIndex: 1
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: '6px',
                            width: `${(activeStep / (STATUS_TIMELINE_STEPS.length - 1)) * 100}%`,
                            top: '5px',
                            height: '2px',
                            backgroundColor: issue.status === 'resolved' ? '#10b981' : 'var(--primary-light)',
                            zIndex: 2,
                            transition: 'width 0.3s ease'
                          }}
                        />

                        {STATUS_TIMELINE_STEPS.map((step, idx) => {
                          const isDone = idx <= activeStep;
                          const isCurrent = idx === activeStep;
                          return (
                            <div
                              key={step.key}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                position: 'relative',
                                zIndex: 3
                              }}
                              title={step.label}
                            >
                              <div
                                style={{
                                  width: isCurrent ? '12px' : '10px',
                                  height: isCurrent ? '12px' : '10px',
                                  borderRadius: '50%',
                                  backgroundColor: isDone
                                    ? (issue.status === 'resolved' ? '#10b981' : 'var(--primary-light)')
                                    : '#cbd5e1',
                                  border: isCurrent ? '2px solid #ffffff' : 'none',
                                  boxShadow: isCurrent ? '0 0 0 2px var(--primary-light)' : 'none'
                                }}
                              />
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  color: isCurrent ? 'var(--primary-light)' : 'var(--text-muted)',
                                  fontWeight: isCurrent ? 700 : 500,
                                  marginTop: '4px',
                                  textAlign: 'center'
                                }}
                              >
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Date and Action */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '14px',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} />
                        <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                      </div>

                      <span style={{ color: 'var(--primary-light)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                        <span>Inspect</span>
                        <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Issue Code & Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Category</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Location</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Priority</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Reported Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => onSelectIssue(issue.id)}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--primary-light)', fontSize: '0.8rem' }}>
                        #{issue.issue_code}
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{issue.title}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{issue.category}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>📍 {issue.location_name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`priority-badge priority-${issue.priority}`}>
                        {issue.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge badge-${issue.status}`}>
                        {issue.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(issue.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIssue(issue.id);
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
