/**
 * 内容分享 Hook
 * 负责漫画分享、导出、发布等功能
 */
import { useCallback, useState } from 'react';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { cloudFirstStorage } from '@/lib/cloudFirst';

interface ShareOptions {
  title?: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
}

export const useContentSharing = () => {
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // 准备分享数据 - 获取云端图片URL
  const prepareShareData = useCallback(async (
    currentProjectId: string,
    generatedPanels: any[]
  ) => {
    if (!currentProjectId || !generatedPanels.length) {
      console.warn('No project ID or panels to share');
      return null;
    }

    setIsPreparingShare(true);
    try {
      console.log('🔄 Preparing share data for', generatedPanels.length, 'panels');

      // 准备面板数据
      const panelsToSave = generatedPanels.map(panel => ({
        panelNumber: panel.panelNumber,
        imageUrl: panel.image
      }));

      // 生成公开的分享URL
      const publicUrls = await cloudFirstStorage.preparePublicShareUrls(currentProjectId, panelsToSave);

      // 转换为分享格式
      const panelsWithUrls = Object.entries(publicUrls).map(([panelId, url]) => {
        const panelNumber = parseInt(panelId.replace('panel-', ''));
        return {
          image_url: url as string,
          text_content: `Panel ${panelNumber}`
        };
      });

      console.log('✅ Share data prepared successfully');
      return panelsWithUrls;
    } catch (error) {
      console.error('❌ Failed to prepare share data:', error);
      throw error;
    } finally {
      setIsPreparingShare(false);
    }
  }, []);

  // 发布漫画
  const publishComic = useCallback(async (
    projectId: string,
    story: string,
    generatedPanels: any[],
    options: ShareOptions = {}
  ) => {
    try {
      setIsPreparingShare(true);

      // 准备分享数据
      const shareData = await prepareShareData(projectId, generatedPanels);
      if (!shareData) {
        throw new Error('Failed to prepare share data');
      }

      // 发布到服务器
      const response = await fetch('/api/publish-comic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: options.title || story.split('\n')[0] || 'Untitled Comic',
          description: options.description || story.substring(0, 200),
          story,
          panels: shareData,
          tags: options.tags || [],
          isPublic: options.isPublic ?? true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to publish comic: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to publish comic');
      }

      const publishedUrl = result.shareUrl;
      setShareUrl(publishedUrl);

      console.log('✅ Comic published successfully:', publishedUrl);
      return publishedUrl;
    } catch (error) {
      console.error('❌ Failed to publish comic:', error);
      throw error;
    } finally {
      setIsPreparingShare(false);
    }
  }, [prepareShareData]);

  // 下载为ZIP
  const downloadAsZip = useCallback(async (
    generatedPanels: any[],
    projectName: string = 'manga'
  ) => {
    try {
      const zip = new JSZip();
      const folder = zip.folder(projectName);

      if (!folder) {
        throw new Error('Failed to create ZIP folder');
      }

      // 添加面板图片到ZIP
      for (let i = 0; i < generatedPanels.length; i++) {
        const panel = generatedPanels[i];
        if (panel.image) {
          try {
            // 获取图片数据
            const response = await fetch(panel.image);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            
            folder.file(`panel_${i + 1}.jpg`, arrayBuffer);
          } catch (error) {
            console.warn(`Failed to add panel ${i + 1} to ZIP:`, error);
          }
        }
      }

      // 生成并下载ZIP文件
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log('✅ ZIP download completed');
    } catch (error) {
      console.error('❌ Failed to download ZIP:', error);
      throw error;
    }
  }, []);

  // 截图下载
  const downloadScreenshot = useCallback(async (
    elementId: string,
    filename: string = 'manga-screenshot'
  ) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`Element with ID '${elementId}' not found`);
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2, // 高分辨率
        useCORS: true,
        allowTaint: true,
      });

      // 转换为blob并下载
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to create screenshot blob');
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');

      console.log('✅ Screenshot download completed');
    } catch (error) {
      console.error('❌ Failed to download screenshot:', error);
      throw error;
    }
  }, []);

  // 复制分享链接
  const copyShareLink = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      console.log('✅ Share link copied to clipboard');
      return true;
    } catch (error) {
      console.error('❌ Failed to copy share link:', error);
      // 降级方案：使用传统方法
      try {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (fallbackError) {
        console.error('❌ Fallback copy method also failed:', fallbackError);
        return false;
      }
    }
  }, []);

  // 社交媒体分享
  const shareToSocial = useCallback((
    platform: 'twitter' | 'facebook' | 'reddit',
    url: string,
    title: string = 'Check out my manga!'
  ) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    
    let shareUrl = '';
    
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'reddit':
        shareUrl = `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  }, []);

  return {
    isPreparingShare,
    shareUrl,
    prepareShareData,
    publishComic,
    downloadAsZip,
    downloadScreenshot,
    copyShareLink,
    shareToSocial,
    setShareUrl,
  };
};
