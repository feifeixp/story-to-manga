import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tairvnwvltidxcscsusl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhaXJ2bnd2bHRpZHhjc2NzdXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjY3MDIsImV4cCI6MjA3Mzc0MjcwMn0.9YU03FVkvHFzhxOiJfrIACiOcK460cN9kT-or641g94'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 用户认证相关类型
export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  created_at?: string
  updated_at?: string
}

// 认证服务类
export class AuthService {
  // 注册新用户
  static async signUp(email: string, password: string, name?: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0], // 如果没有提供名字，使用邮箱前缀
          }
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        success: true,
        user: data.user,
        message: 'Registration successful! Please check your email to verify your account.'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      }
    }
  }

  // 用户登录
  static async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }
    }
  }

  // 用户登出
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw new Error(error.message)
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed'
      }
    }
  }

  // 获取当前用户
  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        throw new Error(error.message)
      }

      return {
        success: true,
        user
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user'
      }
    }
  }

  // 重置密码
  static async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        success: true,
        message: 'Password reset email sent! Please check your inbox.'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password reset failed'
      }
    }
  }

  // 更新用户资料
  static async updateProfile(updates: { name?: string; avatar?: string }) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      })

      if (error) {
        throw new Error(error.message)
      }

      return {
        success: true,
        user: data.user
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Profile update failed'
      }
    }
  }

  // 监听认证状态变化
  static onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }
}
