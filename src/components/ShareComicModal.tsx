"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/components/I18nProvider';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from 'react-i18next';
import { ComicService } from '@/lib/services/comicService';
import type { CreateComicData } from '@/lib/types/comic';
import {
  X,
  Share2,
  Eye,
  EyeOff,
  Tag,
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface ShareComicModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyTitle: string;
  storyDescription: string;
  style: string;
  panels: Array<{
    image_url: string;
    text_content?: string;
  }>;
}

export function ShareComicModal({
  isOpen,
  onClose,
  storyTitle,
  storyDescription,
  style,
  panels
}: ShareComicModalProps) {
  const { language } = useI18n();
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [title, setTitle] = useState(storyTitle || '');
  const [description, setDescription] = useState(storyDescription || '');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim()) && tags.length < 10) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleShare = async () => {
    if (!user) {
      setShareResult({
        success: false,
        message: language === 'zh' ? '请先登录以分享作品' : 'Please login to share your work'
      });
      return;
    }

    if (!title.trim()) {
      setShareResult({
        success: false,
        message: language === 'zh' ? '请输入作品标题' : 'Please enter a title for your work'
      });
      return;
    }

    if (panels.length === 0) {
      setShareResult({
        success: false,
        message: language === 'zh' ? '没有可分享的面板' : 'No panels to share'
      });
      return;
    }

    setIsSharing(true);
    setShareResult(null);

    try {
      const comicData: CreateComicData = {
        title: title.trim(),
        description: description.trim(),
        style,
        tags,
        panels: panels.map((panel, index) => ({
          panel_number: index + 1,
          image_url: panel.image_url,
          text_content: panel.text_content
        })),
        is_published: isPublic
      };

      const result = await ComicService.createComic(
        comicData,
        user.id,
        user.name || user.email || 'Anonymous',
        user.avatar
      );

      if (result.success) {
        setShareResult({
          success: true,
          message: language === 'zh' 
            ? `作品已成功${isPublic ? '发布' : '保存'}！${isPublic ? '其他用户现在可以看到你的作品了。' : '你可以稍后选择发布。'}` 
            : `Work ${isPublic ? 'published' : 'saved'} successfully! ${isPublic ? 'Other users can now see your work.' : 'You can choose to publish it later.'}`
        });

        // 3秒后自动关闭
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        setShareResult({
          success: false,
          message: result.error || (language === 'zh' ? '分享失败，请重试' : 'Failed to share, please try again')
        });
      }
    } catch (error) {
      setShareResult({
        success: false,
        message: language === 'zh' ? '分享过程中出现错误' : 'An error occurred while sharing'
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold">
            {t('share.shareYourComic')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 作品预览 */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-700">
              {t('share.preview')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {panels.slice(0, 8).map((panel, index) => (
                <div key={index} className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={panel.image_url}
                    alt={`Panel ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {panels.length > 8 && (
                <div className="aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                    <span className="text-xs">+{panels.length - 8}</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {language === 'zh' ? `共 ${panels.length} 个面板` : `${panels.length} panels total`}
            </p>
          </div>

          {/* 作品信息 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'zh' ? '作品标题' : 'Title'} *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === 'zh' ? '为你的作品起个好听的名字...' : 'Give your work a great title...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'zh' ? '作品描述' : 'Description'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={language === 'zh' ? '简单介绍一下你的作品...' : 'Tell others about your work...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
                maxLength={500}
              />
            </div>

            {/* 风格显示 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'zh' ? '漫画风格' : 'Comic Style'}
              </label>
              <Badge variant="secondary" className="text-sm">
                {style}
              </Badge>
            </div>

            {/* 标签 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'zh' ? '标签' : 'Tags'} ({tags.length}/10)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={language === 'zh' ? '添加标签...' : 'Add tag...'}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  maxLength={20}
                />
                <Button
                  type="button"
                  onClick={handleAddTag}
                  disabled={!newTag.trim() || tags.includes(newTag.trim()) || tags.length >= 10}
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 发布选项 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                {isPublic ? (
                  <Eye className="h-5 w-5 text-green-600" />
                ) : (
                  <EyeOff className="h-5 w-5 text-gray-500" />
                )}
                <div>
                  <p className="font-medium text-sm">
                    {isPublic 
                      ? (language === 'zh' ? '公开发布' : 'Publish Publicly')
                      : (language === 'zh' ? '私人保存' : 'Save Privately')
                    }
                  </p>
                  <p className="text-xs text-gray-600">
                    {isPublic 
                      ? (language === 'zh' ? '其他用户可以看到并互动' : 'Others can see and interact with your work')
                      : (language === 'zh' ? '只有你可以看到，稍后可以发布' : 'Only you can see it, publish later if you want')
                    }
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPublic(!isPublic)}
              >
                {isPublic 
                  ? (language === 'zh' ? '改为私人' : 'Make Private')
                  : (language === 'zh' ? '公开发布' : 'Make Public')
                }
              </Button>
            </div>
          </div>

          {/* 结果显示 */}
          {shareResult && (
            <div className={`p-4 rounded-lg flex items-center space-x-3 ${
              shareResult.success 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {shareResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              )}
              <p className={`text-sm ${
                shareResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {shareResult.message}
              </p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSharing}
            >
              {language === 'zh' ? '取消' : 'Cancel'}
            </Button>
            <Button
              onClick={handleShare}
              disabled={isSharing || !title.trim()}
              className="min-w-[120px]"
            >
              {isSharing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {language === 'zh' ? '分享中...' : 'Sharing...'}
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  {isPublic 
                    ? (language === 'zh' ? '发布作品' : 'Publish Work')
                    : (language === 'zh' ? '保存作品' : 'Save Work')
                  }
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
