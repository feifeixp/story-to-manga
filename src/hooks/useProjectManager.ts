/**
 * 项目管理 Hook
 * 负责项目的创建、加载、保存、选择等核心功能
 */
import { useCallback, useRef, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { ComicStyle } from '@/types';

interface ProjectData {
  id: string;
  name: string;
  story: string;
  style: ComicStyle;
  storyAnalysis?: any;
  storyBreakdown?: any;
  characterReferences?: any[];
  generatedPanels?: any[];
  uploadedCharacterReferences?: any[];
  uploadedSettingReferences?: any[];
  imageSize?: any;
  aiModel?: string;
  generationState?: any;
}

export const useProjectManager = () => {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(false);

  // 防止重复请求的缓存
  const loadingProjectsRef = useRef<Set<string>>(new Set());
  // 防止重复创建项目的锁
  const creatingProjectRef = useRef<boolean>(false);
  const projectSelectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 保存项目数据
  const saveProjectData = useCallback(async (
    projectId: string,
    story: string,
    style: ComicStyle,
    storyAnalysis: any,
    storyBreakdown: any,
    characterReferences: any[],
    generatedPanels: any[],
    uploadedCharacterReferences: any[],
    uploadedSettingReferences: any[],
    imageSize?: any,
    tags?: string[],
    currentGenerationState?: any
  ) => {
    try {
      console.log('💾 Saving complete project data to cloud:', projectId);

      // 1. 更新项目基本信息
      await apiClient.updateProject(projectId, {
        name: story.split('\n')[0]?.replace(/^#\s*/, '') || 'Untitled Project',
        description: story.substring(0, 200) + (story.length > 200 ? '...' : ''),
        style,
      });

      // 2. 保存完整项目数据
      const completeData = {
        projectId,
        story,
        style,
        storyAnalysis,
        storyBreakdown,
        characterReferences: characterReferences || [],
        generatedPanels: generatedPanels || [],
        uploadedCharacterReferences: uploadedCharacterReferences || [],
        uploadedSettingReferences: uploadedSettingReferences || [],
        imageSize,
        tags: tags || [],
        aiModel: 'auto',
        generationState: currentGenerationState || null,
        metadata: {
          lastSaved: new Date().toISOString(),
          version: '2.0',
          panelCount: generatedPanels?.length || 0,
          characterCount: characterReferences?.length || 0,
          wordCount: story.split(/\s+/).filter(word => word.length > 0).length,
        }
      };

      const response = await fetch('/api/project-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save project data: ${response.statusText}`);
      }

      console.log('✅ Complete project data saved successfully');
    } catch (error) {
      console.error('❌ Failed to save project data:', error);
      throw error;
    }
  }, []);

  // 加载项目数据
  const loadProjectData = useCallback(async (projectId: string): Promise<ProjectData | null> => {
    // 防止重复请求
    if (loadingProjectsRef.current.has(projectId)) {
      console.log(`⏳ Project ${projectId} is already being loaded, skipping duplicate request`);
      return null;
    }

    try {
      loadingProjectsRef.current.add(projectId);
      console.log('📂 Loading complete project data from cloud:', projectId);

      // 1. 加载项目基本信息
      const projectResponse = await apiClient.getProject(projectId);
      if (!projectResponse.success || !projectResponse.project) {
        throw new Error('Project not found');
      }

      // 2. 加载完整项目数据
      const dataResponse = await fetch(`/api/project-storage?projectId=${projectId}`);
      if (!dataResponse.ok) {
        throw new Error(`Failed to load project data: ${dataResponse.statusText}`);
      }

      const dataResult = await dataResponse.json();
      if (!dataResult.success) {
        throw new Error(dataResult.error || 'Failed to load project data');
      }

      const completeData = {
        ...projectResponse.project,
        ...dataResult.data,
      };

      console.log('✅ Complete project data loaded successfully');
      return completeData;
    } catch (error) {
      console.error('❌ Failed to load project data:', error);
      throw error;
    } finally {
      // 清理缓存，允许后续请求
      loadingProjectsRef.current.delete(projectId);
    }
  }, []);

  // 防抖的项目选择函数
  const debouncedProjectSelect = useCallback((projectId: string, onSuccess: (data: ProjectData) => void) => {
    // 清除之前的定时器
    if (projectSelectTimeoutRef.current) {
      clearTimeout(projectSelectTimeoutRef.current);
    }

    // 设置新的定时器
    projectSelectTimeoutRef.current = setTimeout(async () => {
      try {
        setIsLoadingState(true);
        console.log(`🔄 Selecting project: ${projectId}`);

        const projectData = await loadProjectData(projectId);

        // 如果返回null，说明请求被跳过（重复请求），直接返回
        if (!projectData) {
          console.log('⏳ Project loading skipped (duplicate request)');
          return;
        }

        setCurrentProjectId(projectId);
        onSuccess(projectData);
        
        console.log('✅ Complete project selection completed successfully');
      } catch (error) {
        console.error("❌ Failed to select project:", error);
        setCurrentProjectId(null);
      } finally {
        setIsLoadingState(false);
      }
    }, 300); // 300ms 防抖
  }, [loadProjectData]);

  // 创建新项目（带锁机制）
  const createProject = useCallback(async (name: string, description: string, style: ComicStyle = 'manga') => {
    // 防止重复创建
    if (creatingProjectRef.current) {
      console.log('⏳ Project creation already in progress, skipping duplicate request');
      throw new Error('Project creation already in progress');
    }

    try {
      creatingProjectRef.current = true;
      console.log('📝 Creating new project:', name);

      const response = await apiClient.createProject({
        name: name.trim(),
        description: description.trim(),
        style
      });

      if (!response.success) {
        throw new Error('Failed to create project');
      }

      const projectId = response.project.id;
      setCurrentProjectId(projectId);

      // 保存到本地存储
      localStorage.setItem("manga-current-project", projectId);

      console.log('✅ Project created successfully:', projectId);
      return projectId;
    } catch (error) {
      console.error('❌ Failed to create project:', error);
      throw error;
    } finally {
      creatingProjectRef.current = false;
    }
  }, []);

  // 清除当前项目
  const clearCurrentProject = useCallback(() => {
    setCurrentProjectId(null);
    localStorage.removeItem("manga-current-project");
  }, []);

  return {
    currentProjectId,
    isLoadingState,
    saveProjectData,
    loadProjectData,
    selectProject: debouncedProjectSelect,
    createProject,
    clearCurrentProject,
    setCurrentProjectId,
  };
};
