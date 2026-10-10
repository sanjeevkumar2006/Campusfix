import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  Sparkles, 
  MapPin, 
  RefreshCw, 
  Camera, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  Check,
  Info
} from 'lucide-react';
import L from 'leaflet';
import { ApiRequestError, api } from '../services/api';
import type { CampusLocation, IssuePriority, AIAnalysisResult, Issue, PotentialDuplicateIssue } from '../types';
import { useNotifications } from '../context/NotificationContext';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIssueCreated: (newIssue: Issue) => void;
}

const CATEGORIES = [
  'Waste Management',
  'Water Leakage',
  'Electricity',
  'Lighting',
  'Sanitation',
  'Infrastructure',
  'Classroom Equipment',
  'Internet/Wi-Fi',
  'Safety',
  'Other'
];

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  isOpen,
  onClose,
  onIssueCreated,
}) => {
  const { refresh: refreshNotifications } = useNotifications();

  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('Infrastructure');
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [locationName, setLocationName] = useState<string>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState<string>('');

  // Camera State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  // Map Picker State
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [showMapPicker, setShowMapPicker] = useState<boolean>(false);

  // AI State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiErrorNotice, setAiErrorNotice] = useState<string | null>(null);
  const [aiAccepted, setAiAccepted] = useState<boolean>(false);
  const [aiEditing, setAiEditing] = useState<boolean>(false);

  // Submission & Success Confirmation State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdIssue, setCreatedIssue] = useState<Issue | null>(null);
  const [potentialMatches, setPotentialMatches] = useState<PotentialDuplicateIssue[]>([]);
  const [duplicateConfirmationToken, setDuplicateConfirmationToken] = useState<string | null>(null);
  const [showDuplicateReview, setShowDuplicateReview] = useState<boolean>(false);
  const submissionLockRef = useRef<boolean>(false);

  // Load campus locations on open
  useEffect(() => {
    if (isOpen) {
      api.locations.getAll().then((res) => {
        setLocations(res.locations);
        if (res.locations.length > 0 && !locationName) {
          setLocationName(res.locations[0].name);
          setLatitude(res.locations[0].latitude);
          setLongitude(res.locations[0].longitude);
        }
      }).catch(console.error);
    } else {
      // Clean up modal state on close
      stopCamera();
      setCreatedIssue(null);
      setError(null);
      setPotentialMatches([]);
      setDuplicateConfirmationToken(null);
      setShowDuplicateReview(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setExistingImageUrl(null);
      setCapturedPhotoUrl(null);
      setAiResult(null);
      setAiErrorNotice(null);
      setAiAccepted(false);
      setAiEditing(false);
      setTitle('');
      setDescription('');
      setAdditionalInfo('');
      setShowMapPicker(false);
    }
  }, [isOpen]);

  // Handle Mini Leaflet Map initialization
  useEffect(() => {
    if (!showMapPicker || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = latitude || 12.9722;
      const initialLng = longitude || 77.5945;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO | CampusFix',
        maxZoom: 19
      }).addTo(map);

      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setLatitude(parseFloat(pos.lat.toFixed(6)));
        setLongitude(parseFloat(pos.lng.toFixed(6)));
      });

      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setLatitude(parseFloat(e.latlng.lat.toFixed(6)));
        setLongitude(parseFloat(e.latlng.lng.toFixed(6)));
      });

      mapInstanceRef.current = map;
      setTimeout(() => map.invalidateSize(), 200);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [showMapPicker]);

  // Update marker position if location dropdown changes while map is open
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && latitude && longitude) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.panTo([latitude, longitude]);
    }
  }, [latitude, longitude]);

  if (!isOpen) return null;

  // Camera Management
  const startCamera = async () => {
    setCameraError(null);
    setCapturedPhotoUrl(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is unavailable. You can upload a photo instead.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      setCameraStream(stream);
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err) {
      console.warn('Camera access denied or device unavailable:', err);
      setCameraError('Camera access is unavailable. You can upload a photo instead.');
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhotoUrl(dataUrl);
    stopCamera();
  };

  const confirmCapturedPhoto = async () => {
    if (!capturedPhotoUrl) return;

    // Convert dataUrl to File
    const res = await fetch(capturedPhotoUrl);
    const blob = await res.blob();
    const file = new File([blob], `campus-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });

    setSelectedFile(file);
    setPreviewUrl(capturedPhotoUrl);
    setExistingImageUrl(null);
    setCapturedPhotoUrl(null);
    setError(null);

    // Trigger AI analysis
    await runAIAnalysis(file);
  };

  const retakePhoto = () => {
    setCapturedPhotoUrl(null);
    startCamera();
  };

  // Client-side image validation and compression
  const validateAndCompressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      // 1. File type check
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type.toLowerCase())) {
        reject(new Error('Please upload a valid image (JPEG, PNG, or WebP).'));
        return;
      }

      // 2. File size check (12MB)
      if (file.size > 12 * 1024 * 1024) {
        reject(new Error('Image file is too large. Maximum size is 12MB.'));
        return;
      }

      // 3. Compress if large image dimensions
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDimension = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = objectUrl;
    });
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    try {
      const validatedFile = await validateAndCompressImage(file);
      setSelectedFile(validatedFile);
      setExistingImageUrl(null);
      const objUrl = URL.createObjectURL(validatedFile);
      setPreviewUrl(objUrl);
      await runAIAnalysis(validatedFile);
    } catch (err: any) {
      setError(err?.message || 'Invalid image selected.');
    }
  };

  const handleSelectDemoPreset = async (filename: string, defaultTitle: string, defaultCategory: string) => {
    setError(null);
    stopCamera();
    setExistingImageUrl(`/uploads/${filename}`);
    setPreviewUrl(`/uploads/${filename}`);
    setSelectedFile(null);

    setIsScanning(true);
    setAiErrorNotice(null);
    try {
      const response = await fetch(`/uploads/${filename}`);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'image/svg+xml' });
      await runAIAnalysis(file);
    } catch {
      setIsScanning(false);
      setCategory(defaultCategory);
      if (!title) setTitle(defaultTitle);
    }
  };

  // AI Classification
  const runAIAnalysis = async (file: File) => {
    setIsScanning(true);
    setAiResult(null);
    setAiErrorNotice(null);
    setAiAccepted(false);
    setAiEditing(false);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await api.ai.classify(formData);
      if (res && res.analysis) {
        setAiResult(res.analysis);
      } else {
        setAiErrorNotice('AI analysis is temporarily unavailable.');
      }
    } catch (err: any) {
      console.warn('AI analysis unavailable:', err);
      setAiErrorNotice('AI analysis is temporarily unavailable.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAcceptAISuggestion = () => {
    if (!aiResult) return;
    if (aiResult.suggestedCategory && CATEGORIES.includes(aiResult.suggestedCategory)) {
      setCategory(aiResult.suggestedCategory);
    }
    if (aiResult.suggestedPriority) {
      setPriority(aiResult.suggestedPriority);
    }
    if (aiResult.detectedIssue) {
      setTitle(aiResult.detectedIssue);
    }
    setAiAccepted(true);
    setAiEditing(false);
  };

  const handleEditAISuggestion = () => {
    if (!aiResult) return;
    if (aiResult.suggestedCategory && CATEGORIES.includes(aiResult.suggestedCategory)) {
      setCategory(aiResult.suggestedCategory);
    }
    if (aiResult.suggestedPriority) {
      setPriority(aiResult.suggestedPriority);
    }
    if (!title && aiResult.detectedIssue) {
      setTitle(aiResult.detectedIssue);
    }
    setAiEditing(true);
    setAiAccepted(false);
  };

  const handleLocationChange = (locName: string) => {
    setLocationName(locName);
    const found = locations.find((l) => l.name === locName);
    if (found) {
      setLatitude(found.latitude);
      setLongitude(found.longitude);
    }
  };

  const getDuplicateCandidate = () => ({
    title: title.trim(),
    description: description.trim(),
    category,
    location_name: locationName.trim(),
    latitude,
    longitude
  });

  const buildSubmissionFormData = (confirmationToken?: string) => {
    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('category', category);
    formData.append('priority', priority);
    formData.append('location_name', locationName);

    if (latitude !== null) formData.append('latitude', latitude.toString());
    if (longitude !== null) formData.append('longitude', longitude.toString());
    if (additionalInfo.trim()) formData.append('additional_info', additionalInfo.trim());

    if (aiResult) {
      formData.append('ai_detected_category', aiResult.suggestedCategory);
      formData.append('ai_confidence', aiResult.confidence.toString());
    }

    if (selectedFile) {
      formData.append('image', selectedFile);
    } else if (existingImageUrl) {
      formData.append('existing_image_url', existingImageUrl);
    }

    if (confirmationToken) {
      formData.append('duplicate_confirmation_token', confirmationToken);
    }

    return formData;
  };

  const showPotentialMatches = (
    matches: PotentialDuplicateIssue[],
    confirmationToken?: string
  ) => {
    setPotentialMatches(matches);
    setDuplicateConfirmationToken(confirmationToken || null);
    setShowDuplicateReview(matches.length > 0);
    setError(null);
  };

  const handleContinueAfterReview = async () => {
    if (submissionLockRef.current || !duplicateConfirmationToken) return;

    submissionLockRef.current = true;
    setSubmitting(true);
    setCheckingDuplicates(false);
    setError(null);

    const candidate = getDuplicateCandidate();
    try {
      const res = await api.issues.create(buildSubmissionFormData(duplicateConfirmationToken));
      setShowDuplicateReview(false);
      setPotentialMatches([]);
      setDuplicateConfirmationToken(null);
      await refreshNotifications();
      onIssueCreated(res.issue);
      setCreatedIssue(res.issue);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && err.status === 409) {
        try {
          const latestCheck = await api.issues.checkDuplicates(candidate);
          if (latestCheck.potentialMatches.length > 0) {
            showPotentialMatches(latestCheck.potentialMatches, latestCheck.confirmationToken);
          } else {
            setError(err.message);
          }
        } catch (checkError: unknown) {
          setError(checkError instanceof Error ? checkError.message : 'Failed to refresh possible matches.');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to submit issue report.');
      }
    } finally {
      submissionLockRef.current = false;
      setSubmitting(false);
    }
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionLockRef.current) return;

    if (!previewUrl && !selectedFile && !existingImageUrl) {
      setError('Please capture or select a photo of the incident.');
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError('Please provide both an issue title and description.');
      return;
    }

    if (!locationName.trim()) {
      setError('Please select a campus location.');
      return;
    }

    submissionLockRef.current = true;
    setSubmitting(true);
    setCheckingDuplicates(true);
    setError(null);

    const candidate = getDuplicateCandidate();
    try {
      const duplicateCheck = await api.issues.checkDuplicates(candidate);
      if (duplicateCheck.potentialMatches.length > 0) {
        showPotentialMatches(duplicateCheck.potentialMatches, duplicateCheck.confirmationToken);
        return;
      }

      const res = await api.issues.create(buildSubmissionFormData());
      await refreshNotifications();
      onIssueCreated(res.issue);
      setCreatedIssue(res.issue);
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && err.status === 409) {
        try {
          const latestCheck = await api.issues.checkDuplicates(candidate);
          if (latestCheck.potentialMatches.length > 0) {
            showPotentialMatches(latestCheck.potentialMatches, latestCheck.confirmationToken);
          } else {
            setError(err.message);
          }
        } catch (checkError: unknown) {
          setError(checkError instanceof Error ? checkError.message : 'Failed to refresh possible matches.');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to submit issue report.');
      }
    } finally {
      submissionLockRef.current = false;
      setSubmitting(false);
      setCheckingDuplicates(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container modal-container-lg" onClick={(e) => e.stopPropagation()}>
        {/* Hidden Canvas for Camera capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Camera size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Report Campus Issue</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Direct student dispatch to campus facilities maintenance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* SUCCESS CONFIRMATION SCREEN */}
          {createdIssue ? (
            <div style={{ textAlign: 'center', padding: '36px 16px' }}>
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 0 24px rgba(22, 163, 74, 0.25)'
                }}
              >
                <CheckCircle2 size={44} />
              </div>

              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'var(--primary-subtle)',
                  color: 'var(--primary-light)',
                  padding: '4px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  marginBottom: '12px',
                  letterSpacing: '0.05em'
                }}
              >
                #{createdIssue.issue_code}
              </div>

              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Your issue has been submitted successfully.
              </h2>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 24px', lineHeight: 1.5 }}>
                Issue ticket <strong>#{createdIssue.issue_code}</strong> has been logged into the facilities dispatch queue. Maintenance staff will review and triage this report shortly.
              </p>

              {/* Summary pill card */}
              <div
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                  maxWidth: '460px',
                  margin: '0 auto 28px',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Title</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '10px' }}>{createdIssue.title}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Category: </span>
                    <strong>{createdIssue.category}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Location: </span>
                    <strong>{createdIssue.location_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                    <span className="badge badge-pending">PENDING</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Priority: </span>
                    <span className={`priority-badge priority-${createdIssue.priority}`}>{createdIssue.priority}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onClose}
                  style={{ padding: '10px 24px', borderRadius: 'var(--radius-full)' }}
                >
                  Done • Back to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && <div className="alert alert-danger">{error}</div>}

              {showDuplicateReview && potentialMatches.length > 0 && (
                <div className="alert alert-warning" role="alert" style={{ display: 'block' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <AlertTriangle size={19} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>A similar issue may already have been reported.</strong>
                      <p style={{ margin: '6px 0 12px', fontSize: '0.85rem' }}>
                        Review these unresolved reports. If your report describes a different problem, you can still submit it.
                      </p>

                      <div style={{ display: 'grid', gap: '8px' }}>
                        {potentialMatches.map((match) => (
                          <div
                            key={match.issue_code}
                            style={{
                              background: 'rgba(255, 255, 255, 0.7)',
                              border: '1px solid var(--status-pending-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '10px 12px'
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>
                              #{match.issue_code} · {match.title}
                            </div>
                            <div style={{ marginTop: '4px', fontSize: '0.8rem' }}>
                              {match.category} · {match.location_name} · {match.status.replace('_', ' ')} ·{' '}
                              {new Date(match.created_at).toLocaleDateString()}
                            </div>
                            <div style={{ marginTop: '3px', fontSize: '0.75rem' }}>
                              {match.match_reasons.join(' · ')}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleContinueAfterReview}
                          disabled={submitting || !duplicateConfirmationToken}
                        >
                          {submitting ? 'Submitting...' : 'This is different — submit anyway'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setShowDuplicateReview(false);
                            setPotentialMatches([]);
                            setDuplicateConfirmationToken(null);
                          }}
                          disabled={submitting}
                        >
                          Review or edit my report
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Incident presets quick test bar */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  ⚡ Quick Demo Presets:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectDemoPreset('water-leakage.svg', 'Burst Water Pipe in Restroom', 'Water Leakage')}
                  >
                    💧 Water Leakage
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectDemoPreset('exposed-wires.svg', 'Exposed Electrical Conduit', 'Electricity')}
                  >
                    ⚡ Electricity
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectDemoPreset('overflowing-bin.svg', 'Overflowing Garbage Bin', 'Waste Management')}
                  >
                    🗑️ Waste Management
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectDemoPreset('broken-streetlight.svg', 'Dark Pathway Light Outage', 'Lighting')}
                  >
                    💡 Lighting
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectDemoPreset('damaged-staircase.svg', 'Broken Stairway Step Hazard', 'Infrastructure')}
                  >
                    ⚠️ Infrastructure
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* LEFT COLUMN: Camera & Image Evidence */}
                  <div>
                    <label className="form-label" style={{ marginBottom: '8px' }}>
                      Photo Evidence
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: 600 }}>
                        Required
                      </span>
                    </label>

                    {/* Camera Error / Permission Notice */}
                    {cameraError && (
                      <div className="alert alert-warning" style={{ fontSize: '0.8rem', padding: '10px 12px', marginBottom: '12px' }}>
                        <AlertTriangle size={16} />
                        <div>{cameraError}</div>
                      </div>
                    )}

                    {/* LIVE CAMERA VIEWFINDER */}
                    {cameraActive && (
                      <div
                        style={{
                          position: 'relative',
                          backgroundColor: '#000000',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          height: '240px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '14px'
                        }}
                      >
                        <video
                          ref={videoRef}
                          playsInline
                          autoPlay
                          muted
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />

                        {/* Capture Controls Overlay */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '12px',
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'center'
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={capturePhoto}
                            style={{
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                              fontWeight: 700,
                              padding: '8px 18px',
                              borderRadius: 'var(--radius-full)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}
                          >
                            <Camera size={16} color="var(--primary)" />
                            <span>Capture Photo</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={stopCamera}
                            style={{
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              color: '#ffffff',
                              borderColor: 'transparent'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* CAPTURED CAMERA PHOTO REVIEW */}
                    {capturedPhotoUrl && !cameraActive && (
                      <div
                        style={{
                          position: 'relative',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          height: '240px',
                          backgroundColor: '#0f172a',
                          marginBottom: '14px'
                        }}
                      >
                        <img
                          src={capturedPhotoUrl}
                          alt="Captured Photo"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />

                        <div
                          style={{
                            position: 'absolute',
                            bottom: '12px',
                            left: '12px',
                            right: '12px',
                            display: 'flex',
                            gap: '8px',
                            justifyContent: 'center'
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={retakePhoto}
                            style={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)' }}
                          >
                            <RotateCcw size={14} />
                            <span>Retake</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={confirmCapturedPhoto}
                          >
                            <Check size={14} />
                            <span>Confirm Photo</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* CONFIRMED PHOTO PREVIEW */}
                    {previewUrl && !cameraActive && !capturedPhotoUrl && (
                      <div style={{ position: 'relative', marginBottom: '14px' }}>
                        <div
                          className={isScanning ? 'ai-radar-box' : ''}
                          style={{
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            border: '1px solid var(--border-light)'
                          }}
                        >
                          <img
                            src={previewUrl}
                            alt="Issue Evidence Preview"
                            style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block' }}
                          />
                          {isScanning && <div className="ai-radar-line" />}
                        </div>

                        {/* Photo Action Buttons */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            position: 'absolute',
                            bottom: '10px',
                            right: '10px'
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={startCamera}
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.9)',
                              backdropFilter: 'blur(4px)',
                              fontSize: '0.75rem'
                            }}
                          >
                            <Camera size={13} />
                            <span>Camera</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                              backgroundColor: 'rgba(255, 255, 255, 0.9)',
                              backdropFilter: 'blur(4px)',
                              fontSize: '0.75rem'
                            }}
                          >
                            <RefreshCw size={13} />
                            <span>Upload New</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* NO PHOTO YET: Camera & Upload Pickers */}
                    {!previewUrl && !cameraActive && !capturedPhotoUrl && (
                      <div
                        style={{
                          border: '2px dashed #93c5fd',
                          backgroundColor: 'var(--primary-subtle)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '28px 16px',
                          textAlign: 'center',
                          marginBottom: '14px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '14px' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={startCamera}
                            style={{ borderRadius: 'var(--radius-full)' }}
                          >
                            <Camera size={16} />
                            <span>Open Device Camera</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ borderRadius: 'var(--radius-full)' }}
                          >
                            <UploadCloud size={16} />
                            <span>Upload from Device</span>
                          </button>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Supports live camera snaps, PNG, JPG, or WebP up to 12MB. AI assists with hazard classification.
                        </div>
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelect(e.target.files[0]);
                        }
                      }}
                    />

                    {/* Scanning radar indicator */}
                    {isScanning && (
                      <div className="alert alert-info" style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
                        <Sparkles size={16} className="animate-spin" />
                        <div>
                          <strong>AI Vision Scanner active...</strong>
                          <div>Analyzing incident photo patterns & hazards...</div>
                        </div>
                      </div>
                    )}

                    {/* AI Notice when offline/unavailable */}
                    {aiErrorNotice && !isScanning && (
                      <div className="alert alert-warning" style={{ fontSize: '0.8rem', padding: '10px 12px' }}>
                        <Info size={16} />
                        <div>{aiErrorNotice} You can manually enter details.</div>
                      </div>
                    )}

                    {/* PHASE 5: AI ANALYSIS CARD WITH [ACCEPT] [EDIT] */}
                    {aiResult && !isScanning && (
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%)',
                          border: '1.5px solid #6ee7b7',
                          borderRadius: 'var(--radius-md)',
                          padding: '14px 16px',
                          marginTop: '12px',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#065f46', fontWeight: 800, fontSize: '0.85rem' }}>
                            <span>🤖</span>
                            <span>AI ANALYSIS</span>
                          </div>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#047857',
                              backgroundColor: '#d1fae5',
                              padding: '2px 8px',
                              borderRadius: '12px'
                            }}
                          >
                            Confidence: {aiResult.confidence}%
                          </span>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: '#064e3b', marginBottom: '4px' }}>
                          <strong>Detected:</strong> {aiResult.detectedIssue}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#064e3b', marginBottom: '4px' }}>
                          <strong>Category:</strong> {aiResult.suggestedCategory}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#064e3b', marginBottom: '8px' }}>
                          <strong>Suggested Priority:</strong>{' '}
                          <span className={`priority-badge priority-${aiResult.suggestedPriority}`}>
                            {aiResult.suggestedPriority.toUpperCase()}
                          </span>
                        </div>

                        {/* [Accept] [Edit] Buttons */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #a7f3d0' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={handleAcceptAISuggestion}
                            style={{
                              backgroundColor: aiAccepted ? '#059669' : '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              padding: '5px 14px',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Check size={14} />
                            <span>{aiAccepted ? 'Accepted' : 'Accept'}</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleEditAISuggestion}
                            style={{
                              fontSize: '0.8rem',
                              padding: '5px 14px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: aiEditing ? '#e0f2fe' : '#ffffff',
                              borderColor: '#6ee7b7'
                            }}
                          >
                            <span>Edit Manually</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN: Issue Details Form */}
                  <div>
                    {/* Title */}
                    <div className="form-group">
                      <label className="form-label">
                        Issue Title <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. Overflowing garbage bin outside library"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>

                    {/* Campus Location Dropdown & Map Pinpoint Toggle */}
                    <div className="form-group">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label className="form-label" style={{ marginBottom: 0 }}>
                          Campus Location <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowMapPicker(!showMapPicker)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary-light)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <MapPin size={13} />
                          <span>{showMapPicker ? 'Hide Map' : 'Select on Map'}</span>
                        </button>
                      </div>

                      <select
                        className="form-select"
                        value={locationName}
                        onChange={(e) => handleLocationChange(e.target.value)}
                      >
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.name}>
                            {loc.name} ({loc.code})
                          </option>
                        ))}
                      </select>

                      {/* Interactive Mini Map Picker */}
                      {showMapPicker && (
                        <div style={{ marginTop: '10px' }}>
                          <div
                            ref={mapContainerRef}
                            style={{
                              height: '160px',
                              borderRadius: 'var(--radius-md)',
                              overflow: 'hidden',
                              border: '1px solid var(--border-light)'
                            }}
                          />
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            📍 Click or drag marker to set exact coordinates ({latitude?.toFixed(4)}, {longitude?.toFixed(4)})
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Category & Priority Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">
                          Category <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          className="form-select"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          Suggested Priority
                        </label>
                        <select
                          className="form-select"
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as IssuePriority)}
                        >
                          <option value="low">Low (Cosmetic/Minor)</option>
                          <option value="medium">Medium (Standard)</option>
                          <option value="high">High (Urgent)</option>
                          <option value="critical">Critical (Immediate Hazard)</option>
                        </select>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="form-group">
                      <label className="form-label">
                        Issue Description <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <textarea
                        required
                        rows={3}
                        className="form-textarea"
                        placeholder="Provide details: what is wrong, exact location, when you noticed it, and any immediate risks..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>

                    {/* Optional Additional Information */}
                    <div className="form-group">
                      <label className="form-label">
                        Additional Information <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span>
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Floor 2, Room 204, near emergency exit stairs"
                        value={additionalInfo}
                        onChange={(e) => setAdditionalInfo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer" style={{ margin: '24px -24px -24px -24px' }}>
                  <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>{checkingDuplicates ? 'Checking for similar reports...' : 'Submitting Issue...'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Submit Issue Report</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
