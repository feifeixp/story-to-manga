"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/I18nProvider';
import { useAuth } from '@/components/AuthProvider';
import { ComicService } from '@/lib/services/comicService';
import type { Comic, ComicPanel, UserComicInteraction } from '@/lib/types/comic';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Bookmark,
  Share2,
  Maximize,
  Minimize,
  Play,
  Pause,
  RotateCcw,
  X,
  Eye,
  ThumbsUp,
  Calendar
} from 'lucide-react';

interface ComicReaderProps {
  comic: Comic;
  onClose: () => void;
}

export function ComicReader({ comic, onClose }: ComicReaderProps) {
  const { language } = useI18n();
  const { user } = useAuth();
  
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [autoPlayInterval, setAutoPlayInterval] = useState<NodeJS.Timeout | null>(null);
  const [userInteraction, setUserInteraction] = useState<UserComicInteraction | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 获取用户交互状态
  useEffect(() => {
    if (user && comic.id) {
      ComicService.getUserInteraction(comic.id, user.id).then(setUserInteraction);
    }
  }, [user, comic.id]);

  // 记录浏览
  useEffect(() => {
    if (comic.id) {
      ComicService.recordView(comic.id, user?.id);
    }
  }, [comic.id, user?.id]);

  // 自动播放逻辑
  useEffect(() => {
    const panelsLength = comic.panels?.length || 0;
    if (isAutoPlay && panelsLength > 1) {
      const interval = setInterval(() => {
        setCurrentPage(prev => {
          if (prev >= panelsLength - 1) {
            setIsAutoPlay(false);
            return prev;
          }
          return prev + 1;
        });
      }, 3000);
      setAutoPlayInterval(interval);
      return () => clearInterval(interval);
    } else if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      setAutoPlayInterval(null);
    }
  }, [isAutoPlay, comic.panels?.length || 0, autoPlayInterval]);

  // 键盘导航
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handlePrevPage();
          break;
        case 'ArrowRight':
          handleNextPage();
          break;
        case 'Escape':
          if (isFullscreen) {
            setIsFullscreen(false);
          } else {
            onClose();
          }
          break;
        case ' ':
          e.preventDefault();
          setIsAutoPlay(!isAutoPlay);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAutoPlay, isFullscreen, onClose]);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    const panelsLength = comic.panels?.length || 0;
    setCurrentPage(prev => Math.min(panelsLength - 1, prev + 1));
  }, [comic.panels?.length]);

  const handleLike = async () => {
    if (!user) {
      // 显示登录提示
      return;
    }

    setIsLoading(true);
    const result = await ComicService.likeComic(comic.id, user.id);
    if (result.success) {
      setUserInteraction(prev => prev ? {
        ...prev,
        is_liked: result.liked || false
      } : null);
    }
    setIsLoading(false);
  };

  const handleFavorite = async () => {
    if (!user) {
      // 显示登录提示
      return;
    }

    setIsLoading(true);
    const result = await ComicService.favoriteComic(comic.id, user.id);
    if (result.success) {
      setUserInteraction(prev => prev ? {
        ...prev,
        is_favorited: result.favorited || false
      } : null);
    }
    setIsLoading(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: comic.title,
          text: comic.description,
          url: window.location.href
        });
      } catch (error) {
        // 用户取消分享
      }
    } else {
      // 复制链接到剪贴板
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const currentPanel = comic.panels?.[currentPage];

  // 如果没有面板数据，显示错误信息
  if (!comic.panels || comic.panels.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {language === 'zh' ? '无法加载漫画' : 'Unable to Load Comic'}
          </h3>
          <p className="text-gray-600 mb-6">
            {language === 'zh'
              ? '这个漫画暂时无法显示，可能是数据加载出现了问题。'
              : 'This comic cannot be displayed right now. There might be an issue with data loading.'}
          </p>
          <Button onClick={onClose} className="w-full">
            {language === 'zh' ? '关闭' : 'Close'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-black z-50 ${isFullscreen ? '' : 'p-4'}`}>
      {/* 头部工具栏 */}
      {!isFullscreen && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="flex items-center justify-between bg-black/80 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="text-white">
                <h2 className="font-bold text-lg">{comic.title}</h2>
                <p className="text-sm text-gray-300">
                  {language === 'zh' ? '作者' : 'By'}: {comic.author_name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* 统计信息 */}
              <div className="flex items-center space-x-4 text-white text-sm">
                <div className="flex items-center space-x-1">
                  <Eye className="h-4 w-4" />
                  <span>{comic.views_count}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <ThumbsUp className="h-4 w-4" />
                  <span>{comic.likes_count}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Bookmark className="h-4 w-4" />
                  <span>{comic.favorites_count}</span>
                </div>
              </div>

              {/* 操作按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
                disabled={isLoading}
                className={`text-white hover:bg-white/20 ${
                  userInteraction?.is_liked ? 'text-red-500' : ''
                }`}
              >
                <Heart className={`h-4 w-4 ${userInteraction?.is_liked ? 'fill-current' : ''}`} />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFavorite}
                disabled={isLoading}
                className={`text-white hover:bg-white/20 ${
                  userInteraction?.is_favorited ? 'text-yellow-500' : ''
                }`}
              >
                <Bookmark className={`h-4 w-4 ${userInteraction?.is_favorited ? 'fill-current' : ''}`} />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="text-white hover:bg-white/20"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-white hover:bg-white/20"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 主要内容区域 */}
      <div className="flex items-center justify-center h-full">
        {/* 上一页按钮 */}
        <Button
          variant="ghost"
          size="lg"
          onClick={handlePrevPage}
          disabled={currentPage === 0}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20 z-10"
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>

        {/* 漫画面板 */}
        <div className="max-w-full max-h-full flex items-center justify-center">
          {currentPanel && (
            <img
              src={currentPanel.image_url}
              alt={`${comic.title} - ${language === 'zh' ? '第' : 'Page'} ${currentPage + 1} ${language === 'zh' ? '页' : ''}`}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: isFullscreen ? '100vh' : 'calc(100vh - 8rem)' }}
            />
          )}
        </div>

        {/* 下一页按钮 */}
        <Button
          variant="ghost"
          size="lg"
          onClick={handleNextPage}
          disabled={currentPage === (comic.panels?.length || 1) - 1}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/20 z-10"
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      </div>

      {/* 底部控制栏 */}
      {!isFullscreen && (
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAutoPlay(!isAutoPlay)}
                  className="text-white hover:bg-white/20"
                >
                  {isAutoPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(0)}
                  className="text-white hover:bg-white/20"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {/* 页面指示器 */}
              <div className="flex items-center space-x-2">
                <span className="text-white text-sm">
                  {currentPage + 1} / {comic.panels?.length || 0}
                </span>
                <div className="w-32 bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-white rounded-full h-2 transition-all duration-300"
                    style={{ width: `${((currentPage + 1) / (comic.panels?.length || 1)) * 100}%` }}
                  />
                </div>
              </div>

              {/* 页面缩略图 */}
              <div className="flex space-x-1 max-w-xs overflow-x-auto">
                {(comic.panels || []).map((panel, index) => (
                  <button
                    key={panel.id}
                    onClick={() => setCurrentPage(index)}
                    className={`flex-shrink-0 w-12 h-16 rounded border-2 overflow-hidden ${
                      index === currentPage ? 'border-white' : 'border-gray-600'
                    }`}
                  >
                    <img
                      src={panel.image_url}
                      alt={`Page ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
