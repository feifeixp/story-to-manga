import { useState, useEffect, useCallback } from 'react';
import { cloudStorage } from '@/lib/cloudStorage';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type {
  CharacterReference,
  ComicStyle,
  GeneratedPanel,
  StoryAnalysis,
  StoryBreakdown,
  UploadedCharacterReference,
  UploadedSettingReference,
} from "@/types";
import type {
  ImageSizeConfig,
  GenerationState,
} from "@/types/project";

interface CloudStorageState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
}

interface UseCloudStorageReturn extends CloudStorageState {
  // 认证相关
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  
  // 数据操作
  saveProject: (
    projectId: string,
    story: string,
    style: ComicStyle,
    storyAnalysis: StoryAnalysis | null,
    storyBreakdown: StoryBreakdown | null,
    characterReferences: CharacterReference[],
    generatedPanels: GeneratedPanel[],
    uploadedCharacterReferences?: UploadedCharacterReference[],
    uploadedSettingReferences?: UploadedSettingReference[],
    imageSize?: ImageSizeConfig,
    generationState?: GenerationState,
    setting?: any,
    scenes?: any[]
  ) => Promise<void>;
  
  loadProject: (projectId: string) => Promise<{
    story: string;
    style: ComicStyle;
    storyAnalysis: StoryAnalysis | null;
    storyBreakdown: StoryBreakdown | null;
    characterReferences: CharacterReference[];
    generatedPanels: GeneratedPanel[];
    uploadedCharacterReferences: UploadedCharacterReference[];
    uploadedSettingReferences: UploadedSettingReference[];
    imageSize?: ImageSizeConfig;
    generationState?: GenerationState;
    setting?: any;
    scenes?: any[];
  } | null>;
  
  uploadFiles: (files: {
    data: string;
    name: string;
    type: string;
    category: 'character' | 'setting' | 'panel' | 'avatar' | 'cover';
    projectId?: string;
    isPublic?: boolean;
  }[]) => Promise<{
    name: string;
    url: string;
    key: string;
    size: number;
  }[]>;
  
  syncLocalData: () => Promise<void>;
  clearError: () => void;
}

export function useCloudStorage(): UseCloudStorageReturn {
  const [state, setState] = useState<CloudStorageState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
    syncStatus: 'idle',
  });

  // 初始化认证状态
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          setState(prev => ({
            ...prev,
            isAuthenticated: !!session,
            user: session?.user || null,
            isLoading: false,
          }));
        }
      } catch (error) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Authentication failed',
            isLoading: false,
          }));
        }
      }
    };

    initAuth();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          setState(prev => ({
            ...prev,
            isAuthenticated: !!session,
            user: session?.user || null,
            isLoading: false,
          }));

          // 如果用户登录，自动同步本地数据
          if (event === 'SIGNED_IN' && session) {
            try {
              await cloudStorage.syncLocalDataToCloud();
            } catch (error) {
              console.warn('Auto sync failed:', error);
            }
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 登录
  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setState(prev => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
        return { success: false, error: error.message };
      }

      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        user: data.user,
        isLoading: false,
      }));

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  // 注册
  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0],
          }
        }
      });

      if (error) {
        setState(prev => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
        return { success: false, error: error.message };
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
      }));

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  // 登出
  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await supabase.auth.signOut();
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Logout failed',
        isLoading: false,
      }));
    }
  }, []);

  // 保存项目
  const saveProject = useCallback(async (
    projectId: string,
    story: string,
    style: ComicStyle,
    storyAnalysis: StoryAnalysis | null,
    storyBreakdown: StoryBreakdown | null,
    characterReferences: CharacterReference[],
    generatedPanels: GeneratedPanel[],
    uploadedCharacterReferences: UploadedCharacterReference[] = [],
    uploadedSettingReferences: UploadedSettingReference[] = [],
    imageSize?: ImageSizeConfig,
    generationState?: GenerationState,
    setting?: any,
    scenes?: any[]
  ) => {
    if (!state.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      await cloudStorage.saveProjectData(
        projectId,
        story,
        style,
        storyAnalysis,
        storyBreakdown,
        characterReferences,
        generatedPanels,
        uploadedCharacterReferences,
        uploadedSettingReferences,
        imageSize,
        generationState,
        setting,
        scenes
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save project';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.isAuthenticated]);

  // 加载项目
  const loadProject = useCallback(async (projectId: string) => {
    if (!state.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      return await cloudStorage.loadProjectData(projectId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load project';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.isAuthenticated]);

  // 上传文件
  const uploadFiles = useCallback(async (files: {
    data: string;
    name: string;
    type: string;
    category: 'character' | 'setting' | 'panel' | 'avatar' | 'cover';
    projectId?: string;
    isPublic?: boolean;
  }[]) => {
    if (!state.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    setState(prev => ({ ...prev, error: null }));

    try {
      return await cloudStorage.uploadFiles(files);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload files';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.isAuthenticated]);

  // 同步本地数据
  const syncLocalData = useCallback(async () => {
    if (!state.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    setState(prev => ({ ...prev, syncStatus: 'syncing', error: null }));

    try {
      const result = await cloudStorage.syncLocalDataToCloud();
      
      setState(prev => ({
        ...prev,
        syncStatus: result.success ? 'success' : 'error',
        error: result.errors.length > 0 ? result.errors.join('; ') : null,
      }));

      if (!result.success) {
        throw new Error(result.errors.join('; '));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setState(prev => ({
        ...prev,
        syncStatus: 'error',
        error: errorMessage,
      }));
      throw error;
    }
  }, [state.isAuthenticated]);

  // 清除错误
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    saveProject,
    loadProject,
    uploadFiles,
    syncLocalData,
    clearError,
  };
}
