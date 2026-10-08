export type UserRole = 'student' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
  phone?: string;
  avatar?: string;
  created_at: string;
}

export type IssueStatus = 'pending' | 'acknowledged' | 'in_progress' | 'resolved' | 'reopened' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface Issue {
  id: number;
  issue_code: string;
  student_id: number;
  student_name?: string;
  student_email?: string;
  category: string;
  title: string;
  description: string;
  image_url: string;
  ai_detected_category?: string;
  ai_confidence?: number;
  priority: IssuePriority;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  status: IssueStatus;
  assigned_to?: number | null;
  assigned_name?: string | null;
  resolution_notes?: string | null;
  resolution_image_url?: string | null;
  additional_info?: string | null;
  created_at: string;
  updated_at: string;
  updates?: IssueUpdate[];
}

export interface IssueUpdate {
  id: number;
  issue_id: number;
  user_id: number;
  user_name?: string;
  user_role?: UserRole;
  action: string;
  old_status?: IssueStatus | null;
  new_status?: IssueStatus | null;
  notes?: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  issue_id?: number | null;
  issue_code?: string | null;
  title: string;
  message: string;
  type: 'status_change' | 'assignment' | 'resolution' | 'reopen' | 'system';
  is_read: number; // 0 or 1
  created_at: string;
}

export interface CampusLocation {
  id: number;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  description: string;
}

export interface AIAnalysisResult {
  detectedIssue: string;
  suggestedCategory: string;
  suggestedPriority: IssuePriority;
  confidence: number;
  summary: string;
  provider: 'gemini' | 'heuristic';
}

export interface StatsSummary {
  totalIssues: number;
  pending: number;
  acknowledged: number;
  inProgress: number;
  resolved: number;
  critical: number;
  resolutionRate: number;
  avgResolutionDays: number;
  mostReported: string;
}

export interface CampusStats {
  summary: StatsSummary;
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byLocation: { location: string; count: number }[];
  timeline: { date: string; count: number }[];
  resolutionTrend: { date: string; avgDays: number }[];
}

export interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  department: string | null;
}
