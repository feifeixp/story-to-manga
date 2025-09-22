"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/AuthProvider';
import { useI18n } from '@/components/I18nProvider';
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register' | 'reset';

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signIn, signUp, resetPassword, loading } = useAuth();
  const { language } = useI18n();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    setSuccess('');
  };

  const validateForm = () => {
    if (!formData.email) {
      setError(language === 'zh' ? '请输入邮箱地址' : 'Please enter your email');
      return false;
    }

    if (!formData.email.includes('@')) {
      setError(language === 'zh' ? '请输入有效的邮箱地址' : 'Please enter a valid email address');
      return false;
    }

    if (mode !== 'reset' && !formData.password) {
      setError(language === 'zh' ? '请输入密码' : 'Please enter your password');
      return false;
    }

    if (mode === 'register') {
      if (formData.password.length < 6) {
        setError(language === 'zh' ? '密码至少需要6个字符' : 'Password must be at least 6 characters');
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        setError(language === 'zh' ? '密码确认不匹配' : 'Password confirmation does not match');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        const result = await signIn(formData.email, formData.password);
        if (result.success) {
          setSuccess(language === 'zh' ? '登录成功！' : 'Login successful!');
          setTimeout(() => {
            onClose();
            resetForm();
          }, 1000);
        } else {
          setError(result.error || (language === 'zh' ? '登录失败' : 'Login failed'));
        }
      } else if (mode === 'register') {
        const result = await signUp(formData.email, formData.password, formData.name);
        if (result.success) {
          setSuccess(result.message || (language === 'zh' ? '注册成功！请检查邮箱验证' : 'Registration successful! Please check your email'));
          setTimeout(() => {
            setMode('login');
            resetForm();
          }, 2000);
        } else {
          setError(result.error || (language === 'zh' ? '注册失败' : 'Registration failed'));
        }
      } else if (mode === 'reset') {
        const result = await resetPassword(formData.email);
        if (result.success) {
          setSuccess(result.message || (language === 'zh' ? '密码重置邮件已发送' : 'Password reset email sent'));
          setTimeout(() => {
            setMode('login');
            resetForm();
          }, 2000);
        } else {
          setError(result.error || (language === 'zh' ? '密码重置失败' : 'Password reset failed'));
        }
      }
    } catch (error) {
      setError(language === 'zh' ? '操作失败，请重试' : 'Operation failed, please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: ''
    });
    setError('');
    setSuccess('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    resetForm();
    setMode('login');
    onClose();
  };

  const getTitle = () => {
    switch (mode) {
      case 'login':
        return language === 'zh' ? '登录' : 'Login';
      case 'register':
        return language === 'zh' ? '注册' : 'Register';
      case 'reset':
        return language === 'zh' ? '重置密码' : 'Reset Password';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'login':
        return language === 'zh' ? '登录以保存和分享你的作品' : 'Login to save and share your works';
      case 'register':
        return language === 'zh' ? '创建账户开始你的创作之旅' : 'Create an account to start your creative journey';
      case 'reset':
        return language === 'zh' ? '输入邮箱地址重置密码' : 'Enter your email to reset password';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-4 shadow-2xl bg-white border border-gray-200">
        <CardHeader className="space-y-1 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-100">
          <CardTitle className="text-center text-2xl font-bold text-gray-900">{getTitle()}</CardTitle>
          <CardDescription className="text-center text-gray-600">{getDescription()}</CardDescription>
        </CardHeader>
        <CardContent className="bg-white p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱输入 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">
                {language === 'zh' ? '邮箱' : 'Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="pl-10 h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  placeholder={language === 'zh' ? '输入邮箱地址' : 'Enter your email'}
                  required
                />
              </div>
            </div>

            {/* 姓名输入（仅注册时显示） */}
            {mode === 'register' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {language === 'zh' ? '姓名' : 'Name'}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="pl-10 h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    placeholder={language === 'zh' ? '输入你的姓名（可选）' : 'Enter your name (optional)'}
                  />
                </div>
              </div>
            )}

            {/* 密码输入（重置密码时不显示） */}
            {mode !== 'reset' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">
                  {language === 'zh' ? '密码' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10 pr-10 h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    placeholder={language === 'zh' ? '输入密码' : 'Enter your password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* 确认密码输入（仅注册时显示） */}
            {mode === 'register' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {language === 'zh' ? '确认密码' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="pl-10 pr-10 h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                    placeholder={language === 'zh' ? '再次输入密码' : 'Confirm your password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* 错误和成功消息 */}
            {error && (
              <div className="flex items-center space-x-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center space-x-2 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>{success}</span>
              </div>
            )}

            {/* 提交按钮 */}
            <Button
              type="submit"
              className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
              disabled={isSubmitting || loading}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{language === 'zh' ? '处理中...' : 'Processing...'}</span>
                </div>
              ) : (
                getTitle()
              )}
            </Button>

            {/* 模式切换链接 */}
            <div className="text-center space-y-3">
              {mode === 'login' && (
                <>
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
                  >
                    {language === 'zh' ? '还没有账户？立即注册' : "Don't have an account? Sign up"}
                  </button>
                  <br />
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {language === 'zh' ? '忘记密码？' : 'Forgot password?'}
                  </button>
                </>
              )}

              {mode === 'register' && (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
                >
                  {language === 'zh' ? '已有账户？立即登录' : 'Already have an account? Sign in'}
                </button>
              )}

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
                >
                  {language === 'zh' ? '返回登录' : 'Back to login'}
                </button>
              )}
            </div>

            {/* 取消按钮 */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition-colors"
              onClick={handleClose}
            >
              {language === 'zh' ? '取消' : 'Cancel'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
