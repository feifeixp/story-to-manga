"use client";

import { useState, useEffect } from 'react';
import { useSimpleCloudStorage } from '@/hooks/useCloudStorage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Upload, Download, RefreshCw } from 'lucide-react';

interface MigrationStatus {
  phase: 'idle' | 'checking' | 'migrating' | 'complete' | 'error';
  progress: number;
  currentProject?: string;
  totalProjects: number;
  migratedProjects: number;
  errors: string[];
  message?: string;
}

interface LocalProjectInfo {
  id: string;
  name: string;
  hasData: boolean;
  dataSize: number;
  lastModified: Date;
}

export default function DataMigration() {
  const { isAuthenticated, user } = useSimpleCloudStorage();
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    phase: 'idle',
    progress: 0,
    totalProjects: 0,
    migratedProjects: 0,
    errors: [],
  });
  const [localProjects, setLocalProjects] = useState<LocalProjectInfo[]>([]);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });

  // 检查本地数据
  useEffect(() => {
    checkLocalData();
  }, []);

  const checkLocalData = async () => {
    setMigrationStatus(prev => ({ ...prev, phase: 'checking', message: '检查本地数据...' }));

    try {
      const projects: LocalProjectInfo[] = [];
      
      // 检查localStorage中的项目列表
      const projectListKey = 'manga-projects-list';
      const storedList = localStorage.getItem(projectListKey);
      
      if (storedList) {
        const projectList = JSON.parse(storedList);
        
        for (const project of projectList) {
          const projectId = project.metadata.id;
          const projectKey = `manga-project-${projectId}`;
          const projectData = localStorage.getItem(projectKey);
          
          if (projectData) {
            const data = JSON.parse(projectData);
            const dataSize = new Blob([projectData]).size;
            
            projects.push({
              id: projectId,
              name: project.metadata.name,
              hasData: true,
              dataSize,
              lastModified: new Date(data.timestamp || project.metadata.updatedAt),
            });
          }
        }
      }

      // 检查旧版本的单项目数据
      const oldDataKeys = ['story-state', 'story-analysis', 'story-breakdown'];
      let hasOldData = false;
      
      for (const key of oldDataKeys) {
        if (localStorage.getItem(key)) {
          hasOldData = true;
          break;
        }
      }

      if (hasOldData) {
        projects.push({
          id: 'legacy-project',
          name: '旧版本项目数据',
          hasData: true,
          dataSize: 0,
          lastModified: new Date(),
        });
      }

      setLocalProjects(projects);
      setMigrationStatus(prev => ({
        ...prev,
        phase: 'idle',
        totalProjects: projects.length,
        message: projects.length > 0 ? `发现 ${projects.length} 个本地项目` : '未发现本地数据',
      }));

    } catch (error) {
      setMigrationStatus(prev => ({
        ...prev,
        phase: 'error',
        errors: [error instanceof Error ? error.message : '检查本地数据失败'],
      }));
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 简化的认证处理 - 引导用户到主页面认证
      setShowAuthForm(false);
      setMigrationStatus(prev => ({
        ...prev,
        message: '请先在主页面完成用户认证，然后返回此页面进行数据迁移。'
      }));
    } catch (error) {
      setMigrationStatus(prev => ({
        ...prev,
        errors: [error instanceof Error ? error.message : '认证失败'],
      }));
    }
  };

  const startMigration = async () => {
    if (!isAuthenticated) {
      setShowAuthForm(true);
      return;
    }

    setMigrationStatus(prev => ({
      ...prev,
      phase: 'migrating',
      progress: 0,
      migratedProjects: 0,
      errors: [],
      message: '开始迁移数据...',
    }));

    try {
      // 模拟迁移过程
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setMigrationStatus(prev => ({
          ...prev,
          progress: i,
          message: `迁移进度: ${i}%`,
        }));
      }

      setMigrationStatus(prev => ({
        ...prev,
        phase: 'complete',
        progress: 100,
        migratedProjects: prev.totalProjects,
        message: '数据迁移功能正在开发中，请稍后再试。',
      }));

    } catch (error) {
      setMigrationStatus(prev => ({
        ...prev,
        phase: 'error',
        errors: [error instanceof Error ? error.message : '迁移失败'],
      }));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (localProjects.length === 0 && migrationStatus.phase === 'idle') {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">无需迁移</h3>
          <p className="text-gray-600">未发现需要迁移的本地数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 认证表单 */}
      {showAuthForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {authMode === 'signin' ? '登录账户' : '注册账户'}
            </h3>
            
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">邮箱</label>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">密码</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              
              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium mb-1">姓名（可选）</label>
                  <input
                    type="text"
                    value={authForm.name}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              )}
              
              <div className="flex space-x-3">
                <Button type="submit" className="flex-1">
                  {authMode === 'signin' ? '登录' : '注册'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAuthForm(false)}
                >
                  取消
                </Button>
              </div>
            </form>
            
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
                className="text-sm text-blue-600 hover:underline"
              >
                {authMode === 'signin' ? '没有账户？注册' : '已有账户？登录'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 迁移状态 */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="flex items-center space-x-3 mb-4">
          <Upload className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-semibold">数据迁移到云端</h2>
        </div>

        {/* 本地项目列表 */}
        {localProjects.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">本地项目</h3>
            <div className="space-y-2">
              {localProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <div className="font-medium">{project.name}</div>
                    <div className="text-sm text-gray-600">
                      {formatFileSize(project.dataSize)} • 
                      最后修改: {project.lastModified.toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-green-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 迁移进度 */}
        {migrationStatus.phase === 'migrating' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">迁移进度</span>
              <span className="text-sm text-gray-600">
                {migrationStatus.migratedProjects} / {migrationStatus.totalProjects}
              </span>
            </div>
            <Progress value={migrationStatus.progress} className="w-full" />
            {migrationStatus.currentProject && (
              <p className="text-sm text-gray-600 mt-2">
                正在迁移: {migrationStatus.currentProject}
              </p>
            )}
          </div>
        )}

        {/* 状态消息 */}
        {migrationStatus.message && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{migrationStatus.message}</AlertDescription>
          </Alert>
        )}

        {/* 错误信息 */}
        {migrationStatus.errors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {migrationStatus.errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 操作按钮 */}
        <div className="flex space-x-3">
          <Button
            onClick={startMigration}
            disabled={migrationStatus.phase === 'migrating' || localProjects.length === 0}
            className="flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>
              {migrationStatus.phase === 'migrating' ? '迁移中...' : '开始迁移'}
            </span>
          </Button>
          
          <Button
            variant="outline"
            onClick={checkLocalData}
            disabled={migrationStatus.phase === 'migrating'}
          >
            重新检查
          </Button>
        </div>

        {/* 用户状态 */}
        {isAuthenticated && user && (
          <div className="mt-4 p-3 bg-green-50 rounded-md">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-800">
                已登录: {user.email}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
