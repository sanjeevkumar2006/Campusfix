import { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Clock, 
  Sparkles, 
  CheckCircle, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle2, 
  RotateCcw,
  Sliders,
  Send
} from 'lucide-react';
import type { Issue, AdminUser, IssueStatus, IssuePriority } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

interface IssueDetailModalProps {
  issueId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onIssueUpdated: (updatedIssue: Issue) => void;
}

const STATUS_STEPS: IssueStatus[] = ['pending', 'acknowledged', 'in_progress', 'resolved', 'closed'];

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issueId,
  isOpen,
  onClose,
  onIssueUpdated,
}) => {
  const { user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Note form state
  const [newNote, setNewNote] = useState<string>('');

  // Resolve form state
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [resolutionFile, setResolutionFile] = useState<File | null>(null);
  const [resolutionPreview, setResolutionPreview] = useState<string | null>(null);

  // Reopen form state
  const [isReopening, setIsReopening] = useState<boolean>(false);
  const [reopenNotes, setReopenNotes] = useState<string>('');

  // Active photo tab: 'incident' | 'resolution'
  const [activePhotoTab, setActivePhotoTab] = useState<'incident' | 'resolution'>('incident');

  const fetchIssue = async () => {
    if (!issueId) return;
    try {
      setLoading(true);
      const res = await api.issues.getById(issueId);
      setIssue(res.issue);
      if (res.issue.resolution_image_url) {
        setActivePhotoTab('resolution');
      }
    } catch (err: any) {
      console.error('Failed to load issue details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && issueId) {
      fetchIssue();
      if (user?.role === 'admin') {
        api.auth.getAdmins().then((res) => setAdmins(res.admins)).catch(console.error);
      }
    } else {
      setIssue(null);
      setIsResolving(false);
      setIsReopening(false);
      setActionError(null);
      setActionSuccess(null);
    }
  }, [isOpen, issueId, user]);

  if (!isOpen || !issueId) return null;

  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (!issue) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.issues.updateStatus(issue.id, newStatus);
      setIssue(res.issue);
      onIssueUpdated(res.issue);
      setActionSuccess(`Status changed to ${newStatus.replace('_', ' ')}.`);
      await refreshNotifications();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePriorityChange = async (newPriority: IssuePriority) => {
    if (!issue) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.issues.updatePriority(issue.id, newPriority);
      setIssue(res.issue);
      onIssueUpdated(res.issue);
      setActionSuccess(`Priority updated to ${newPriority}.`);
      await refreshNotifications();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update priority.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCategoryChange = async (newCategory: string) => {
    if (!issue) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.issues.updateCategory(issue.id, newCategory);
      setIssue(res.issue);
      onIssueUpdated(res.issue);
      setActionSuccess(`Category reclassified to ${newCategory}.`);
      await refreshNotifications();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update category.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignChange = async (adminId: number | null) => {
    if (!issue) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.issues.assign(issue.id, adminId);
      setIssue(res.issue);
      onIssueUpdated(res.issue);
      setActionSuccess('Staff assignment saved.');
      await refreshNotifications();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to assign staff.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !newNote.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.issues.addNotes(issue.id, newNote.trim());
      setIssue(res.issue);
      onIssueUpdated(res.issue);
      setNewNote('');
      setActionSuccess('Update log appended.');
      await refreshNotifications();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to add update.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !resolutionNotes.trim()) {
      setActionError('Please summarize the work completed in the resolution notes.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.append('notes', resolutionNotes.trim());
      if (resolutionFile) {
        formData.append('resolution_image', resolutionFile);
      }

      const res = await api.issues.resolve(issue.id, formData);
      setIssue(res.issue);
      onIssueUpdated(res.issue);
      setIsResolving(false);
      setActionSuccess('Issue marked as RESOLVED with proof photo & notes!');
      await refreshNotifications();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to resolve issue.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !reopenNotes.trim()) {
      setActionError('Please specify why this issue requires reopening.');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.issues.reopen(issue.id, reopenNotes.trim());
      setIssue(res.issue);
      onIssueUpdated(res.issue);
      setIsReopening(false);
      setActionSuccess('Issue reopened for further facilities inspection.');
      await refreshNotifications();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to reopen issue.');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper for Stepper Progress
  const getStepStatus = (stepName: IssueStatus) => {
    if (!issue) return 'upcoming';
    const currentIndex = STATUS_STEPS.indexOf(issue.status === 'reopened' ? 'in_progress' : issue.status);
    const stepIndex = STATUS_STEPS.indexOf(stepName);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container modal-container-xl" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
              #{issue?.issue_code || 'Issue Record'}
            </span>
            {issue && (
              <>
                <span
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {issue.category}
                </span>

                <span
                  className={`priority-badge priority-${issue.priority}`}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  {issue.priority} Priority
                </span>

                <span
                  className={`badge badge-${issue.status}`}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  {issue.status.replace('_', ' ')}
                </span>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {actionError && <div className="alert alert-danger">{actionError}</div>}
          {actionSuccess && <div className="alert alert-success">{actionSuccess}</div>}

          {loading || !issue ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--primary-light)' }} />
              <div>Loading campus issue record...</div>
            </div>
          ) : (
            <>
              {/* Status Stepper Progression */}
              <div className="card" style={{ padding: '16px 20px', background: '#f8fafc' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Resolution Lifecycle Progress
                </div>

                <div className="stepper-container">
                  <div className="stepper-line" />
                  {STATUS_STEPS.map((step, idx) => {
                    const st = getStepStatus(step);
                    return (
                      <div key={step} className="stepper-step">
                        <div className={`step-node ${st}`}>
                          {st === 'completed' ? <CheckCircle2 size={18} /> : idx + 1}
                        </div>
                        <div className="step-label">
                          {step === 'in_progress' ? 'In Progress' : step.charAt(0).toUpperCase() + step.slice(1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Two Column Grid: Evidence vs Information */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '24px' }}>
                {/* Left Column: Visual Evidence (Side-by-side or Tabbed) */}
                <div>
                  {/* Photo Switcher Tabs */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${activePhotoTab === 'incident' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setActivePhotoTab('incident')}
                    >
                      📸 Reported Incident Photo
                    </button>
                    {issue.resolution_image_url && (
                      <button
                        type="button"
                        className={`btn btn-sm ${activePhotoTab === 'resolution' ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => setActivePhotoTab('resolution')}
                      >
                        ✅ Resolution Proof Photo
                      </button>
                    )}
                  </div>

                  {/* Photo Display Card */}
                  <div
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      border: '1px solid var(--border-light)',
                      position: 'relative',
                      backgroundColor: '#0f172a',
                    }}
                  >
                    <img
                      src={activePhotoTab === 'resolution' && issue.resolution_image_url ? issue.resolution_image_url : issue.image_url}
                      alt={issue.title}
                      style={{ width: '100%', height: '320px', objectFit: 'contain', display: 'block' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '12px',
                        right: '12px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(8px)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        color: 'white',
                        fontSize: '0.8rem',
                      }}
                    >
                      {activePhotoTab === 'resolution' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 600 }}>
                          <ShieldCheck size={16} />
                          <span>Official Completion Proof logged by Facilities Dispatch</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={14} color="#94a3b8" />
                          <span>Captured {new Date(issue.created_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resolution Notes Card if present */}
                  {issue.resolution_notes && (
                    <div
                      style={{
                        marginTop: '14px',
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                      }}
                    >
                      <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#065f46', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={16} color="#059669" />
                        <span>Staff Resolution Summary:</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#064e3b' }}>
                        {issue.resolution_notes}
                      </div>
                    </div>
                  )}

                  {/* AI Vision Metadata Card */}
                  {issue.ai_confidence && (
                    <div
                      style={{
                        marginTop: '14px',
                        background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%)',
                        border: '1px solid #bfdbfe',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e40af', fontWeight: 700, fontSize: '0.85rem' }}>
                          <Sparkles size={16} color="#2563eb" />
                          <span>Automated AI Vision Assessment</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1d4ed8' }}>
                          {issue.ai_confidence}% Confidence
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#1e3a8a' }}>
                        AI Category Match: <strong>{issue.ai_detected_category || issue.category}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Information, Timeline & Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Issue Meta Box */}
                  <div className="card" style={{ padding: '20px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px' }}>
                      {issue.title}
                    </h2>

                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                      {issue.description}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.825rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Campus Location:</span>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <MapPin size={14} color="#0284c7" />
                          <span>{issue.location_name}</span>
                        </div>
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Reported By:</span>
                        <div style={{ fontWeight: 600, marginTop: '2px' }}>
                          {issue.student_name || 'Alex Rivera'}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Assigned Staff:</span>
                        <div style={{ fontWeight: 600, marginTop: '2px', color: issue.assigned_name ? 'var(--primary-light)' : 'var(--text-muted)' }}>
                          {issue.assigned_name || 'Unassigned (In Triage)'}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Last Updated:</span>
                        <div style={{ fontWeight: 600, marginTop: '2px' }}>
                          {new Date(issue.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ADMIN DISPATCH CONTROLS */}
                  {user?.role === 'admin' && (
                    <div
                      className="card"
                      style={{
                        padding: '18px 20px',
                        background: '#f8fafc',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sliders size={16} />
                        <span>Administrator Facilities Controls</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                        {/* Status Updater */}
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Update Status</label>
                          <select
                            className="form-select"
                            value={issue.status}
                            disabled={actionLoading}
                            onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
                            style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                          >
                            <option value="pending">Pending</option>
                            <option value="acknowledged">Acknowledged</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="reopened">Reopened</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>

                        {/* Priority Triage */}
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Triage Priority</label>
                          <select
                            className="form-select"
                            value={issue.priority}
                            disabled={actionLoading}
                            onChange={(e) => handlePriorityChange(e.target.value as IssuePriority)}
                            style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>

                        {/* Category Reclassification */}
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Reclassify Category</label>
                          <select
                            className="form-select"
                            value={issue.category}
                            disabled={actionLoading}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                          >
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
                      </div>

                      {/* Staff Assignment */}
                      <div style={{ marginBottom: '14px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Assign Facilities Staff</label>
                        <select
                          className="form-select"
                          value={issue.assigned_to || ''}
                          disabled={actionLoading}
                          onChange={(e) => handleAssignChange(e.target.value ? Number(e.target.value) : null)}
                          style={{ padding: '6px 10px', fontSize: '0.825rem' }}
                        >
                          <option value="">Unassigned</option>
                          {admins.map((adm) => (
                            <option key={adm.id} value={adm.id}>
                              {adm.full_name} ({adm.department || 'Facilities'})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quick Resolve Button Trigger */}
                      {issue.status !== 'resolved' && issue.status !== 'closed' && (
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={() => setIsResolving(!isResolving)}
                          style={{ width: '100%' }}
                        >
                          <CheckCircle size={16} />
                          <span>Complete & Resolve Issue with Photo Proof</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* RESOLVE DIALOG FORM */}
                  {isResolving && (
                    <form
                      onSubmit={handleResolveSubmit}
                      className="card"
                      style={{
                        padding: '18px',
                        border: '1.5px solid #10b981',
                        backgroundColor: '#f0fdf4',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#065f46', marginBottom: '10px' }}>
                        Log Resolution & Work Proof
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', color: '#065f46' }}>
                          Work Done / Resolution Notes
                        </label>
                        <textarea
                          required
                          rows={2}
                          className="form-textarea"
                          placeholder="e.g. Replaced leaking valve, retested water pressure, sanitized floor."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', color: '#065f46' }}>
                          Upload Resolution Photo (Optional Proof)
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setResolutionFile(e.target.files[0]);
                              setResolutionPreview(URL.createObjectURL(e.target.files[0]));
                            }
                          }}
                        />
                        {resolutionPreview && (
                          <img
                            src={resolutionPreview}
                            alt="Resolution preview"
                            style={{ height: '70px', borderRadius: '6px', marginTop: '6px', objectFit: 'cover' }}
                          />
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setIsResolving(false)}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-success btn-sm" disabled={actionLoading}>
                          {actionLoading ? 'Recording...' : 'Mark Resolved'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* STUDENT REOPEN ACTION */}
                  {(issue.status === 'resolved' || issue.status === 'closed') && (
                    <div>
                      {!isReopening ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setIsReopening(true)}
                          style={{ width: '100%', color: '#c2410c', borderColor: '#fed7aa', backgroundColor: '#fff7ed' }}
                        >
                          <RotateCcw size={14} />
                          <span>Issue Recurring? Request Reopen</span>
                        </button>
                      ) : (
                        <form
                          onSubmit={handleReopenSubmit}
                          className="card"
                          style={{
                            padding: '16px',
                            border: '1.5px solid #f97316',
                            backgroundColor: '#fff7ed',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#9a3412', marginBottom: '8px' }}>
                            Specify Reason for Reopening
                          </div>
                          <textarea
                            required
                            rows={2}
                            className="form-textarea"
                            placeholder="Explain why the problem has returned or remains unresolved..."
                            value={reopenNotes}
                            onChange={(e) => setReopenNotes(e.target.value)}
                            style={{ fontSize: '0.825rem', marginBottom: '10px' }}
                          />
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setIsReopening(false)}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="btn btn-danger btn-sm"
                              disabled={actionLoading}
                            >
                              {actionLoading ? 'Submitting...' : 'Reopen Issue'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* AUDIT TRAIL / TIMELINE */}
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                      📋 Audit Trail & Activity Log ({issue.updates?.length || 0})
                    </div>

                    <div className="timeline-track" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      {issue.updates && issue.updates.length > 0 ? (
                        issue.updates.map((upd) => (
                          <div key={upd.id} className="timeline-point">
                            <div className="timeline-dot" />
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {upd.notes || `Action: ${upd.action}`}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                              <span>{upd.user_name || 'Staff Dispatch'}</span>
                              <span>•</span>
                              <span>{new Date(upd.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>•</span>
                              <span>{new Date(upd.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          No status changes recorded yet.
                        </div>
                      )}
                    </div>

                    {/* Add note input */}
                    {user && (
                      <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <input
                          type="text"
                          required
                          className="form-input"
                          placeholder="Add update note or instructions..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                        />
                        <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading}>
                          <Send size={14} />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
