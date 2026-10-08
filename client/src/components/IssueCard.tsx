import type { Issue } from '../types';
import { MapPin, Clock, Sparkles, ChevronRight, ShieldCheck } from 'lucide-react';

interface IssueCardProps {
  issue: Issue;
  onClick: () => void;
}

export const IssueCard: React.FC<IssueCardProps> = ({ issue, onClick }) => {
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending': return 'badge-pending';
      case 'acknowledged': return 'badge-acknowledged';
      case 'in_progress': return 'badge-in_progress';
      case 'resolved': return 'badge-resolved';
      case 'reopened': return 'badge-reopened';
      case 'closed': return 'badge-closed';
      default: return 'badge-pending';
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'critical': return 'priority-critical';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-medium';
    }
  };

  const formattedDate = new Date(issue.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="card card-interactive"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '0',
        height: '100%',
      }}
    >
      {/* Thumbnail Banner */}
      <div style={{ position: 'relative', height: '170px', width: '100%', backgroundColor: '#f1f5f9' }}>
        <img
          src={issue.image_url}
          alt={issue.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy"
        />

        {/* Category Badge Top Left */}
        <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
          <span
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {issue.category}
          </span>
        </div>

        {/* Priority Badge Top Right */}
        <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
          <span className={`priority-badge ${getPriorityClass(issue.priority)}`}>
            {issue.priority}
          </span>
        </div>

        {/* Resolution indicator if resolved */}
        {issue.resolution_image_url && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.95)',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShieldCheck size={12} />
            <span>Resolution Verified</span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Code & Status Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-light)', letterSpacing: '0.04em' }}>
            #{issue.issue_code}
          </span>
          <span className={`badge ${getStatusClass(issue.status)}`}>
            {issue.status.replace('_', ' ')}
          </span>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            marginBottom: '8px',
            color: 'var(--text-primary)',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {issue.title}
        </h3>

        {/* Location */}
        <div
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            marginBottom: '12px',
          }}
        >
          <MapPin size={14} color="#0284c7" />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {issue.location_name}
          </span>
        </div>

        {/* Description snippet */}
        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            lineHeight: 1.45,
            marginBottom: '16px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            flex: 1,
          }}
        >
          {issue.description}
        </p>

        {/* AI Confidence pill if available */}
        {issue.ai_confidence && (
          <div
            style={{
              fontSize: '0.75rem',
              color: '#065f46',
              backgroundColor: '#ecfdf5',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '14px',
              border: '1px solid #a7f3d0',
            }}
          >
            <Sparkles size={13} color="#059669" />
            <span>AI Verified Hazard ({Math.round(issue.ai_confidence)}% confidence)</span>
          </div>
        )}

        {/* Footer info & CTA */}
        <div
          style={{
            borderTop: '1px solid var(--border-light)',
            paddingTop: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={13} />
            <span>{formattedDate}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              color: 'var(--primary-light)',
              fontWeight: 600,
            }}
          >
            <span>View Timeline</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};
