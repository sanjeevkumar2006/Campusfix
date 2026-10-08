import { useEffect, useState, useCallback } from 'react';
import { 
  TrendingUp, 
  Clock, 
  Layers, 
  ArrowUpRight,
  RefreshCw,
  Calendar,
  Building2,
  CheckCircle2,
  Activity,
  Flame,
  BarChart3
} from 'lucide-react';
import { api } from '../services/api';
import type { CampusStats, Issue } from '../types';

interface AnalyticsDashboardProps {
  onSelectIssue: (issue: Issue) => void;
  allIssues: Issue[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  onSelectIssue,
  allIssues,
}) => {
  const [stats, setStats] = useState<CampusStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Date Range Filters: 'all' | 'today' | '7d' | '30d' | '90d' | 'custom'
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7d' | '30d' | '90d' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { range: dateRange };
      if (dateRange === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const res = await api.stats.getStats(params);
      setStats(res);
    } catch (err) {
      console.error('Failed to load campus stats:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, startDate, endDate]);

  useEffect(() => {
    loadStats();
  }, [loadStats, allIssues]);

  // Critical issues that need immediate facilities attention
  const criticalIssues = allIssues.filter(
    (i) => i.priority === 'critical' && i.status !== 'resolved' && i.status !== 'closed'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #0284c7 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px 32px',
          color: '#ffffff',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#93c5fd', fontWeight: 700, marginBottom: '6px' }}>
            Campus Facilities Operations Center
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Executive Facilities Analytics & Intelligence
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#cbd5e1', maxWidth: '600px', marginTop: '4px' }}>
            Telemetry on reported campus hazards, resolution velocity, location density, and maintenance benchmarks calculated directly from university records.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={loadStats}
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.3)' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Sync Analytics</span>
        </button>
      </div>

      {/* Date Range Selector Toolbar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} />
            <span>Time Window:</span>
          </span>

          {[
            { key: 'all', label: 'All Time' },
            { key: 'today', label: 'Today' },
            { key: '7d', label: 'Past 7 Days' },
            { key: '30d', label: 'Past 30 Days' },
            { key: '90d', label: 'Past 3 Months' },
            { key: 'custom', label: 'Custom Range' },
          ].map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setDateRange(r.key as any)}
              className="btn btn-sm"
              style={{
                fontSize: '0.8rem',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: dateRange === r.key ? 'var(--primary)' : 'var(--bg-subtle)',
                color: dateRange === r.key ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={loadStats}
              disabled={!startDate || !endDate}
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {loading && !stats ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <RefreshCw size={36} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--primary-light)' }} />
          <div style={{ fontWeight: 600 }}>Calculating campus facility analytics...</div>
        </div>
      ) : !stats || stats.summary.totalIssues === 0 ? (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <div className="empty-state-icon">
            <BarChart3 size={36} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '6px' }}>
            No data available yet.
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            There are no campus incident tickets logged within the selected date window.
          </p>
        </div>
      ) : (
        <>
          {/* 7 KPI CARDS ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            {/* Total Issues */}
            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #2563eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Issues
                </span>
                <Layers size={16} color="#2563eb" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {stats.summary.totalIssues}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Reported by students
              </div>
            </div>

            {/* Resolved Issues */}
            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                  Resolved Issues
                </span>
                <CheckCircle2 size={16} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669' }}>
                {stats.summary.resolved}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Repairs confirmed
              </div>
            </div>

            {/* Pending Issues */}
            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
                  Pending Issues
                </span>
                <Clock size={16} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706' }}>
                {stats.summary.pending}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Awaiting triage
              </div>
            </div>

            {/* In-Progress Issues */}
            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>
                  In Progress
                </span>
                <Activity size={16} color="#8b5cf6" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#7c3aed' }}>
                {stats.summary.inProgress}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Crew on-site
              </div>
            </div>

            {/* Resolution Rate */}
            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #06b6d4' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0891b2', textTransform: 'uppercase' }}>
                  Resolution Rate
                </span>
                <TrendingUp size={16} color="#06b6d4" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0891b2' }}>
                {stats.summary.resolutionRate}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Completion efficiency
              </div>
            </div>

            {/* Average Resolution Time */}
            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #6366f1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase' }}>
                  Avg Resolution Time
                </span>
                <Clock size={16} color="#6366f1" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4f46e5' }}>
                {stats.summary.avgResolutionDays} <span style={{ fontSize: '1rem', fontWeight: 600 }}>days</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                From report to completion
              </div>
            </div>

            {/* Critical Issues */}
            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
                  Critical Issues
                </span>
                <Flame size={16} color="#ef4444" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626' }}>
                {stats.summary.critical}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Urgent campus hazards
              </div>
            </div>
          </div>

          {/* CRITICAL HAZARD ALERT IF ANY */}
          {criticalIssues.length > 0 && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontWeight: 800, fontSize: '1rem', marginBottom: '12px' }}>
                <Flame size={20} />
                <span>Immediate Priority: {criticalIssues.length} Critical Campus Hazard(s) Requiring Attention</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {criticalIssues.slice(0, 3).map((ci) => (
                  <div
                    key={ci.id}
                    onClick={() => onSelectIssue(ci)}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #fee2e2',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#991b1b' }}>#{ci.issue_code}: {ci.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#7f1d1d', marginTop: '2px' }}>📍 {ci.location_name}</div>
                    </div>
                    <ArrowUpRight size={16} color="#dc2626" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6 ANALYTICS CHARTS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
            {/* CHART 1: Issues by Category */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  1. Issues by Category
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top Incident Types</span>
              </div>

              {stats.byCategory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No data available yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.byCategory.map((cat) => {
                    const pct = Math.round((cat.count / stats.summary.totalIssues) * 100);
                    return (
                      <div key={cat.category}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{cat.category}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{cat.count} issues ({pct}%)</span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              backgroundColor: 'var(--primary-light)',
                              borderRadius: '4px',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CHART 2: Issues by Status */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  2. Issues by Status
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lifecycle Distribution</span>
              </div>

              {stats.byStatus.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No data available yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                  {stats.byStatus.map((st) => (
                    <div
                      key={st.status}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-subtle)',
                        textAlign: 'center',
                      }}
                    >
                      <span className={`badge badge-${st.status}`} style={{ fontSize: '0.75rem', marginBottom: '8px' }}>
                        {st.status.replace('_', ' ')}
                      </span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px' }}>{st.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CHART 3: Issues by Priority */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  3. Issues by Priority
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Triage Severity</span>
              </div>

              {stats.byPriority.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No data available yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stats.byPriority.map((pri) => {
                    const pct = Math.round((pri.count / stats.summary.totalIssues) * 100);
                    const color = 
                      pri.priority === 'critical' ? '#ef4444' :
                      pri.priority === 'high' ? '#f97316' :
                      pri.priority === 'medium' ? '#eab308' : '#10b981';

                    return (
                      <div key={pri.priority}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '4px' }}>
                          <span className={`priority-badge priority-${pri.priority}`}>
                            {pri.priority.toUpperCase()}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>{pri.count} issues ({pct}%)</span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              backgroundColor: color,
                              borderRadius: '4px',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CHART 4: Issues Over Time */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  4. Issues Over Time
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Report Influx Velocity</span>
              </div>

              {stats.timeline.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No data available yet.
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px', paddingTop: '20px' }}>
                  {stats.timeline.map((t) => {
                    const maxVal = Math.max(...stats.timeline.map((x) => x.count), 1);
                    const heightPercent = Math.max(15, Math.round((t.count / maxVal) * 100));
                    return (
                      <div
                        key={t.date}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
                          {t.count}
                        </span>
                        <div
                          style={{
                            width: '100%',
                            height: `${heightPercent}%`,
                            backgroundColor: 'var(--primary)',
                            borderRadius: '4px 4px 0 0',
                          }}
                        />
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                          {t.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CHART 5: Issues by Campus Location */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  5. Issues by Campus Location
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Facility Hotspots</span>
              </div>

              {!stats.byLocation || stats.byLocation.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No data available yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stats.byLocation.slice(0, 6).map((loc) => {
                    const maxLoc = Math.max(...stats.byLocation.map((x) => x.count), 1);
                    const pct = Math.round((loc.count / maxLoc) * 100);
                    return (
                      <div key={loc.location}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Building2 size={13} color="#0284c7" />
                            <span>{loc.location}</span>
                          </span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{loc.count} reports</span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--bg-subtle)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              backgroundColor: '#0284c7',
                              borderRadius: '3px',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CHART 6: Resolution Time Trend */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  6. Resolution Time Trend
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Days to Complete</span>
              </div>

              {!stats.resolutionTrend || stats.resolutionTrend.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No data available yet.
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '140px', paddingTop: '20px' }}>
                  {stats.resolutionTrend.map((t) => {
                    const maxVal = Math.max(...stats.resolutionTrend.map((x) => x.avgDays), 1);
                    const heightPercent = Math.max(20, Math.round((t.avgDays / maxVal) * 100));
                    return (
                      <div
                        key={t.date}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', marginBottom: '4px' }}>
                          {t.avgDays}d
                        </span>
                        <div
                          style={{
                            width: '100%',
                            height: `${heightPercent}%`,
                            backgroundColor: '#10b981',
                            borderRadius: '4px 4px 0 0',
                          }}
                        />
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                          {t.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
