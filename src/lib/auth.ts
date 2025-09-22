/**
 * 统一认证系统 - 使用 Supabase 匿名认证
 * 替代复杂的设备ID管理系统
 */

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// 从环境变量获取 Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AuthUser {
  id: string;
  isAnonymous: boolean;
  email?: string;
  createdAt: string;
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: AuthUser | null = null;
  private session: Session | null = null;

  private constructor() {
    this.initializeAuth();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 初始化认证系统
   */
  private async initializeAuth() {
    try {
      // 获取当前会话
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.warn('Failed to get session:', error);
        return;
      }

      if (session) {
        this.session = session;
        this.currentUser = this.mapUser(session.user);
        console.log('✅ Existing session found:', this.currentUser.id);
      } else {
        // 自动创建匿名用户
        await this.signInAnonymously();
      }

      // 监听认证状态变化
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('🔐 Auth state changed:', event);
        
        if (session) {
          this.session = session;
          this.currentUser = this.mapUser(session.user);
        } else {
          this.session = null;
          this.currentUser = null;
        }
      });

    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
    }
  }

  /**
   * 匿名登录
   */
  public async signInAnonymously(): Promise<AuthUser> {
    try {
      console.log('🔐 Creating anonymous user...');
      
      const { data, error } = await supabase.auth.signInAnonymously();
      
      if (error) {
        throw new Error(`Anonymous sign-in failed: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('No user returned from anonymous sign-in');
      }

      this.session = data.session;
      this.currentUser = this.mapUser(data.user);
      
      console.log('✅ Anonymous user created:', this.currentUser.id);
      return this.currentUser;

    } catch (error) {
      console.error('❌ Anonymous sign-in failed:', error);
      throw error;
    }
  }

  /**
   * 获取当前用户
   */
  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * 获取当前用户ID
   */
  public getCurrentUserId(): string | null {
    return this.currentUser?.id || null;
  }

  /**
   * 获取当前会话
   */
  public getCurrentSession(): Session | null {
    return this.session;
  }

  /**
   * 确保用户已认证（如果没有则创建匿名用户）
   */
  public async ensureAuthenticated(): Promise<AuthUser> {
    if (this.currentUser) {
      return this.currentUser;
    }

    return await this.signInAnonymously();
  }

  /**
   * 登出
   */
  public async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw new Error(`Sign out failed: ${error.message}`);
      }

      this.session = null;
      this.currentUser = null;
      
      console.log('✅ User signed out');

    } catch (error) {
      console.error('❌ Sign out failed:', error);
      throw error;
    }
  }

  /**
   * 将 Supabase User 映射为 AuthUser
   */
  private mapUser(user: User): AuthUser {
    return {
      id: user.id,
      isAnonymous: user.is_anonymous || false,
      email: user.email,
      createdAt: user.created_at,
    };
  }
}

// 导出单例实例
export const authService = AuthService.getInstance();

// 导出 Supabase 客户端（用于其他服务）
export { supabase };
