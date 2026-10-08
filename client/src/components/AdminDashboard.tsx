import { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  RefreshCw
} from 'lucide-react';
import type { Issue, CampusLocation } from '../types';
import { useAuth } from '../context/AuthContext';

interface AdminDashboardProps {
  issues: Issue[];
  locations: CampusLocation[];
  onSelectIssue: (issueId: number) => void;
  onRefreshData: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  issues,
  locations,
  onSelectIssue,
  onRefreshData
}) => {
  const { user } = useAuth();

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority' | 'status'>('newest');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Top metric counters
  const totalIssues = issues.length;
  const pendingCount = issues.filter((i) => i.status === 'pending').length;
  const acknowledgedCount = issues.filter((i) => i.status === 'acknowledged').length;
  const inProgressCount = issues.filter((i) => i.status === 'in_progress').length;
  const resolvedCount = issues.filter((i) => i.status === 'resolved' || i.status === 'closed').length;
  const criticalCount = issues.filter((i) => i.priority === 'critical' && i.status !== 'resolved' && i.status !== 'closed').length;

  // Filtered issues computation
  const filteredIssues = useMemo(() => {
    let result = issues.filter((issue) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = issue.title.toLowerCase().includes(q);
        const matchCode = issue.issue_code.toLowerCase().includes(q);
        const matchDesc = issue.description.toLowerCase().includes(q);
        const matchStudent = (issue.student_name || '').toLowerCase().includes(q);
        const matchLoc = issue.location_name.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchDesc && !matchStudent && !matchLoc) {
          return false;
        }
      }

      // 2. Status
      if (selectedStatus !== 'all' && issue.status !== selectedStatus) return false;

      // 3. Priority
      if (selectedPriority !== 'all' && issue.priority !== selectedPriority) return false;

      // 4. Category
      if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false;

      // 5. Location
      if (selectedLocation !== 'all' && issue.location_name !== selectedLocation) return false;

      // 6. Date Range
      if (dateRange !== 'all') {
        const issueDate = new Date(issue.created_at).getTime();
        const now = Date.now();
        if (dateRange === 'today') {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          if (issueDate < startOfDay.getTime()) return false;
        } else if (dateRange === '7d') {
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
          if (issueDate < sevenDaysAgo) return false;
        } else if (dateRange === '30d') {
          const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
          if (issueDate < thirtyDaysAgo) return false;
        }
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'priority') {
        const weight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return (weight[b.priority] || 0) - (weight[a.priority] || 0);
      }
      if (sortBy === 'status') {
        return a.status.localeCompare(b.status);
      }
      // default: newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [issues, searchQuery, selectedStatus, selectedPriority, selectedCategory, selectedLocation, dateRange, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / pageSize));
  const paginatedIssues = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIssues.slice(start, start + pageSize);
  }, [filteredIssues, currentPage, pageSize]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Admin Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #0369a1 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 36px',
          color: '#ffffff',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '10px'
            }}
          >
            <ShieldCheck size={16} />
            <span>Facilities Administration • {user?.full_name || 'Staff Dispatch'}</span>
          </div>

          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Campus Incident Command & Management
          </h1>
          <p style={{ fontSize: '0.95rem', color: '#e0f2fe', maxWidth: '640px', lineHeight: 1.5 }}>
            Triage reported campus issues, reclassify priority/category, assign maintenance technicians, and record verified resolution proof.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onRefreshData}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 16px'
          }}
        >
          <RefreshCw size={14} />
          <span>Sync Real-Time Queue</span>
        </button>
      </div>

      {/* 6 Top Metric KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Total Issues */}
        <div className="card" style={{ padding: '18px', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Issues
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
            {totalIssues}
          </div>
        </div>

        {/* Pending */}
        <div className="card" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
            Pending Triage
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', color: '#d97706' }}>
            {pendingCount}
          </div>
        </div>

        {/* Acknowledged */}
        <div className="card" style={{ padding: '18px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
            Acknowledged
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', color: '#2563eb' }}>
            {acknowledgedCount}
          </div>
        </div>

        {/* In Progress */}
        <div className="card" style={{ padding: '18px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>
            In Progress
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', color: '#7c3aed' }}>
            {inProgressCount}
          </div>
        </div>

        {/* Resolved */}
        <div className="card" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
            Resolved
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', color: '#059669' }}>
            {resolvedCount}
          </div>
        </div>

        {/* Critical */}
        <div className="card" style={{ padding: '18px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
            Critical Hazards
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '4px', color: '#dc2626' }}>
            {criticalCount}
          </div>
        </div>
      </div>

      {/* ADMIN ISSUE LIST TABLE SECTION */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Facilities Queue & Dispatch Table
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing {filteredIssues.length} of {totalIssues} campus maintenance records
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            padding: '16px',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '20px'
          }}
        >
          {/* Top Search bar */}
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Search across tickets by ID (#CF-1001), issue title, student name, building location..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: '36px', height: '40px' }}
            />
          </div>

          {/* Filter Selectors Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            {/* Status */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Status
              </label>
              <select
                className="form-select"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="reopened">Reopened</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Priority
              </label>
              <select
                className="form-select"
                value={selectedPriority}
                onChange={(e) => {
                  setSelectedPriority(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Category
              </label>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              >
                <option value="all">All Categories</option>
                <option value="Waste Management">Waste Management</option>
                <option value="Water Leakage">Water Leakage</option>
                <option value="Electricity">Electricity</option>
                <option value="Lighting">Lighting</option>
                <option value="Sanitation">Sanitation</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Classroom Equipment">Classroom Equipment</option>
                <option value="Internet/Wi-Fi">Internet/Wi-Fi</option>
                <option value="Safety">Safety</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Location
              </label>
              <select
                className="form-select"
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              >
                <option value="all">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Date Range
              </label>
              <select
                className="form-select"
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value as any);
                  setCurrentPage(1);
                }}
                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7d">Past 7 Days</option>
                <option value="30d">Past 30 Days</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Sort By
              </label>
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="priority">Priority (High to Low)</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredIssues.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 16px' }}>
            <div className="empty-state-icon">
              <Filter size={32} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
              No issues match your current filters
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Try loosening your search query or reset filter dropdowns to view tickets.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('all');
                setSelectedPriority('all');
                setSelectedCategory('all');
                setSelectedLocation('all');
                setDateRange('all');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-light)' }}>
                <tr>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Issue ID</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Title</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Category</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Student</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Location</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Priority</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Date</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedIssues.map((issue) => (
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
                    {/* Issue ID */}
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--primary-light)', whiteSpace: 'nowrap' }}>
                      #{issue.issue_code}
                    </td>

                    {/* Title with thumbnail */}
                    <td style={{ padding: '12px 14px', maxWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={issue.image_url}
                          alt="thumb"
                          style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0, backgroundColor: '#0f172a' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/uploads/damaged-staircase.svg';
                          }}
                        />
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {issue.title}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {issue.category}
                    </td>

                    {/* Student */}
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {issue.student_name || 'Alex Rivera'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {issue.student_email || 'student@campusfix.edu'}
                      </div>
                    </td>

                    {/* Location */}
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} color="#0284c7" />
                        <span style={{ fontSize: '0.8rem' }}>{issue.location_name}</span>
                      </div>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`priority-badge priority-${issue.priority}`}>
                        {issue.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`badge badge-${issue.status}`}>
                        {issue.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(issue.created_at).toLocaleDateString()}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIssue(issue.id);
                        }}
                      >
                        Triage / Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {filteredIssues.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '18px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-light)',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>Rows per page:</span>
              <select
                className="form-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredIssues.length)} of {filteredIssues.length}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
                style={{ padding: '6px 10px' }}
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>

              <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0 8px' }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                style={{ padding: '6px 10px' }}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
