/**
 * 简化的云存储服务
 * 替代复杂的 cloudFirst 存储系统
 */

import { supabase } from './supabase';

interface SavePanelResult {
  success: boolean;
  url?: string;
  error?: string;
}

interface PublicShareUrls {
  [panelId: string]: string;
}

class CloudFirstStorage {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // 简单的初始化检查
      const { data, error } = await supabase.storage.listBuckets();
      if (error) {
        console.warn('Storage initialization warning:', error);
      }
      this.initialized = true;
      console.log('CloudFirst storage initialized');
    } catch (error) {
      console.error('Failed to initialize CloudFirst storage:', error);
      // 不抛出错误，允许应用继续运行
      this.initialized = true;
    }
  }

  async saveGeneratedPanel(
    projectId: string,
    panelNumber: number,
    imageData: Buffer | string,
    metadata?: any
  ): Promise<SavePanelResult> {
    try {
      await this.initialize();

      const fileName = `panel-${panelNumber}-${Date.now()}.png`;
      const filePath = `projects/${projectId}/panels/${fileName}`;

      // 转换 base64 字符串为 Buffer（如果需要）
      let imageBuffer: Buffer;
      if (typeof imageData === 'string') {
        // 假设是 base64 字符串，移除 data URL 前缀
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        imageBuffer = imageData;
      }

      // 尝试保存到 Supabase Storage
      const { data, error } = await supabase.storage
        .from('comic-panels')
        .upload(filePath, imageBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (error) {
        console.error('Failed to save panel to storage:', error);
        return {
          success: false,
          error: error.message
        };
      }

      // 获取公共URL
      const { data: urlData } = supabase.storage
        .from('comic-panels')
        .getPublicUrl(filePath);

      console.log(`Panel saved successfully: ${filePath}`);
      
      return {
        success: true,
        url: urlData.publicUrl
      };

    } catch (error) {
      console.error('Error saving generated panel:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async preparePublicShareUrls(
    projectId: string,
    panels: Array<{ panelNumber: number; imageUrl?: string }>
  ): Promise<PublicShareUrls> {
    try {
      await this.initialize();

      const urls: PublicShareUrls = {};

      for (const panel of panels) {
        if (panel.imageUrl) {
          // 如果已经有URL，直接使用
          urls[`panel-${panel.panelNumber}`] = panel.imageUrl;
        } else {
          // 尝试从存储中获取URL
          const fileName = `panel-${panel.panelNumber}`;
          const filePath = `projects/${projectId}/panels/${fileName}`;
          
          const { data } = supabase.storage
            .from('comic-panels')
            .getPublicUrl(filePath);
          
          if (data?.publicUrl) {
            urls[`panel-${panel.panelNumber}`] = data.publicUrl;
          }
        }
      }

      console.log(`Prepared ${Object.keys(urls).length} public URLs for project ${projectId}`);
      return urls;

    } catch (error) {
      console.error('Error preparing public share URLs:', error);
      return {};
    }
  }

  async deletePanel(projectId: string, panelNumber: number): Promise<boolean> {
    try {
      await this.initialize();

      const filePath = `projects/${projectId}/panels/panel-${panelNumber}`;
      
      const { error } = await supabase.storage
        .from('comic-panels')
        .remove([filePath]);

      if (error) {
        console.error('Failed to delete panel:', error);
        return false;
      }

      console.log(`Panel deleted successfully: ${filePath}`);
      return true;

    } catch (error) {
      console.error('Error deleting panel:', error);
      return false;
    }
  }

  async listProjectPanels(projectId: string): Promise<string[]> {
    try {
      await this.initialize();

      const { data, error } = await supabase.storage
        .from('comic-panels')
        .list(`projects/${projectId}/panels`);

      if (error) {
        console.error('Failed to list project panels:', error);
        return [];
      }

      return data?.map(file => file.name) || [];

    } catch (error) {
      console.error('Error listing project panels:', error);
      return [];
    }
  }
}

// 导出单例实例
export const cloudFirstStorage = new CloudFirstStorage();

// 导出类型
export type { SavePanelResult, PublicShareUrls };
