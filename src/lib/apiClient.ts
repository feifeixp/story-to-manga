/**
 * 统一API客户端 - 简化版本
 */

import { Project, CreateProjectData, UpdateProjectData } from './projectService';

export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * 通用请求方法
   */
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    console.log(`🌐 API Request: ${config.method || 'GET'} ${url}`);

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ API Response: ${config.method || 'GET'} ${url}`, data);
      
      return data;

    } catch (error) {
      console.error(`❌ API Error: ${config.method || 'GET'} ${url}`, error);
      throw error;
    }
  }

  // ==================== 项目相关API ====================

  /**
   * 获取项目列表
   */
  async getProjects(): Promise<{ success: boolean; projects: Project[]; total: number }> {
    return this.request('/projects');
  }

  /**
   * 获取单个项目
   */
  async getProject(projectId: string): Promise<{ success: boolean; project: Project }> {
    return this.request(`/projects/${projectId}`);
  }

  /**
   * 创建项目
   */
  async createProject(data: CreateProjectData): Promise<{ success: boolean; project: Project; projectId: string }> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 更新项目
   */
  async updateProject(projectId: string, data: UpdateProjectData): Promise<{ success: boolean; project: Project }> {
    return this.request(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  // ==================== 漫画生成相关API ====================

  /**
   * 分析故事
   */
  async analyzeStory(story: string): Promise<any> {
    return this.request('/analyze-story', {
      method: 'POST',
      body: JSON.stringify({ story }),
    });
  }

  /**
   * 分块故事
   */
  async chunkStory(story: string): Promise<any> {
    return this.request('/chunk-story', {
      method: 'POST',
      body: JSON.stringify({ story }),
    });
  }

  /**
   * 生成角色参考
   */
  async generateCharacterRefs(characters: any[]): Promise<any> {
    return this.request('/generate-character-refs', {
      method: 'POST',
      body: JSON.stringify({ characters }),
    });
  }

  /**
   * 生成单个面板
   */
  async generatePanel(panelData: any): Promise<any> {
    return this.request('/generate-panel', {
      method: 'POST',
      body: JSON.stringify(panelData),
    });
  }

  /**
   * 批量生成面板
   */
  async generatePanelsBatch(panels: any[]): Promise<any> {
    return this.request('/generate-panels-batch', {
      method: 'POST',
      body: JSON.stringify({ panels }),
    });
  }

  /**
   * 修改图像
   */
  async modifyImage(imageData: any): Promise<any> {
    return this.request('/modify-image', {
      method: 'POST',
      body: JSON.stringify(imageData),
    });
  }

  /**
   * 重绘图像
   */
  async redrawImage(imageData: any): Promise<any> {
    return this.request('/redraw-image', {
      method: 'POST',
      body: JSON.stringify(imageData),
    });
  }

  // ==================== 文件上传相关API ====================

  /**
   * 上传到R2
   */
  async uploadToR2(file: File, path: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    return this.request('/r2-upload', {
      method: 'POST',
      body: formData,
      headers: {}, // 移除Content-Type，让浏览器自动设置
    });
  }

  // ==================== 健康检查 ====================

  /**
   * 健康检查
   */
  async healthCheck(): Promise<any> {
    return this.request('/health');
  }
}

// 导出单例实例
export const apiClient = ApiClient.getInstance();
