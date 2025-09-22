"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/AuthProvider';
import { useI18n } from '@/components/I18nProvider';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Camera,
  Save,
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  Home,
  PlusCircle
} from 'lucide-react';

export default function ProfilePage() {
  const { user, updateProfile, loading: authLoading } = useAuth();
  const { language } = useI18n();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    avatar: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  // 初始化表单数据
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        avatar: user.avatar || ''
      });
      setAvatarPreview(user.avatar || '');
    }
  }, [user]);

  // 如果用户未登录，重定向到首页
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 检查文件大小 (最大 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setMessage({
          type: 'error',
          text: language === 'zh' ? '头像文件大小不能超过 2MB' : 'Avatar file size cannot exceed 2MB'
        });
        return;
      }

      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        setMessage({
          type: 'error',
          text: language === 'zh' ? '请选择图片文件' : 'Please select an image file'
        });
        return;
      }

      setAvatarFile(file);
      
      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    try {
      // 将文件转换为base64用于上传
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 使用云存储API上传头像
      const { cloudStorage } = await import('@/lib/cloudStorage');

      const uploadResult = await cloudStorage.uploadFiles([{
        data: base64Data,
        name: `avatar_${Date.now()}.${file.type.split('/')[1]}`,
        type: file.type,
        category: 'avatar',
        isPublic: false
      }]);

      if (uploadResult.length > 0) {
        // 返回云存储URL而不是base64数据
        return uploadResult[0].url;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Avatar upload failed:', error);
      // 如果上传失败，生成一个placeholder URL而不是base64
      const firstLetter = (user?.name || user?.email || 'U')[0].toUpperCase();
      return `https://via.placeholder.com/120x120/6366F1/FFFFFF?text=${firstLetter}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setMessage(null);

    try {
      let avatarUrl = formData.avatar;

      // 如果有新的头像文件，先上传
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile);
      }

      // 更新用户资料
      const result = await updateProfile({
        name: formData.name,
        avatar: avatarUrl
      });

      if (result.success) {
        setMessage({
          type: 'success',
          text: language === 'zh' ? '个人资料更新成功！' : 'Profile updated successfully!'
        });
        setAvatarFile(null);
      } else {
        setMessage({
          type: 'error',
          text: result.error || (language === 'zh' ? '更新失败，请重试' : 'Update failed, please try again')
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: language === 'zh' ? '更新失败，请重试' : 'Update failed, please try again'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            {/* 导航按钮 */}
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{language === 'zh' ? '返回' : 'Back'}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="flex items-center space-x-2"
              >
                <Home className="h-4 w-4" />
                <span>{language === 'zh' ? '首页' : 'Home'}</span>
              </Button>
              <Button
                onClick={() => router.push('/app')}
                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <PlusCircle className="h-4 w-4" />
                <span>{language === 'zh' ? '开始创作' : 'Start Creating'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">
              {language === 'zh' ? '个人设置' : 'Profile Settings'}
            </h1>
            <p className="text-purple-100 mt-1">
              {language === 'zh' 
                ? '管理你的个人信息和偏好设置' 
                : 'Manage your personal information and preferences'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-100">
              <CardTitle className="flex items-center space-x-2 text-gray-900">
                <User className="h-5 w-5" />
                <span>{language === 'zh' ? '个人信息' : 'Personal Information'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              {/* 消息提示 */}
              {message && (
                <div className={`mb-6 p-4 rounded-lg border ${
                  message.type === 'success' 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-center space-x-2">
                    {message.type === 'success' ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                    <span className="font-medium">{message.text}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 头像设置 */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <img
                      src={avatarPreview || user.avatar || "https://via.placeholder.com/120x120/6366F1/FFFFFF?text=U"}
                      alt={language === 'zh' ? '用户头像' : 'User Avatar'}
                      className="w-24 h-24 rounded-full border-4 border-gray-200 object-cover"
                    />
                    <label className="absolute bottom-0 right-0 bg-purple-600 text-white rounded-full p-2 cursor-pointer hover:bg-purple-700 transition-colors">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-sm text-gray-600 text-center">
                    {language === 'zh' 
                      ? '点击相机图标更换头像（最大 2MB）' 
                      : 'Click camera icon to change avatar (max 2MB)'
                    }
                  </p>
                </div>

                {/* 姓名输入 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-800">
                    {language === 'zh' ? '姓名' : 'Name'}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="pl-10 h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500 bg-white text-gray-900"
                      placeholder={language === 'zh' ? '输入你的姓名' : 'Enter your name'}
                      required
                    />
                  </div>
                </div>

                {/* 邮箱显示（只读） */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-800">
                    {language === 'zh' ? '邮箱' : 'Email'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      value={formData.email}
                      className="pl-10 h-11 border-gray-300 bg-gray-50 text-gray-600"
                      disabled
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {language === 'zh' ? '邮箱地址无法修改' : 'Email address cannot be changed'}
                  </p>
                </div>

                {/* 提交按钮 */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    {language === 'zh' ? '取消' : 'Cancel'}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdating}
                    className="min-w-[120px] bg-purple-600 hover:bg-purple-700"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {language === 'zh' ? '保存中...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {language === 'zh' ? '保存更改' : 'Save Changes'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
