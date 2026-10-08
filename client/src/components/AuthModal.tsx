import React, { useState } from 'react';
import { X, LogIn, UserPlus, Shield, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, quickDemoLogin } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [department, setDepartment] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register({
          email,
          password,
          full_name: fullName,
          role,
          department,
          phone,
        });
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (roleType: 'student' | 'admin') => {
    setError(null);
    setLoading(true);
    try {
      await quickDemoLogin(roleType);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {isRegister ? 'Create CampusFix Account' : 'Welcome to CampusFix'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isRegister ? 'Join your campus issue reporting community' : 'Sign in to report and track campus issues'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* 1-Click Demo Buttons */}
          <div
            style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%)',
              border: '1px solid var(--primary-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚡ Instant 1-Click Demo Logins
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickLogin('student')}
                disabled={loading}
                style={{
                  justifyContent: 'flex-start',
                  padding: '10px 12px',
                  backgroundColor: '#ffffff',
                  borderColor: '#93c5fd',
                }}
              >
                <GraduationCap size={18} color="#2563eb" />
                <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Student</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Alex Rivera</div>
                </div>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleQuickLogin('admin')}
                disabled={loading}
                style={{
                  justifyContent: 'flex-start',
                  padding: '10px 12px',
                  backgroundColor: '#ffffff',
                  borderColor: '#cbd5e1',
                }}
              >
                <Shield size={18} color="#0f766e" />
                <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Facilities Admin</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Marcus Vance</div>
                </div>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Or use your credentials
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ padding: '10px 14px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'student' | 'admin')}
                  >
                    <option value="student">Student / Campus Resident</option>
                    <option value="admin">Facilities Administrator / Staff</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Department / Major (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Electrical Eng, Hostel Block B"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Contact (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. +1 (555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="name@campus.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '10px' }}
            >
              {loading ? (
                'Processing...'
              ) : isRegister ? (
                <>
                  <UserPlus size={18} />
                  <span>Create Account</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle between Login and Register */}
          <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '0.875rem' }}>
            {isRegister ? (
              <span>
                Already have an account?{' '}
                <a
                  href="#login"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsRegister(false);
                    setError(null);
                  }}
                  style={{ fontWeight: 600 }}
                >
                  Sign In
                </a>
              </span>
            ) : (
              <span>
                Don't have an account yet?{' '}
                <a
                  href="#register"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsRegister(true);
                    setError(null);
                  }}
                  style={{ fontWeight: 600 }}
                >
                  Register here
                </a>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
