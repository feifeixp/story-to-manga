/**
 * 图像优化工具 - 压缩、格式转换、尺寸优化
 */

export interface ImageOptimizationOptions {
  quality?: number; // 0-100, JPEG质量
  maxWidth?: number; // 最大宽度
  maxHeight?: number; // 最大高度
  format?: 'jpeg' | 'webp' | 'png'; // 输出格式
  progressive?: boolean; // 渐进式JPEG
}

export interface OptimizationResult {
  data: string; // base64数据
  originalSize: number; // 原始大小（字节）
  optimizedSize: number; // 优化后大小（字节）
  compressionRatio: number; // 压缩比
  format: string; // 输出格式
}

class ImageOptimizer {
  /**
   * 将base64转换为Canvas
   */
  private async base64ToCanvas(base64: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = base64;
    });
  }

  /**
   * 计算优化后的尺寸
   */
  private calculateOptimizedSize(
    originalWidth: number,
    originalHeight: number,
    maxWidth?: number,
    maxHeight?: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight };

    if (maxWidth && width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (maxHeight && height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  /**
   * 优化图像
   */
  async optimizeImage(
    base64Image: string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizationResult> {
    const {
      quality = 85,
      maxWidth,
      maxHeight,
      format = 'jpeg',
      progressive = true,
    } = options;

    try {
      // 计算原始大小
      const originalSize = Math.round((base64Image.length * 3) / 4);

      // 如果是服务器端，返回原始图像（浏览器API不可用）
      if (typeof window === 'undefined') {
        return {
          data: base64Image,
          originalSize,
          optimizedSize: originalSize,
          compressionRatio: 1,
          format: format,
        };
      }

      const canvas = await this.base64ToCanvas(base64Image);
      const ctx = canvas.getContext('2d')!;

      // 计算优化后的尺寸
      const optimizedSize = this.calculateOptimizedSize(
        canvas.width,
        canvas.height,
        maxWidth,
        maxHeight
      );

      // 创建新的canvas用于优化后的图像
      const optimizedCanvas = document.createElement('canvas');
      const optimizedCtx = optimizedCanvas.getContext('2d')!;
      optimizedCanvas.width = optimizedSize.width;
      optimizedCanvas.height = optimizedSize.height;

      // 使用高质量缩放
      optimizedCtx.imageSmoothingEnabled = true;
      optimizedCtx.imageSmoothingQuality = 'high';

      // 绘制优化后的图像
      optimizedCtx.drawImage(
        canvas,
        0,
        0,
        canvas.width,
        canvas.height,
        0,
        0,
        optimizedSize.width,
        optimizedSize.height
      );

      // 转换为指定格式
      const mimeType = `image/${format}`;
      const qualityValue = format === 'png' ? undefined : quality / 100;
      const optimizedBase64 = optimizedCanvas.toDataURL(mimeType, qualityValue);

      const optimizedSizeBytes = Math.round((optimizedBase64.length * 3) / 4);
      const compressionRatio = originalSize / optimizedSizeBytes;

      return {
        data: optimizedBase64,
        originalSize,
        optimizedSize: optimizedSizeBytes,
        compressionRatio,
        format,
      };
    } catch (error) {
      console.error('Image optimization failed:', error);
      // 失败时返回原始图像
      const originalSize = Math.round((base64Image.length * 3) / 4);
      return {
        data: base64Image,
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 1,
        format: 'original',
      };
    }
  }

  /**
   * 批量优化图像
   */
  async optimizeImages(
    images: string[],
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizationResult[]> {
    const results = await Promise.allSettled(
      images.map(image => this.optimizeImage(image, options))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`Failed to optimize image ${index}:`, result.reason);
        const originalSize = Math.round((images[index].length * 3) / 4);
        return {
          data: images[index],
          originalSize,
          optimizedSize: originalSize,
          compressionRatio: 1,
          format: 'original',
        };
      }
    });
  }

  /**
   * 获取图像信息
   */
  async getImageInfo(base64Image: string): Promise<{
    width: number;
    height: number;
    size: number;
    format: string;
  }> {
    if (typeof window === 'undefined') {
      return {
        width: 0,
        height: 0,
        size: Math.round((base64Image.length * 3) / 4),
        format: 'unknown',
      };
    }

    try {
      const canvas = await this.base64ToCanvas(base64Image);
      const format = base64Image.split(';')[0].split('/')[1] || 'unknown';
      
      return {
        width: canvas.width,
        height: canvas.height,
        size: Math.round((base64Image.length * 3) / 4),
        format,
      };
    } catch (error) {
      console.error('Failed to get image info:', error);
      return {
        width: 0,
        height: 0,
        size: Math.round((base64Image.length * 3) / 4),
        format: 'unknown',
      };
    }
  }
}

// 创建全局实例
export const imageOptimizer = new ImageOptimizer();

// 预设的优化配置
export const OPTIMIZATION_PRESETS = {
  // 高质量（用于最终输出）
  HIGH_QUALITY: {
    quality: 95,
    format: 'jpeg' as const,
    progressive: true,
  },
  
  // 标准质量（平衡质量和大小）
  STANDARD: {
    quality: 85,
    format: 'jpeg' as const,
    progressive: true,
  },
  
  // 预览质量（快速加载）
  PREVIEW: {
    quality: 70,
    maxWidth: 800,
    maxHeight: 600,
    format: 'jpeg' as const,
  },
  
  // 缩略图
  THUMBNAIL: {
    quality: 75,
    maxWidth: 300,
    maxHeight: 300,
    format: 'jpeg' as const,
  },
  
  // WebP格式（现代浏览器）
  WEBP: {
    quality: 80,
    format: 'webp' as const,
  },
} as const;

// 辅助函数
export const imageUtils = {
  /**
   * 检查浏览器是否支持WebP
   */
  supportsWebP: (): boolean => {
    if (typeof window === 'undefined') return false;
    
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  },

  /**
   * 获取最佳格式
   */
  getBestFormat: (): 'webp' | 'jpeg' => {
    return imageUtils.supportsWebP() ? 'webp' : 'jpeg';
  },

  /**
   * 计算压缩节省的空间
   */
  calculateSavings: (originalSize: number, optimizedSize: number) => {
    const savings = originalSize - optimizedSize;
    const percentage = (savings / originalSize) * 100;
    return {
      bytes: savings,
      percentage: Math.round(percentage * 100) / 100,
      readable: `${(savings / 1024 / 1024).toFixed(2)}MB (${percentage.toFixed(1)}%)`,
    };
  },
};
