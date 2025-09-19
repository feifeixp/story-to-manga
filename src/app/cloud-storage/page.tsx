"use client";

import { useState, useEffect } from 'react';
import { useCloudStorage } from '@/hooks/useCloudStorage';
import { hybridStorage } from '@/lib/hybridStorage';
import DataMigration from '@/components/DataMigration';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, 
  HardDrive, 
  Sync, 
  CheckCircle, 
  AlertCircle, 
  User,
  Settings,
  Database,
  Shield,
  Zap
} from 'lucide-react';

export default function CloudStoragePage() {
  const {
    isAuthenticated,
    user,
    isLoading,
    error,
    syncStatus,
    signOut,
    syncLocalData,
    clearError,
  } = useCloudStorage();

  const [storageStats, setStorageStats] = useState({
    localProjects: 0,
    cloudProjects: 0,
    isUsingCloud: false,
  });

  const [syncProgress, setSyncProgress] = useState({
    isActive: false,
    message: '',
  });

  // 获取存储统计信息
  useEffect(() => {
    const getStorageStats = async () => {
      try {
        const projectList = await hybridStorage.getProjectList();
        const isUsingCloud = hybridStorage.isUsingCloudStorage();
        
        setStorageStats({
          localProjects: projectList.length,
          cloudProjects: isUsingCloud ? projectList.length : 0,
          isUsingCloud,
        });
      } catch (error) {
        console.error('Failed to get storage stats:', error);
      }
    };

    getStorageStats();
  }, [isAuthenticated, syncStatus]);

  const handleSyncData = async () => {
    if (!isAuthenticated) return;

    setSyncProgress({ isActive: true, message: '正在同步数据到云端...' });
    
    try {
      await syncLocalData();
      setSyncProgress({ isActive: false, message: '数据同步完成！' });
      
      // 更新统计信息
      const projectList = await hybridStorage.getProjectList();
      setStorageStats(prev => ({
        ...prev,
        cloudProjects: projectList.length,
      }));
    } catch (error) {
      setSyncProgress({ 
        isActive: false, 
        message: `同步失败: ${error instanceof Error ? error.message : '未知错误'}` 
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setStorageStats(prev => ({
        ...prev,
        cloudProjects: 0,
        isUsingCloud: false,
      }));
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">云存储管理</h1>
          <p className="text-gray-600">
            管理您的漫画项目数据存储，支持本地存储和云端同步
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={clearError}>
                关闭
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* 同步进度提示 */}
        {syncProgress.message && (
          <Alert className={`mb-6 ${syncProgress.isActive ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}>
            {syncProgress.isActive ? (
              <Sync className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <AlertDescription>{syncProgress.message}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 用户状态卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>账户状态</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAuthenticated && user ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <p className="text-sm text-gray-600">
                        {user.user_metadata?.name || '用户'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      已登录
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Shield className="w-4 h-4" />
                    <span>云端数据已加密保护</span>
                  </div>
                  
                  <Button variant="outline" onClick={handleSignOut} className="w-full">
                    退出登录
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-4">未登录，仅使用本地存储</p>
                  <Badge variant="outline">本地模式</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 存储统计卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="w-5 h-5" />
                <span>存储统计</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">本地项目</span>
                  </div>
                  <Badge variant="outline">{storageStats.localProjects}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Cloud className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">云端项目</span>
                  </div>
                  <Badge variant="outline">{storageStats.cloudProjects}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Settings className="w-4 h-4 text-purple-500" />
                    <span className="text-sm">存储模式</span>
                  </div>
                  <Badge variant={storageStats.isUsingCloud ? "default" : "secondary"}>
                    {storageStats.isUsingCloud ? "混合模式" : "本地模式"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 功能特性 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>云存储功能特性</span>
            </CardTitle>
            <CardDescription>
              了解云存储为您带来的便利功能
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Cloud className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">跨设备同步</h4>
                  <p className="text-sm text-gray-600">在任何设备上访问您的漫画项目</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">数据安全</h4>
                  <p className="text-sm text-gray-600">云端加密存储，永不丢失</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Sync className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium">自动备份</h4>
                  <p className="text-sm text-gray-600">项目数据自动同步到云端</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <Database className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium">无限容量</h4>
                  <p className="text-sm text-gray-600">不再受浏览器存储限制</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 数据迁移组件 */}
        <DataMigration />

        {/* 手动同步按钮 */}
        {isAuthenticated && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>手动同步</CardTitle>
              <CardDescription>
                立即将本地数据同步到云端
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSyncData}
                disabled={syncProgress.isActive}
                className="flex items-center space-x-2"
              >
                <Sync className={`w-4 h-4 ${syncProgress.isActive ? 'animate-spin' : ''}`} />
                <span>
                  {syncProgress.isActive ? '同步中...' : '同步到云端'}
                </span>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
