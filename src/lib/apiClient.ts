/**
 * 统一API客户端 - 简化版本
 */

import { Project, CreateProjectData, UpdateProjectData } from './projectService';

export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private readonly CACHE_DURATION = 5000; // 5秒缓存

  private constructor() {
    this.baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env['NEXT_PUBLIC_BASE_URL'] || 'http://localhost:3000';
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * 通用请求方法 - 带缓存和防重复请求
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    const cacheKey = `${method}:${endpoint}`;

    // 对于 GET 请求，检查缓存
    if (method === 'GET') {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(`📦 Cache hit: ${cacheKey}`);
        return cached.data;
      }

      // 检查是否有相同的请求正在进行
      const pending = this.pendingRequests.get(cacheKey);
      if (pending) {
        console.log(`⏳ Request pending: ${cacheKey}`);
        return pending;
      }
    }

    const url = `${this.baseUrl}/api${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    console.log(`🌐 API Request: ${method} ${url}`);

    const requestPromise = this.executeRequest<T>(url, config, cacheKey, method);

    // 对于 GET 请求，缓存 Promise
    if (method === 'GET') {
      this.pendingRequests.set(cacheKey, requestPromise);
    }

    return requestPromise;
  }

  private async executeRequest<T>(url: string, config: RequestInit, cacheKey: string, method: string): Promise<T> {
    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ API Response: ${method} ${url}`, data);

      // 对于 GET 请求，缓存结果
      if (method === 'GET') {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }

      return data;

    } catch (error) {
      console.error(`❌ API Error: ${method} ${url}`, error);
      throw error;
    } finally {
      // 清理待处理请求
      if (method === 'GET') {
        this.pendingRequests.delete(cacheKey);
      }
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
