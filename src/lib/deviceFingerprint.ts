/**
 * 设备指纹生成器
 * 为匿名用户创建唯一标识，支持跨会话数据持久化
 */

interface DeviceInfo {
  userAgent: string;
  language: string;
  timezone: string;
  screen: string;
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: string | null;
}

class DeviceFingerprint {
  private static instance: DeviceFingerprint;
  private fingerprint: string | null = null;
  private readonly STORAGE_KEY = 'manga-device-id';

  static getInstance(): DeviceFingerprint {
    if (!DeviceFingerprint.instance) {
      DeviceFingerprint.instance = new DeviceFingerprint();
    }
    return DeviceFingerprint.instance;
  }

  /**
   * 获取设备指纹
   * 优先使用已存储的指纹，如果不存在则生成新的
   */
  async getFingerprint(): Promise<string> {
    if (this.fingerprint) {
      return this.fingerprint;
    }

    // 尝试从localStorage获取已存储的指纹
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      this.fingerprint = stored;
      return stored;
    }

    // 生成新的指纹
    this.fingerprint = await this.generateFingerprint();
    localStorage.setItem(this.STORAGE_KEY, this.fingerprint);
    
    return this.fingerprint;
  }

  /**
   * 生成设备指纹
   * 基于浏览器和设备特征生成唯一标识
   */
  private async generateFingerprint(): Promise<string> {
    const deviceInfo = this.collectDeviceInfo();
    const canvas = await this.getCanvasFingerprint();
    const webgl = this.getWebGLFingerprint();
    
    // 组合所有特征
    const combined = JSON.stringify({
      ...deviceInfo,
      canvas,
      webgl,
      timestamp: Date.now(),
      random: Math.random().toString(36).substr(2, 9)
    });

    // 生成哈希
    const hash = await this.simpleHash(combined);
    return `anon_${hash.substr(0, 16)}`;
  }

  /**
   * 收集设备基本信息
   */
  private collectDeviceInfo(): DeviceInfo {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
    };
  }

  /**
   * 获取Canvas指纹
   */
  private async getCanvasFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';

      canvas.width = 200;
      canvas.height = 50;

      // 绘制一些图形和文字
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Manga Device ID', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Device fingerprint', 4, 35);

      return canvas.toDataURL();
    } catch (error) {
      return 'canvas-error';
    }
  }

  /**
   * 获取WebGL指纹
   */
  private getWebGLFingerprint(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'no-webgl';

      const renderer = gl.getParameter(gl.RENDERER);
      const vendor = gl.getParameter(gl.VENDOR);
      
      return `${vendor}|${renderer}`;
    } catch (error) {
      return 'webgl-error';
    }
  }

  /**
   * 简单哈希函数
   */
  private async simpleHash(str: string): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (error) {
        // Fallback to simple hash
      }
    }

    // 简单的字符串哈希（fallback）
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 重置设备指纹（用于测试或用户要求）
   */
  reset(): void {
    this.fingerprint = null;
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * 检查是否为匿名用户
   */
  isAnonymous(userId: string): boolean {
    return userId.startsWith('anon_');
  }

  /**
   * 生成匿名用户的存储路径
   */
  getAnonymousPath(projectId: string, filename: string): string {
    if (!this.fingerprint) {
      throw new Error('Device fingerprint not initialized');
    }
    return `anonymous/${this.fingerprint}/projects/${projectId}/${filename}`;
  }
}

// 导出单例实例
export const deviceFingerprint = DeviceFingerprint.getInstance();

// 导出类型
export type { DeviceInfo };

// 工具函数
export const getDeviceId = () => deviceFingerprint.getFingerprint();
export const isAnonymousUser = (userId: string) => deviceFingerprint.isAnonymous(userId);
export const getAnonymousStoragePath = (projectId: string, filename: string) => 
  deviceFingerprint.getAnonymousPath(projectId, filename);
