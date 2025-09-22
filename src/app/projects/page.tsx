'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectManager } from '@/components/ProjectManager';
import { ArrowLeft } from 'lucide-react';

export default function ProjectsPage() {
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    // 跳转到创作页面，并传递项目ID
    router.push(`/app?projectId=${projectId}`);
  };

  const handleNewProject = () => {
    console.log('✨ New project created');
    // 新项目创建后的逻辑可以在这里添加
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  // 直接显示项目管理界面（无需认证）
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={handleBackToHome}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">项目管理</h1>
              <p className="text-gray-600 mt-1">选择一个项目开始创作，或创建新项目</p>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            匿名用户模式
          </div>
        </div>

        {/* 项目管理组件 */}
        <div className="bg-white rounded-lg shadow-lg">
          <ProjectManager
            onProjectSelect={handleProjectSelect}
            onNewProject={handleNewProject}
            showCreateButton={true}
            showSelectButton={true}
          />
        </div>

        {/* 使用说明 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            📝 使用说明
          </h3>
          <ul className="text-blue-800 space-y-1 text-sm">
            <li>• 选择现有项目继续创作，或点击"新建项目"创建新的漫画项目</li>
            <li>• 每个项目都会保存您的故事内容、角色设定和生成的漫画面板</li>
            <li>• 点击项目卡片上的"开始创作"按钮进入创作界面</li>
            <li>• 您可以随时返回项目管理页面切换项目</li>
            <li>• 当前使用匿名模式，项目数据保存在云端</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
