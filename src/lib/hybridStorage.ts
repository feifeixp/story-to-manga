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
  ProjectData,
  ProjectMetadata,
  ProjectListItem,
  CreateProjectParams,
  UpdateProjectParams,
  ImageSizeConfig,
  GenerationState,
} from "@/types/project";
import { DEFAULT_IMAGE_SIZE } from "@/types/project";
import { cloudStorage } from '@/lib/cloudStorage';
import { supabase } from '@/lib/supabase';

// 混合存储服务 - 支持本地存储和云存储的无缝切换
export class HybridStorageService {
  private useCloudStorage: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    this.init();
  }

  // 初始化存储服务
  private async init(): Promise<void> {
    try {
      // 检查用户是否已认证
      const { data: { session } } = await supabase.auth.getSession();
      this.useCloudStorage = !!session?.access_token;
      this.isInitialized = true;

      // 监听认证状态变化
      supabase.auth.onAuthStateChange((event, session) => {
        const wasUsingCloud = this.useCloudStorage;
        this.useCloudStorage = !!session?.access_token;

        // 如果从未认证变为已认证，触发数据同步
        if (!wasUsingCloud && this.useCloudStorage) {
          this.syncLocalToCloud().catch(console.error);
        }
      });
    } catch (error) {
      console.warn('Failed to initialize hybrid storage:', error);
      this.useCloudStorage = false;
      this.isInitialized = true;
    }
  }

  // 等待初始化完成
  private async waitForInit(): Promise<void> {
    while (!this.isInitialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // 保存项目数据
  async saveProjectData(
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
  ): Promise<void> {
    await this.waitForInit();

    // 总是先保存到本地存储（作为备份）
    await this.saveToLocal(
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

    // 如果用户已认证，同时保存到云端
    if (this.useCloudStorage) {
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
        console.log('Project saved to cloud successfully');
      } catch (error) {
        console.warn('Failed to save to cloud, using local storage only:', error);
      }
    }
  }

  // 加载项目数据
  async loadProjectData(projectId: string): Promise<{
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
  } | null> {
    await this.waitForInit();

    // 如果用户已认证，优先从云端加载
    if (this.useCloudStorage) {
      try {
        const cloudData = await cloudStorage.loadProjectData(projectId);
        if (cloudData) {
          console.log('Project loaded from cloud successfully');
          return cloudData;
        }
      } catch (error) {
        console.warn('Failed to load from cloud, falling back to local storage:', error);
      }
    }

    // 从本地存储加载
    return await this.loadFromLocal(projectId);
  }

  // 本地存储保存方法
  private async saveToLocal(
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
  ): Promise<void> {
    // 使用现有的本地存储逻辑
    const { saveProjectData } = await import('./projectStorage');
    
    await saveProjectData(
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
  }

  // 本地存储加载方法
  private async loadFromLocal(projectId: string): Promise<{
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
  } | null> {
    // 使用现有的本地存储逻辑
    const { loadProjectData } = await import('./projectStorage');
    return await loadProjectData(projectId);
  }

  // 同步本地数据到云端
  async syncLocalToCloud(): Promise<void> {
    if (!this.useCloudStorage) {
      throw new Error('User not authenticated for cloud storage');
    }

    try {
      await cloudStorage.syncLocalDataToCloud();
      console.log('Local data synced to cloud successfully');
    } catch (error) {
      console.error('Failed to sync local data to cloud:', error);
      throw error;
    }
  }

  // 获取项目列表
  async getProjectList(): Promise<ProjectListItem[]> {
    await this.waitForInit();

    // 如果用户已认证，可以考虑从云端获取项目列表
    // 目前先使用本地存储的项目列表
    const { getProjectList } = await import('./projectStorage');
    return getProjectList();
  }

  // 创建新项目
  async createProject(params: CreateProjectParams): Promise<string> {
    await this.waitForInit();

    const { createProject } = await import('./projectStorage');
    const projectId = await createProject(params);

    // 如果用户已认证，同步项目元数据到云端
    if (this.useCloudStorage) {
      try {
        // 这里可以添加云端项目元数据同步逻辑
        console.log('Project metadata will be synced to cloud on first save');
      } catch (error) {
        console.warn('Failed to sync project metadata to cloud:', error);
      }
    }

    return projectId;
  }

  // 更新项目元数据
  async updateProject(projectId: string, updates: UpdateProjectParams): Promise<void> {
    await this.waitForInit();

    const { updateProject } = await import('./projectStorage');
    await updateProject(projectId, updates);

    // 如果用户已认证，同步到云端
    if (this.useCloudStorage) {
      try {
        // 这里可以添加云端项目元数据同步逻辑
        console.log('Project metadata updates will be synced to cloud');
      } catch (error) {
        console.warn('Failed to sync project updates to cloud:', error);
      }
    }
  }

  // 删除项目
  async deleteProject(projectId: string): Promise<void> {
    await this.waitForInit();

    const { deleteProject } = await import('./projectStorage');
    await deleteProject(projectId);

    // 如果用户已认证，从云端删除
    if (this.useCloudStorage) {
      try {
        // 这里可以添加云端项目删除逻辑
        console.log('Project will be deleted from cloud');
      } catch (error) {
        console.warn('Failed to delete project from cloud:', error);
      }
    }
  }

  // 检查是否使用云存储
  isUsingCloudStorage(): boolean {
    return this.useCloudStorage;
  }

  // 强制切换到云存储模式
  async enableCloudStorage(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('User not authenticated');
    }

    this.useCloudStorage = true;
    
    // 自动同步本地数据到云端
    await this.syncLocalToCloud();
  }

  // 切换到本地存储模式
  disableCloudStorage(): void {
    this.useCloudStorage = false;
  }
}

// 创建混合存储服务实例
export const hybridStorage = new HybridStorageService();

// 导出兼容的API，保持与现有代码的兼容性
export const saveProjectData = hybridStorage.saveProjectData.bind(hybridStorage);
export const loadProjectData = hybridStorage.loadProjectData.bind(hybridStorage);
export const getProjectList = hybridStorage.getProjectList.bind(hybridStorage);
export const createProject = hybridStorage.createProject.bind(hybridStorage);
export const updateProject = hybridStorage.updateProject.bind(hybridStorage);
export const deleteProject = hybridStorage.deleteProject.bind(hybridStorage);

// 导出项目管理相关的函数
export async function getCurrentProjectId(): Promise<string | null> {
  const { getCurrentProjectId } = await import('./projectStorage');
  return getCurrentProjectId();
}

export async function setCurrentProject(projectId: string): Promise<void> {
  const { setCurrentProject } = await import('./projectStorage');
  return setCurrentProject(projectId);
}
