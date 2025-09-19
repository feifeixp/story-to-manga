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
import { supabase } from "@/lib/supabase";

// 云存储服务类
export class CloudStorageService {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8000';
  }

  // 设置认证令牌
  async setAuthToken(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    this.authToken = session?.access_token || null;
  }

  // 获取请求头
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  // 保存项目数据到云端
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
    await this.setAuthToken();

    const requestData = {
      projectId,
      story,
      style,
      storyAnalysis,
      storyBreakdown,
      characterReferences,
      generatedPanels,
      uploadedCharacterReferences,
      uploadedSettingReferences,
      imageSize: imageSize || DEFAULT_IMAGE_SIZE,
      generationState,
      setting,
      scenes: scenes || [],
    };

    const response = await fetch(`${this.baseUrl}/api/storage/project`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save project data');
    }

    console.log('Project data saved to cloud successfully');
  }

  // 从云端加载项目数据
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
    await this.setAuthToken();

    const response = await fetch(
      `${this.baseUrl}/api/storage/project?projectId=${encodeURIComponent(projectId)}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to load project data');
    }

    const result = await response.json();
    
    if (!result.success || !result.data) {
      return null;
    }

    const data = result.data;
    
    return {
      story: data.story || '',
      style: data.style || 'manga',
      storyAnalysis: data.storyAnalysis || null,
      storyBreakdown: data.storyBreakdown || null,
      characterReferences: data.characterReferences || [],
      generatedPanels: data.generatedPanels || [],
      uploadedCharacterReferences: data.uploadedCharacterReferences || [],
      uploadedSettingReferences: data.uploadedSettingReferences || [],
      imageSize: data.imageSize || DEFAULT_IMAGE_SIZE,
      generationState: data.generationState,
      setting: data.setting,
      scenes: data.scenes || [],
    };
  }

  // 上传文件到云端
  async uploadFiles(files: {
    data: string;
    name: string;
    type: string;
    category: 'character' | 'setting' | 'panel' | 'avatar' | 'cover';
    projectId?: string;
    isPublic?: boolean;
  }[]): Promise<{
    name: string;
    url: string;
    key: string;
    size: number;
  }[]> {
    await this.setAuthToken();

    const response = await fetch(`${this.baseUrl}/api/storage/upload`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ files }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload files');
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    return result.files || [];
  }

  // 下载文件
  async downloadFile(key: string): Promise<string> {
    await this.setAuthToken();

    const response = await fetch(
      `${this.baseUrl}/api/storage/download?key=${encodeURIComponent(key)}&presigned=true`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to download file');
    }

    const result = await response.json();
    
    if (!result.presignedUrl) {
      throw new Error('No download URL provided');
    }

    // 使用预签名URL下载文件
    const fileResponse = await fetch(result.presignedUrl);
    
    if (!fileResponse.ok) {
      throw new Error('Failed to download file from presigned URL');
    }

    const blob = await fileResponse.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // 检查用户是否已认证
  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session?.access_token;
  }

  // 获取当前用户ID
  async getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }

  // 同步本地数据到云端
  async syncLocalDataToCloud(): Promise<{
    success: boolean;
    syncedProjects: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let syncedProjects = 0;

    try {
      // 检查是否已认证
      if (!(await this.isAuthenticated())) {
        throw new Error('User not authenticated');
      }

      // 获取本地项目列表
      const localProjects = this.getLocalProjectList();
      
      for (const project of localProjects) {
        try {
          // 加载本地项目数据
          const localData = await this.loadLocalProjectData(project.metadata.id);
          
          if (localData) {
            // 上传到云端
            await this.saveProjectData(
              project.metadata.id,
              localData.story,
              localData.style,
              localData.storyAnalysis,
              localData.storyBreakdown,
              localData.characterReferences,
              localData.generatedPanels,
              localData.uploadedCharacterReferences,
              localData.uploadedSettingReferences,
              localData.imageSize,
              localData.generationState,
              localData.setting,
              localData.scenes
            );
            
            syncedProjects++;
            console.log(`Synced project: ${project.metadata.name}`);
          }
        } catch (error) {
          const errorMsg = `Failed to sync project ${project.metadata.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        syncedProjects,
        errors,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMsg);
      
      return {
        success: false,
        syncedProjects,
        errors,
      };
    }
  }

  // 获取本地项目列表（兼容现有代码）
  private getLocalProjectList(): ProjectListItem[] {
    try {
      const stored = localStorage.getItem('manga-projects-list');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // 加载本地项目数据（兼容现有代码）
  private async loadLocalProjectData(projectId: string): Promise<any | null> {
    try {
      // 尝试从新版本存储加载
      const stored = localStorage.getItem(`manga-project-${projectId}`);
      if (stored) {
        const textData = JSON.parse(stored);
        
        // 从IndexedDB加载图片
        const { projectImageStorage } = await import('./projectStorage');
        await projectImageStorage.init();

        // 加载角色图片
        const characterReferences = await Promise.all(
          (textData.characterReferences || []).map(async (char: any) => {
            const image = await projectImageStorage.getImage(projectId, `char-${char.name}`);
            return { ...char, image: image || '' };
          })
        );

        // 加载面板图片
        const generatedPanels = await Promise.all(
          (textData.generatedPanels || []).map(async (panel: any) => {
            const image = await projectImageStorage.getImage(projectId, `panel-${panel.panelNumber}`);
            return { ...panel, image: image || '' };
          })
        );

        return {
          ...textData,
          characterReferences,
          generatedPanels,
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to load local project data:', error);
      return null;
    }
  }
}

// 创建云存储服务实例
export const cloudStorage = new CloudStorageService();
