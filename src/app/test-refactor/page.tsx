'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/apiClient';

export default function TestRefactorPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testCreateProject = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('🧪 Testing project creation...');
      
      const projectData = {
        name: `重构测试项目 ${new Date().toLocaleTimeString()}`,
        description: '测试重构后的系统',
        style: 'manga' as const,
      };
      
      const result = await apiClient.createProject(projectData);
      console.log('✅ Project created:', result);
      setResult({ type: 'create', data: result });
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      setResult({ type: 'error', error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  const testGetProjects = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('🧪 Testing get projects...');
      
      const result = await apiClient.getProjects();
      console.log('✅ Projects retrieved:', result);
      setResult({ type: 'list', data: result });
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      setResult({ type: 'error', error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  const testHealthCheck = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('🧪 Testing health check...');
      
      const result = await apiClient.healthCheck();
      console.log('✅ Health check:', result);
      setResult({ type: 'health', data: result });
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      setResult({ type: 'error', error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          🧪 重构系统测试
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">API 测试</h2>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={testHealthCheck}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? '测试中...' : '健康检查'}
            </button>
            
            <button
              onClick={testGetProjects}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '测试中...' : '获取项目列表'}
            </button>
            
            <button
              onClick={testCreateProject}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? '测试中...' : '创建项目'}
            </button>
          </div>
          
          <div className="text-sm text-gray-600 mb-4">
            <p>✅ 已清理50+测试页面</p>
            <p>✅ 已统一认证系统（简化版本）</p>
            <p>✅ 已简化存储架构（只保留Supabase）</p>
            <p>✅ 已统一API调用（使用apiClient）</p>
          </div>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">测试结果</h2>
            
            {result.type === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">测试失败</p>
                <p className="text-red-600 text-sm mt-1">{result.error}</p>
              </div>
            )}
            
            {result.type === 'health' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">健康检查通过</p>
                <pre className="bg-gray-100 p-2 rounded mt-2 text-sm overflow-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
            
            {result.type === 'list' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium">
                  找到 {result.data.total} 个项目
                </p>
                <pre className="bg-gray-100 p-2 rounded mt-2 text-sm overflow-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
            
            {result.type === 'create' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-800 font-medium">
                  项目创建成功: {result.data.project?.name}
                </p>
                <pre className="bg-gray-100 p-2 rounded mt-2 text-sm overflow-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
