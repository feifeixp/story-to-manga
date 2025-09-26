import { useState, useEffect, useCallback } from 'react';
import { projectService } from '@/lib/projectService';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { ComicStyle } from "@/types";

/**
 * 简化的云存储Hook - 使用新的项目服务
 */
interface CloudStorageState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

interface ProjectData {
  id: string;
  name: string;
  description?: string;
  style: ComicStyle;
  createdAt: string;
  updatedAt: string;
}

export function useSimpleCloudStorage() {
  const [state, setState] = useState<CloudStorageState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
  });

  // 检查认证状态
  const checkAuth = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }

      setState(prev => ({
        ...prev,
        isAuthenticated: !!session,
        user: session?.user || null,
        isLoading: false,
        error: null,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      }));
    }
  }, []);

  // 创建项目
  const createProject = useCallback(async (data: {
    name: string;
    description?: string;
    style: ComicStyle;
  }): Promise<ProjectData | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const project = await projectService.createProject(data);
      
      setState(prev => ({ ...prev, isLoading: false }));
      return project;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create project',
      }));
      return null;
    }
  }, []);

  // 获取项目列表
  const getProjects = useCallback(async (): Promise<ProjectData[]> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const projects = await projectService.getProjects();
      
      setState(prev => ({ ...prev, isLoading: false }));
      return projects;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get projects',
      }));
      return [];
    }
  }, []);

  // 获取单个项目
  const getProject = useCallback(async (projectId: string): Promise<ProjectData | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const project = await projectService.getProject(projectId);
      
      setState(prev => ({ ...prev, isLoading: false }));
      return project;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get project',
      }));
      return null;
    }
  }, []);

  // 更新项目
  const updateProject = useCallback(async (
    projectId: string,
    data: {
      name?: string;
      description?: string;
      style?: ComicStyle;
    }
  ): Promise<ProjectData | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const project = await projectService.updateProject(projectId, data);
      
      setState(prev => ({ ...prev, isLoading: false }));
      return project;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update project',
      }));
      return null;
    }
  }, []);

  // 删除项目
  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await projectService.deleteProject(projectId);
      
      setState(prev => ({ ...prev, isLoading: false }));
      return true;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete project',
      }));
      return false;
    }
  }, []);

  // 清除错误
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 初始化
  useEffect(() => {
    checkAuth();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setState(prev => ({
        ...prev,
        isAuthenticated: !!session,
        user: session?.user || null,
        isLoading: false,
      }));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAuth]);

  return {
    // 状态
    ...state,
    
    // 方法
    checkAuth,
    createProject,
    getProjects,
    getProject,
    updateProject,
    deleteProject,
    clearError,
  };
}
