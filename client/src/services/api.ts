import type { Issue, Notification, CampusLocation, CampusStats, User, AdminUser, AIAnalysisResult, PotentialDuplicateIssue } from '../types';

const API_BASE = '/api';

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly data: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    data: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.data = data;
  }
}

function getToken(): string | null {
  return localStorage.getItem('cf_token');
}

export function setToken(token: string) {
  localStorage.setItem('cf_token', token);
}

export function removeToken() {
  localStorage.removeItem('cf_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set Content-Type only if not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    throw new ApiRequestError(errorMsg, response.status, data);
  }

  return data as T;
}

export const api = {
  auth: {
    login: async (credentials: { email: string; password: string }) => {
      const res = await request<{ message: string; token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      setToken(res.token);
      return res;
    },
    register: async (userData: { email: string; password: string; full_name: string; role?: 'student' | 'admin'; department?: string; phone?: string }) => {
      const res = await request<{ message: string; token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      setToken(res.token);
      return res;
    },
    getMe: () => request<{ user: User }>('/auth/me'),
    getAdmins: () => request<{ admins: AdminUser[] }>('/auth/admins'),
    updateProfile: (profileData: { full_name: string; department?: string; phone?: string }) =>
      request<{ message: string; user: User }>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      }),
  },

  issues: {
    getAll: (params?: {
      status?: string;
      priority?: string;
      category?: string;
      search?: string;
      mine?: boolean;
    }) => {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.priority) query.append('priority', params.priority);
      if (params?.category) query.append('category', params.category);
      if (params?.search) query.append('search', params.search);
      if (params?.mine) query.append('mine', 'true');

      const qs = query.toString();
      return request<{ issues: Issue[]; total: number }>(`/issues${qs ? `?${qs}` : ''}`);
    },

    getById: (id: number) => request<{ issue: Issue }>(`/issues/${id}`),

    checkDuplicates: (candidate: {
      title: string;
      description: string;
      category: string;
      location_name: string;
      latitude: number | null;
      longitude: number | null;
    }) =>
      request<{
        potentialMatches: PotentialDuplicateIssue[];
        confirmationToken?: string;
      }>('/issues/check-duplicates', {
        method: 'POST',
        body: JSON.stringify(candidate),
      }),

    create: (formData: FormData) =>
      request<{ message: string; issue: Issue }>('/issues', {
        method: 'POST',
        body: formData,
      }),

    updateStatus: (id: number, status: string, notes?: string) =>
      request<{ message: string; issue: Issue }>(`/issues/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      }),

    updatePriority: (id: number, priority: string, notes?: string) =>
      request<{ message: string; issue: Issue }>(`/issues/${id}/priority`, {
        method: 'PATCH',
        body: JSON.stringify({ priority, notes }),
      }),

    updateCategory: (id: number, category: string, notes?: string) =>
      request<{ message: string; issue: Issue }>(`/issues/${id}/category`, {
        method: 'PATCH',
        body: JSON.stringify({ category, notes }),
      }),

    assign: (id: number, assigned_to: number | null, notes?: string) =>
      request<{ message: string; issue: Issue }>(`/issues/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ assigned_to, notes }),
      }),

    addNotes: (id: number, notes: string) =>
      request<{ message: string; issue: Issue }>(`/issues/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),

    resolve: (id: number, formData: FormData) =>
      request<{ message: string; issue: Issue }>(`/issues/${id}/resolve`, {
        method: 'POST',
        body: formData,
      }),

    reopen: (id: number, notes?: string) =>
      request<{ message: string; issue: Issue }>(`/issues/${id}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
  },

  ai: {
    classify: (formData: FormData) =>
      request<{
        success: boolean;
        imageUrl?: string;
        filename?: string;
        analysis: AIAnalysisResult;
        warning?: string;
      }>('/ai/classify', {
        method: 'POST',
        body: formData,
      }),
  },

  locations: {
    getAll: () => request<{ locations: CampusLocation[] }>('/locations'),
  },

  stats: {
    getStats: (params?: { range?: string; startDate?: string; endDate?: string }) => {
      const query = new URLSearchParams();
      if (params?.range) query.append('range', params.range);
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);
      const qs = query.toString();
      return request<CampusStats>(`/stats${qs ? `?${qs}` : ''}`);
    },
  },

  notifications: {
    getAll: () => request<{ notifications: Notification[]; unreadCount: number }>('/notifications'),
    markRead: (id: number) =>
      request<{ success: boolean; unreadCount: number }>(`/notifications/${id}/read`, {
        method: 'PATCH',
      }),
    markAllRead: () =>
      request<{ success: boolean; unreadCount: number }>('/notifications/mark-all-read', {
        method: 'POST',
      }),
    delete: (id: number) =>
      request<{ success: boolean; unreadCount: number }>(`/notifications/${id}`, {
        method: 'DELETE',
      }),
  },
};
