/**
 * 图片代理工具
 * 解决CORS问题，为R2和其他外部图片提供代理访问
 */

/**
 * 检查URL是否需要代理
 */
export function needsProxy(imageUrl: string): boolean {
  if (!imageUrl || imageUrl.startsWith('data:')) {
    return false;
  }

  try {
    const url = new URL(imageUrl);
    
    // 需要代理的域名
    const proxyDomains = [
      'pub-23959c61a0814f2a91a19cc37b24a893.r2.dev', // R2开发域名
      'manga.neodomain.ai', // R2生产域名
      'ark-content-generation-v2-cn-beijing.tos-cn-beijing.volces.com', // VolcEngine
      'tos-cn-beijing.volces.com' // VolcEngine
    ];

    return proxyDomains.some(domain => 
      url.hostname === domain || url.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * 获取代理URL
 */
export function getProxyUrl(imageUrl: string): string {
  if (!needsProxy(imageUrl)) {
    return imageUrl;
  }

  // 使用本地API代理
  return `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
}

/**
 * 处理图片URL，自动应用代理
 */
export function processImageUrl(imageUrl: string | undefined): string {
  if (!imageUrl) {
    return '';
  }

  // 如果是base64数据，直接返回
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  // 如果需要代理，返回代理URL
  if (needsProxy(imageUrl)) {
    return getProxyUrl(imageUrl);
  }

  // 否则直接返回原URL
  return imageUrl;
}

/**
 * 批量处理图片URL
 */
export function processImageUrls(imageUrls: (string | undefined)[]): string[] {
  return imageUrls.map(url => processImageUrl(url));
}

/**
 * 为React组件提供的Hook风格函数
 */
export function useImageProxy(imageUrl: string | undefined): string {
  return processImageUrl(imageUrl);
}

/**
 * 预加载图片（通过代理）
 */
export function preloadImage(imageUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const processedUrl = processImageUrl(imageUrl);
    
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${processedUrl}`));
    
    img.src = processedUrl;
  });
}

/**
 * 批量预加载图片
 */
export async function preloadImages(imageUrls: string[]): Promise<void> {
  const promises = imageUrls
    .filter(url => url && !url.startsWith('data:'))
    .map(url => preloadImage(url));
    
  await Promise.all(promises);
}

/**
 * 检查图片是否可访问
 */
export async function checkImageAccessibility(imageUrl: string): Promise<boolean> {
  try {
    const processedUrl = processImageUrl(imageUrl);
    const response = await fetch(processedUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 获取图片信息
 */
export async function getImageInfo(imageUrl: string): Promise<{
  width: number;
  height: number;
  size?: number;
} | null> {
  try {
    const processedUrl = processImageUrl(imageUrl);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      
      img.src = processedUrl;
    });
  } catch {
    return null;
  }
}
