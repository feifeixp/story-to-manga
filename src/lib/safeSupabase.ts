import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageManager } from './storageManager';

/**
 * 安全的 Supabase 客户端包装器
 * 处理 localStorage 配额问题
 */

// 从环境变量获取 Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 验证环境变量是否存在
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

// 自定义存储适配器，支持内存后备存储
class SafeLocalStorage {
  private memoryStorage: Map<string, string> = new Map();
  private usingMemoryStorage = false;

  getItem(key: string): string | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return this.memoryStorage.get(key) || null;
    }

    try {
      // 首先尝试从 localStorage 获取
      const value = localStorage.getItem(key);
      if (value !== null) {
        return value;
      }

      // 如果 localStorage 中没有，检查内存存储
      return this.memoryStorage.get(key) || null;
    } catch (error) {
      console.warn(`Failed to get item from localStorage: ${key}`, error);
      // 回退到内存存储
      return this.memoryStorage.get(key) || null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      // 浏览器环境不可用，使用内存存储
      this.memoryStorage.set(key, value);
      return;
    }

    // 首先尝试使用安全的存储管理器
    const success = StorageManager.safeSetItem(key, value);

    if (success) {
      // 成功存储到 localStorage，清除内存中的副本
      this.memoryStorage.delete(key);
      if (this.usingMemoryStorage) {
        console.log('✅ Restored localStorage functionality');
        this.usingMemoryStorage = false;
      }
      return;
    }

    // localStorage 存储失败，使用内存存储作为后备
    console.warn(`localStorage storage failed for ${key}, using memory storage as fallback`);
    this.memoryStorage.set(key, value);

    if (!this.usingMemoryStorage) {
      this.usingMemoryStorage = true;
      console.log('⚠️ Switched to memory storage due to quota issues');
    }

    // 如果是认证 token，尝试清理但不阻塞
    if (key.includes('auth-token') || key.includes('supabase')) {
      console.log('🧹 Attempting background cleanup for auth token storage...');

      // 异步执行清理，不阻塞当前操作
      setTimeout(() => {
        try {
          StorageManager.performCleanup();

          // 清理后尝试将内存中的数据迁移到 localStorage
          setTimeout(() => {
            this.attemptMigrationToLocalStorage();
          }, 1000);
        } catch (error) {
          console.warn('Background cleanup failed:', error);
        }
      }, 100);
    }
  }

  private attemptMigrationToLocalStorage(): void {
    if (this.memoryStorage.size === 0) return;

    console.log('🔄 Attempting to migrate memory storage back to localStorage...');

    for (const [key, value] of this.memoryStorage.entries()) {
      const success = StorageManager.safeSetItem(key, value);
      if (success) {
        this.memoryStorage.delete(key);
        console.log(`✅ Migrated ${key} back to localStorage`);
      }
    }

    if (this.memoryStorage.size === 0) {
      this.usingMemoryStorage = false;
      console.log('✅ All data successfully migrated back to localStorage');
    }
  }

  removeItem(key: string): void {
    // 从内存存储中删除
    this.memoryStorage.delete(key);

    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove item from localStorage: ${key}`, error);
    }
  }

  // 获取存储状态信息
  getStorageStatus(): { usingMemoryStorage: boolean; memoryItems: number } {
    return {
      usingMemoryStorage: this.usingMemoryStorage,
      memoryItems: this.memoryStorage.size
    };
  }
}

// 创建安全的 Supabase 客户端
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new SafeLocalStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // 减少 token 刷新频率以减少存储压力
    storageKey: 'sb-auth-token', // 使用更短的 key
  },
  global: {
    headers: {
      'X-Client-Info': 'story-to-manga-enhanced'
    }
  }
});

// 获取存储实例以便监控
const storageInstance = new SafeLocalStorage();

// 监听认证状态变化，清理过期数据
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event);

  // 报告存储状态
  const storageStatus = storageInstance.getStorageStatus();
  if (storageStatus.usingMemoryStorage) {
    console.warn(`⚠️ Using memory storage (${storageStatus.memoryItems} items) due to localStorage quota issues`);
  }

  if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
    // 清理可能的过期数据
    setTimeout(() => {
      if (StorageManager.needsCleanup()) {
        StorageManager.performCleanup();
      }
    }, 1000);
  }

  // 记录存储使用情况
  if (typeof window !== 'undefined') {
    console.log('Storage status:', StorageManager.getStorageStats());
  }
});

// 导出认证服务类
export class AuthService {
  // 用户注册
  static async signUp(email: string, password: string, name?: string) {
    try {
      // 在注册前检查存储空间
      if (StorageManager.needsCleanup()) {
        StorageManager.performCleanup();
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0]
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
        message: 'Registration successful! Please check your email for verification.'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  // 用户登录
  static async signIn(email: string, password: string) {
    try {
      // 在登录前检查存储空间
      if (StorageManager.needsCleanup()) {
        StorageManager.performCleanup();
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  // 用户登出
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw new Error(error.message);
      }

      // 登出后清理存储
      setTimeout(() => {
        StorageManager.performCleanup();
      }, 500);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed'
      };
    }
  }

  // 获取当前用户
  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        user
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user'
      };
    }
  }

  // 重置密码
  static async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: 'Password reset email sent'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send reset email'
      };
    }
  }

  // 更新用户资料
  static async updateProfile(updates: { name?: string; avatar?: string }) {
    try {
      // 🚨 重要：头像数据绝对不能存储在JWT token中！
      // 只更新用户名，头像存储在数据库的profiles表中

      const authUpdates: { name?: string } = {};
      if (updates.name) {
        authUpdates.name = updates.name;
      }

      // 只有名称更新才调用auth.updateUser
      let authResult = null;
      if (Object.keys(authUpdates).length > 0) {
        const { data, error } = await supabase.auth.updateUser({
          data: authUpdates
        });

        if (error) {
          throw new Error(error.message);
        }
        authResult = data;
      }

      // 头像单独存储在profiles表中，避免JWT膨胀
      if (updates.avatar !== undefined) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        // 检查头像数据大小，防止意外存储大数据
        if (updates.avatar && updates.avatar.length > 500) {
          console.warn('⚠️ Avatar data is large:', updates.avatar.length, 'characters');

          // 如果是base64数据，拒绝存储
          if (updates.avatar.startsWith('data:image/')) {
            throw new Error('Avatar must be a URL, not base64 data. Please upload to cloud storage first.');
          }
        }

        // 更新profiles表中的头像URL
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            name: updates.name || user.user_metadata?.name || user.email?.split('@')[0],
            avatar_url: updates.avatar,
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          console.warn('Failed to update profile avatar:', profileError);
          // 不抛出错误，因为auth更新可能已经成功
        }
      }

      return {
        success: true,
        user: authResult?.user || null
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update profile'
      };
    }
  }

  // 监听认证状态变化
  static onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}
