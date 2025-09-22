// 重新导出安全的 Supabase 客户端和服务
export { supabase, AuthService } from './safeSupabase';

// 用户认证相关类型
export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  created_at?: string
  updated_at?: string
}
