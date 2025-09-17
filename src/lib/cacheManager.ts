/**
 * 缓存管理器 - 用于缓存角色参考图片、常用设定等
 */

export interface CacheItem<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  size?: number; // 数据大小（字节）
}

export interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  hits: number;
  misses: number;
}

class CacheManager {
  private cache = new Map<string, CacheItem>();
  private maxSize = 50 * 1024 * 1024; // 50MB 最大缓存大小
  private maxAge = 24 * 60 * 60 * 1000; // 24小时默认过期时间
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(maxSize?: number, maxAge?: number) {
    if (maxSize) this.maxSize = maxSize;
    if (maxAge) this.maxAge = maxAge;
    
    // 定期清理过期缓存
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // 每5分钟清理一次
  }

  /**
   * 生成缓存键
   */
  private generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * 计算数据大小（估算）
   */
  private calculateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2; // Unicode字符大约2字节
    }
    return JSON.stringify(data).length * 2;
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    let freedSize = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        freedSize += item.size || 0;
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cache cleanup: removed ${cleanedCount} expired items, freed ${(freedSize / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  /**
   * 确保缓存大小不超过限制
   */
  private ensureSize(): void {
    const currentSize = this.getCurrentSize();
    if (currentSize <= this.maxSize) return;

    // 按时间戳排序，删除最旧的项目
    const items = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    let freedSize = 0;
    let removedCount = 0;

    for (const [key, item] of items) {
      freedSize += item.size || 0;
      this.cache.delete(key);
      removedCount++;

      if (currentSize - freedSize <= this.maxSize * 0.8) { // 保持在80%以下
        break;
      }
    }

    console.log(`Cache size limit: removed ${removedCount} items, freed ${(freedSize / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * 获取当前缓存大小
   */
  private getCurrentSize(): number {
    let totalSize = 0;
    for (const item of this.cache.values()) {
      totalSize += item.size || 0;
    }
    return totalSize;
  }

  /**
   * 设置缓存
   */
  set<T>(prefix: string, params: Record<string, any>, data: T, customMaxAge?: number): void {
    const key = this.generateKey(prefix, params);
    const size = this.calculateSize(data);
    const maxAge = customMaxAge || this.maxAge;
    
    const item: CacheItem<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + maxAge,
      size,
    };

    this.cache.set(key, item);
    this.ensureSize();
  }

  /**
   * 获取缓存
   */
  get<T>(prefix: string, params: Record<string, any>): T | null {
    const key = this.generateKey(prefix, params);
    const item = this.cache.get(key);

    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return item.data as T;
  }

  /**
   * 删除缓存
   */
  delete(prefix: string, params: Record<string, any>): boolean {
    const key = this.generateKey(prefix, params);
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      totalItems: this.cache.size,
      totalSize: this.getCurrentSize(),
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      hits: this.stats.hits,
      misses: this.stats.misses,
    };
  }

  /**
   * 检查缓存是否存在
   */
  has(prefix: string, params: Record<string, any>): boolean {
    const key = this.generateKey(prefix, params);
    const item = this.cache.get(key);
    return item !== undefined && Date.now() <= item.expiresAt;
  }
}

// 创建全局缓存实例
export const cacheManager = new CacheManager();

// 预定义的缓存前缀
export const CACHE_PREFIXES = {
  CHARACTER_REF: 'character_ref',
  STORY_ANALYSIS: 'story_analysis',
  STORY_BREAKDOWN: 'story_breakdown',
  PANEL_IMAGE: 'panel_image',
  STYLE_PROMPT: 'style_prompt',
} as const;

// 缓存辅助函数
export const cacheHelpers = {
  /**
   * 缓存角色参考图片
   */
  cacheCharacterRef: (characters: any[], setting: string, style: string, data: any) => {
    cacheManager.set(CACHE_PREFIXES.CHARACTER_REF, { characters, setting, style }, data, 2 * 60 * 60 * 1000); // 2小时
  },

  /**
   * 获取缓存的角色参考图片
   */
  getCachedCharacterRef: (characters: any[], setting: string, style: string) => {
    return cacheManager.get(CACHE_PREFIXES.CHARACTER_REF, { characters, setting, style });
  },

  /**
   * 缓存故事分析结果
   */
  cacheStoryAnalysis: (story: string, style: string, data: any) => {
    cacheManager.set(CACHE_PREFIXES.STORY_ANALYSIS, { story, style }, data, 60 * 60 * 1000); // 1小时
  },

  /**
   * 获取缓存的故事分析结果
   */
  getCachedStoryAnalysis: (story: string, style: string) => {
    return cacheManager.get(CACHE_PREFIXES.STORY_ANALYSIS, { story, style });
  },

  /**
   * 缓存故事分解结果
   */
  cacheStoryBreakdown: (storyAnalysis: any, style: string, data: any) => {
    cacheManager.set(CACHE_PREFIXES.STORY_BREAKDOWN, { storyAnalysis, style }, data, 60 * 60 * 1000); // 1小时
  },

  /**
   * 获取缓存的故事分解结果
   */
  getCachedStoryBreakdown: (storyAnalysis: any, style: string) => {
    return cacheManager.get(CACHE_PREFIXES.STORY_BREAKDOWN, { storyAnalysis, style });
  },

  /**
   * 缓存面板图片
   */
  cachePanelImage: (panelNumber: number, description: string, characters: any[], style: string, imageSize: any, data: any) => {
    cacheManager.set(CACHE_PREFIXES.PANEL_IMAGE, { panelNumber, description, characters, style, imageSize }, data, 4 * 60 * 60 * 1000); // 4小时
  },

  /**
   * 获取缓存的面板图片
   */
  getCachedPanelImage: (panelNumber: number, description: string, characters: any[], style: string, imageSize: any) => {
    return cacheManager.get(CACHE_PREFIXES.PANEL_IMAGE, { panelNumber, description, characters, style, imageSize });
  },
};
