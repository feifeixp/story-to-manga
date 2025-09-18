"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/components/I18nProvider';
import type { Comic } from '@/lib/types/comic';
import {
  Heart,
  Bookmark,
  Eye,
  Calendar,
  User,
  Image as ImageIcon
} from 'lucide-react';

interface ComicCardProps {
  comic: Comic;
  onClick: (comic: Comic) => void;
  className?: string;
}

export function ComicCard({ comic, onClick, className = '' }: ComicCardProps) {
  const { language } = useI18n();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (language === 'zh') {
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <Card 
      className={`group cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 ${className}`}
      onClick={() => onClick(comic)}
    >
      <div className="relative overflow-hidden rounded-t-lg">
        {/* 封面图片 */}
        <div className="aspect-[3/4] bg-gray-100 relative">
          {comic.cover_image ? (
            <img
              src={comic.cover_image}
              alt={comic.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100">
              <ImageIcon className="h-16 w-16 text-gray-400" />
            </div>
          )}
          
          {/* 悬浮信息 */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="text-white text-center p-4">
              <p className="text-sm mb-2">
                {language === 'zh' ? '点击阅读' : 'Click to Read'}
              </p>
              <div className="flex items-center justify-center space-x-4 text-xs">
                <div className="flex items-center space-x-1">
                  <ImageIcon className="h-3 w-3" />
                  <span>{comic.total_panels} {language === 'zh' ? '页' : 'pages'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 风格标签 */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-xs">
              {comic.style}
            </Badge>
          </div>

          {/* 统计信息 */}
          <div className="absolute top-2 right-2 flex flex-col space-y-1">
            {comic.likes_count > 0 && (
              <div className="bg-black/70 rounded-full px-2 py-1 flex items-center space-x-1">
                <Heart className="h-3 w-3 text-red-400" />
                <span className="text-white text-xs">{formatNumber(comic.likes_count)}</span>
              </div>
            )}
            {comic.favorites_count > 0 && (
              <div className="bg-black/70 rounded-full px-2 py-1 flex items-center space-x-1">
                <Bookmark className="h-3 w-3 text-yellow-400" />
                <span className="text-white text-xs">{formatNumber(comic.favorites_count)}</span>
              </div>
            )}
          </div>
        </div>

        <CardContent className="p-4">
          {/* 标题 */}
          <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors">
            {comic.title}
          </h3>

          {/* 描述 */}
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {comic.description}
          </p>

          {/* 作者信息 */}
          <div className="flex items-center space-x-2 mb-3">
            {comic.author_avatar ? (
              <img
                src={comic.author_avatar}
                alt={comic.author_name}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
                <User className="h-3 w-3 text-gray-600" />
              </div>
            )}
            <span className="text-sm text-gray-700 font-medium">
              {comic.author_name}
            </span>
          </div>

          {/* 标签 */}
          {comic.tags && comic.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {comic.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {comic.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{comic.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* 底部信息 */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(comic.published_at || comic.created_at)}</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Eye className="h-3 w-3" />
                <span>{formatNumber(comic.views_count)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Heart className="h-3 w-3" />
                <span>{formatNumber(comic.likes_count)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Bookmark className="h-3 w-3" />
                <span>{formatNumber(comic.favorites_count)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

// 漫画卡片骨架屏
export function ComicCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-[3/4] bg-gray-200 animate-pulse" />
      <CardContent className="p-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mb-3" />
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 bg-gray-200 rounded animate-pulse w-16" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
