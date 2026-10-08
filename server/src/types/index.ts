export type UserRole = 'student' | 'admin';

export interface User {
  id: number;
  email: string;
  password_hash: string;
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
}

export interface IssueUpdate {
  id: number;
  issue_id: number;
  user_id: number;
  user_name?: string;
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

export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: UserRole;
  fullName: string;
}
