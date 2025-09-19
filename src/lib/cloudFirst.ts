/**
 * 云优先存储服务
 * 所有数据优先保存到云端，本地作为缓存
 */

import { supabase } from '@/lib/supabase';
import { deviceFingerprint, getDeviceId } from '@/lib/deviceFingerprint';
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

interface CloudFirstConfig {
  baseUrl: string;
  enableLocalCache: boolean;
  cacheExpiry: number; // milliseconds
}

class CloudFirstStorage {
  private config: CloudFirstConfig;
  private userId: string | null = null;
  private isInitialized = false;

  constructor(config?: Partial<CloudFirstConfig>) {
    // 在服务器端，我们需要使用相对URL或者从环境变量获取baseUrl
    const defaultBaseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:8001';

    this.config = {
      baseUrl: defaultBaseUrl,
      enableLocalCache: typeof window !== 'undefined', // 只在浏览器端启用本地缓存
      cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };
  }

  /**
   * 初始化存储服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 检查用户认证状态
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        this.userId = session.user.id;
      } else {
        // 使用设备指纹作为匿名用户ID
        this.userId = await getDeviceId();
      }

      this.isInitialized = true;
      console.log('CloudFirst storage initialized for user:', this.userId);
    } catch (error) {
      console.warn('Failed to initialize CloudFirst storage:', error);
      // 使用设备指纹作为fallback
      this.userId = await getDeviceId();
      this.isInitialized = true;
    }
  }

  /**
   * 获取当前用户ID
   */
  async getUserId(): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.userId!;
  }

  /**
   * 保存生成的面板图片到云端
   */
  async saveGeneratedPanel(
    projectId: string,
    panelNumber: number,
    imageData: string,
    metadata?: any
  ): Promise<string> {
    const userId = await this.getUserId();

    try {
      // 在服务器端，直接调用 R2 存储而不是通过 HTTP 请求
      if (typeof window === 'undefined') {
        // 服务器端：直接使用 R2 客户端
        const { getR2Client } = await import('./r2Storage');
        const r2Client = getR2Client();

        // 处理图片数据
        let actualImageData = imageData;
        if (imageData.startsWith('/api/image-proxy?url=')) {
          // 从代理URL中提取原始URL并下载图片
          const urlMatch = imageData.match(/url=([^&]+)/);
          if (urlMatch) {
            const originalUrl = decodeURIComponent(urlMatch[1]);
            try {
              const imageResponse = await fetch(originalUrl);
              if (imageResponse.ok) {
                const buffer = await imageResponse.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                actualImageData = `data:image/jpeg;base64,${base64}`;
              }
            } catch (downloadError) {
              console.warn('Failed to download image from proxy URL:', downloadError);
            }
          }
        }

        // 构建文件路径
        const filePath = `${userId}/projects/${projectId}/panels/panel_${panelNumber}.jpg`;

        // 上传到 R2
        const uploadResult = await r2Client.uploadFile(
          filePath,
          actualImageData,
          {
            contentType: 'image/jpeg',
            metadata: {
              userId: userId || 'anonymous',
              projectId,
              panelNumber: panelNumber.toString(),
              uploadedAt: new Date().toISOString(),
              userType: deviceFingerprint.isAnonymous(userId) ? 'anonymous' : 'registered',
              ...metadata
            }
          }
        );

        // 缓存到本地（如果在浏览器环境中）
        if (this.config.enableLocalCache) {
          this.cachePanel(projectId, panelNumber, imageData);
        }

        return uploadResult.url || filePath;
      } else {
        // 浏览器端：通过 API 调用
        const response = await fetch(`${this.config.baseUrl}/api/storage/panel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await this.getAuthHeaders())
          },
          body: JSON.stringify({
            userId,
            projectId,
            panelNumber,
            imageData,
            metadata: {
              ...metadata,
              generatedAt: new Date().toISOString(),
              userType: deviceFingerprint.isAnonymous(userId) ? 'anonymous' : 'registered'
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to save panel: ${response.statusText}`);
        }

        const result = await response.json();

        // 缓存到本地
        if (this.config.enableLocalCache) {
          this.cachePanel(projectId, panelNumber, imageData);
        }

        return result.url;
      }

      return result.url || result.key;
    } catch (error) {
      console.error('Failed to save panel to cloud:', error);
      
      // Fallback: 保存到本地缓存
      if (this.config.enableLocalCache) {
        this.cachePanel(projectId, panelNumber, imageData);
      }
      
      throw error;
    }
  }

  /**
   * 批量保存生成的面板
   */
  async saveGeneratedPanels(
    projectId: string,
    panels: Array<{ panelNumber: number; imageData: string; metadata?: any }>
  ): Promise<Array<{ panelNumber: number; url: string }>> {
    const userId = await this.getUserId();

    try {
      // 在服务器端，直接调用 R2 存储而不是通过 HTTP 请求
      if (typeof window === 'undefined') {
        // 服务器端：直接使用 R2 客户端批量上传
        const { getR2Client } = await import('./r2Storage');
        const r2Client = getR2Client();

        const results: Array<{ panelNumber: number; url: string }> = [];

        // 并行处理所有面板
        await Promise.all(panels.map(async (panel) => {
          try {
            // 处理图片数据
            let actualImageData = panel.imageData;
            if (panel.imageData.startsWith('/api/image-proxy?url=')) {
              const urlMatch = panel.imageData.match(/url=([^&]+)/);
              if (urlMatch) {
                const originalUrl = decodeURIComponent(urlMatch[1]);
                try {
                  const imageResponse = await fetch(originalUrl);
                  if (imageResponse.ok) {
                    const buffer = await imageResponse.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    actualImageData = `data:image/jpeg;base64,${base64}`;
                  }
                } catch (downloadError) {
                  console.warn(`Failed to download image for panel ${panel.panelNumber}:`, downloadError);
                }
              }
            }

            // 构建文件路径
            const filePath = `${userId}/projects/${projectId}/panels/panel_${panel.panelNumber}.jpg`;

            // 上传到 R2
            const uploadResult = await r2Client.uploadFile(
              filePath,
              actualImageData,
              {
                contentType: 'image/jpeg',
                metadata: {
                  userId: userId || 'anonymous',
                  projectId,
                  panelNumber: panel.panelNumber.toString(),
                  uploadedAt: new Date().toISOString(),
                  userType: deviceFingerprint.isAnonymous(userId) ? 'anonymous' : 'registered',
                  ...panel.metadata
                }
              }
            );

            results.push({
              panelNumber: panel.panelNumber,
              url: uploadResult.url || filePath
            });

          } catch (error) {
            console.error(`Failed to upload panel ${panel.panelNumber}:`, error);
            // 继续处理其他面板，但记录失败
          }
        }));

        // 缓存到本地（如果在浏览器环境中）
        if (this.config.enableLocalCache) {
          panels.forEach(panel => {
            this.cachePanel(projectId, panel.panelNumber, panel.imageData);
          });
        }

        return results;
      } else {
        // 浏览器端：通过 API 调用
        const response = await fetch(`${this.config.baseUrl}/api/storage/panels-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await this.getAuthHeaders())
          },
          body: JSON.stringify({
            userId,
            projectId,
            panels: panels.map(panel => ({
              ...panel,
              metadata: {
                ...panel.metadata,
                generatedAt: new Date().toISOString(),
                userType: deviceFingerprint.isAnonymous(userId) ? 'anonymous' : 'registered'
              }
            }))
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to save panels: ${response.statusText}`);
        }

        const result = await response.json();

        // 缓存到本地
        if (this.config.enableLocalCache) {
          panels.forEach(panel => {
            this.cachePanel(projectId, panel.panelNumber, panel.imageData);
          });
        }

        return result.panels || [];
      }
    } catch (error) {
      console.error('Failed to save panels to cloud:', error);
      
      // Fallback: 保存到本地缓存
      if (this.config.enableLocalCache) {
        panels.forEach(panel => {
          this.cachePanel(projectId, panel.panelNumber, panel.imageData);
        });
      }
      
      throw error;
    }
  }

  /**
   * 保存项目数据
   */
  async saveProjectData(
    projectId: string,
    data: {
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
    }
  ): Promise<void> {
    const userId = await this.getUserId();
    
    try {
      const response = await fetch(`${this.config.baseUrl}/api/storage/project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await this.getAuthHeaders())
        },
        body: JSON.stringify({
          userId,
          projectId,
          ...data,
          metadata: {
            updatedAt: new Date().toISOString(),
            userType: deviceFingerprint.isAnonymous(userId) ? 'anonymous' : 'registered'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save project: ${response.statusText}`);
      }

      // 缓存到本地
      if (this.config.enableLocalCache) {
        this.cacheProjectData(projectId, data);
      }

      console.log('Project data saved to cloud successfully');
    } catch (error) {
      console.error('Failed to save project to cloud:', error);
      
      // Fallback: 保存到本地缓存
      if (this.config.enableLocalCache) {
        this.cacheProjectData(projectId, data);
      }
      
      throw error;
    }
  }

  /**
   * 获取认证头
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      return {
        'Authorization': `Bearer ${session.access_token}`
      };
    }
    
    // 匿名用户使用设备指纹
    return {
      'X-Device-ID': await getDeviceId()
    };
  }

  /**
   * 缓存面板到本地
   */
  private cachePanel(projectId: string, panelNumber: number, imageData: string): void {
    // 只在浏览器环境中缓存
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const cacheKey = `manga-panel-${projectId}-${panelNumber}`;
      const cacheData = {
        imageData,
        cachedAt: Date.now(),
        expiresAt: Date.now() + this.config.cacheExpiry
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache panel locally:', error);
    }
  }

  /**
   * 缓存项目数据到本地
   */
  private cacheProjectData(projectId: string, data: any): void {
    // 只在浏览器环境中缓存
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const cacheKey = `manga-project-${projectId}`;
      const cacheData = {
        ...data,
        cachedAt: Date.now(),
        expiresAt: Date.now() + this.config.cacheExpiry
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache project data locally:', error);
    }
  }
}

// 创建全局实例
export const cloudFirstStorage = new CloudFirstStorage();

// 导出类型
export type { CloudFirstConfig };
