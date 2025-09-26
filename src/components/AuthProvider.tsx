"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService, User, supabase } from '@/lib/supabase';
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

  // 将认证状态暴露到全局，供其他模块使用
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__authContext = {
        user,
        session,
        loading
      };
    }
  }, [user, session, loading]);

  useEffect(() => {
    // 获取初始用户状态和会话
    const getInitialState = async () => {
      try {
        // 同时获取用户和会话
        const { supabase } = await import('@/lib/safeSupabase');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error getting session:', sessionError);
        } else if (session) {
          console.log('✅ Initial session found:', session.user.email);
          setSession(session);

          // 从会话中设置用户信息，但头像从数据库获取
          const userData: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.['name'] || session.user.email?.split('@')[0],
            avatar: `https://via.placeholder.com/40x40/6366F1/FFFFFF?text=${(session.user.user_metadata?.['name'] || session.user.email?.split('@')[0] || 'U')[0].toUpperCase()}`, // 默认头像，稍后从数据库更新
            created_at: session.user.created_at
          };

          // 从profiles表获取真实头像
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('avatar_url')
              .eq('id', session.user.id)
              .single();

            if (profile?.avatar_url) {
              userData.avatar = profile.avatar_url;
            }
          } catch (error) {
            console.warn('Failed to load user avatar from profiles:', error);
          }
          if (session.user.updated_at) {
            userData.updated_at = session.user.updated_at;
          }
          setUser(userData);
        } else {
          console.log('❌ No initial session found');
          // 如果没有会话，尝试获取用户（可能是过期的会话）
          const result = await AuthService.getCurrentUser();
          if (result.success && result.user) {
            const userData: User = {
              id: result.user.id,
              email: result.user.email || '',
              name: result.user.user_metadata?.['name'] || result.user.email?.split('@')[0],
              avatar: `https://via.placeholder.com/40x40/6366F1/FFFFFF?text=${(result.user.user_metadata?.['name'] || result.user.email?.split('@')[0] || 'U')[0].toUpperCase()}`,
              created_at: result.user.created_at
            };

            // 从profiles表获取真实头像
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('avatar_url')
                .eq('id', result.user.id)
                .single();

              if (profile?.avatar_url) {
                userData.avatar = profile.avatar_url;
              }
            } catch (error) {
              console.warn('Failed to load user avatar from profiles:', error);
            }
            if (result.user.updated_at) {
              userData.updated_at = result.user.updated_at;
            }
            setUser(userData);
          }
        }
      } catch (error) {
        console.error('Error getting initial state:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialState();

    // 监听认证状态变化
    const { data: { subscription } } = AuthService.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session);

      setSession(session);

      if (session?.user) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.['name'] || session.user.email?.split('@')[0],
          avatar: `https://via.placeholder.com/40x40/6366F1/FFFFFF?text=${(session.user.user_metadata?.['name'] || session.user.email?.split('@')[0] || 'U')[0].toUpperCase()}`,
          created_at: session.user.created_at
        };

        // 从profiles表获取真实头像
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', session.user.id)
            .single();

          if (profile?.avatar_url) {
            userData.avatar = profile.avatar_url;
          }
        } catch (error) {
          console.warn('Failed to load user avatar from profiles:', error);
        }
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
    if (result.success) {
      // 更新本地用户状态，头像从updates中获取而不是从JWT
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.avatar !== undefined && { avatar: updates.avatar })
        };
      });
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
