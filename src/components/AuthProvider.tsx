"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService, User } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  updateProfile: (updates: { name?: string; avatar?: string }) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取初始用户状态
    const getInitialUser = async () => {
      try {
        const result = await AuthService.getCurrentUser();
        if (result.success && result.user) {
          const userData: User = {
            id: result.user.id,
            email: result.user.email || '',
            name: result.user.user_metadata?.['name'] || result.user.email?.split('@')[0],
            avatar: result.user.user_metadata?.['avatar'] || `https://via.placeholder.com/40x40/6366F1/FFFFFF?text=${(result.user.user_metadata?.['name'] || result.user.email?.split('@')[0] || 'U')[0].toUpperCase()}`,
            created_at: result.user.created_at
          };
          if (result.user.updated_at) {
            userData.updated_at = result.user.updated_at;
          }
          setUser(userData);
        }
      } catch (error) {
        console.error('Error getting initial user:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialUser();

    // 监听认证状态变化
    const { data: { subscription } } = AuthService.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session);
      
      setSession(session);
      
      if (session?.user) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.['name'] || session.user.email?.split('@')[0],
          avatar: session.user.user_metadata?.['avatar'] || `https://via.placeholder.com/40x40/6366F1/FFFFFF?text=${(session.user.user_metadata?.['name'] || session.user.email?.split('@')[0] || 'U')[0].toUpperCase()}`,
          created_at: session.user.created_at
        };
        if (session.user.updated_at) {
          userData.updated_at = session.user.updated_at;
        }
        setUser(userData);
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await AuthService.signIn(email, password);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    setLoading(true);
    try {
      const result = await AuthService.signUp(email, password, name);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const result = await AuthService.signOut();
      if (result.success) {
        setUser(null);
        setSession(null);
      }
      return result;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    return await AuthService.resetPassword(email);
  };

  const updateProfile = async (updates: { name?: string; avatar?: string }) => {
    const result = await AuthService.updateProfile(updates);
    if (result.success && result.user) {
      setUser(prev => prev ? {
        ...prev,
        name: result.user.user_metadata?.['name'] || prev.name,
        avatar: result.user.user_metadata?.['avatar'] || prev.avatar
      } : null);
    }
    return result;
  };

  const contextValue: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
