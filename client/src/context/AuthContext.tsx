import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { api, removeToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; full_name: string; role?: 'student' | 'admin'; department?: string; phone?: string }) => Promise<void>;
  logout: () => void;
  quickDemoLogin: (role: 'student' | 'admin') => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      const res = await api.auth.getMe();
      setUser(res.user);
    } catch (err) {
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('cf_token');
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    setUser(res.user);
  };

  const register = async (data: { email: string; password: string; full_name: string; role?: 'student' | 'admin'; department?: string; phone?: string }) => {
    const res = await api.auth.register(data);
    setUser(res.user);
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  const quickDemoLogin = async (role: 'student' | 'admin') => {
    if (role === 'student') {
      await login('student@campusfix.edu', 'student123');
    } else {
      await login('admin@campusfix.edu', 'admin123');
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchCurrentUser();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        quickDemoLogin,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
