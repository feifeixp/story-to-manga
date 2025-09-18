"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ComicCard, ComicCardSkeleton } from '@/components/ComicCard';
import { ComicReader } from '@/components/ComicReader';
import { useI18n } from '@/components/I18nProvider';
import { ComicService } from '@/lib/services/comicService';
import type { Comic, ComicListParams } from '@/lib/types/comic';
import {
  Search,
  Filter,
  Grid,
  List,
  TrendingUp,
  Clock,
  Heart,
  Eye,
  ChevronDown
} from 'lucide-react';

export default function ComicsPage() {
  const { language } = useI18n();
  
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComic, setSelectedComic] = useState<Comic | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'most_liked' | 'most_viewed'>('latest');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const styles = [
    'manga', 'comic', 'wuxia', 'healing', 'manhwa', 
    'cinematic', 'shojo', 'seinen', 'chibi', 'fantasy'
  ];

  // 加载漫画列表
  const loadComics = async (params: ComicListParams = {}) => {
    setLoading(true);
    try {
      const result = await ComicService.getComics({
        page: currentPage,
        limit: 12,
        sort: sortBy,
        style: selectedStyle || undefined,
        search: searchQuery || undefined,
        ...params
      });

      if (result.success) {
        setComics(result.data);
        if (result.pagination) {
          setTotalPages(result.pagination.totalPages);
        }
      }
    } catch (error) {
      console.error('Failed to load comics:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadComics();
  }, [currentPage, sortBy, selectedStyle]);

  // 搜索处理
  const handleSearch = () => {
    setCurrentPage(1);
    loadComics();
  };

  // 重置筛选
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedStyle('');
    setSortBy('latest');
    setCurrentPage(1);
    loadComics({
      page: 1,
      sort: 'latest',
      style: undefined,
      search: undefined
    });
  };

  const getSortLabel = (sort: string) => {
    switch (sort) {
      case 'latest':
        return language === 'zh' ? '最新发布' : 'Latest';
      case 'popular':
        return language === 'zh' ? '最受欢迎' : 'Popular';
      case 'most_liked':
        return language === 'zh' ? '最多点赞' : 'Most Liked';
      case 'most_viewed':
        return language === 'zh' ? '最多浏览' : 'Most Viewed';
      default:
        return sort;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {language === 'zh' ? '漫画作品' : 'Comic Works'}
              </h1>
              <p className="text-gray-600 mt-1">
                {language === 'zh' 
                  ? '发现和阅读社区创作的精彩漫画作品' 
                  : 'Discover and read amazing comic works created by the community'
                }
              </p>
            </div>

            {/* 视图切换 */}
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* 搜索和筛选 */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* 搜索框 */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={language === 'zh' ? '搜索漫画标题或描述...' : 'Search comic titles or descriptions...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* 排序 */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="latest">{getSortLabel('latest')}</option>
                  <option value="popular">{getSortLabel('popular')}</option>
                  <option value="most_liked">{getSortLabel('most_liked')}</option>
                  <option value="most_viewed">{getSortLabel('most_viewed')}</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>

              {/* 筛选按钮 */}
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>{language === 'zh' ? '筛选' : 'Filter'}</span>
              </Button>

              <Button onClick={handleSearch}>
                {language === 'zh' ? '搜索' : 'Search'}
              </Button>
            </div>

            {/* 展开的筛选选项 */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t">
                <div className="space-y-4">
                  {/* 风格筛选 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {language === 'zh' ? '漫画风格' : 'Comic Style'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={selectedStyle === '' ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setSelectedStyle('')}
                      >
                        {language === 'zh' ? '全部' : 'All'}
                      </Badge>
                      {styles.map((style) => (
                        <Badge
                          key={style}
                          variant={selectedStyle === style ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setSelectedStyle(style)}
                        >
                          {style}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="outline" onClick={resetFilters}>
                      {language === 'zh' ? '重置筛选' : 'Reset Filters'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 漫画列表 */}
        {loading ? (
          <div className={`grid gap-6 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
              : 'grid-cols-1'
          }`}>
            {Array.from({ length: 12 }).map((_, index) => (
              <ComicCardSkeleton key={index} />
            ))}
          </div>
        ) : comics.length > 0 ? (
          <>
            <div className={`grid gap-6 ${
              viewMode === 'grid' 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                : 'grid-cols-1'
            }`}>
              {comics.map((comic) => (
                <ComicCard
                  key={comic.id}
                  comic={comic}
                  onClick={setSelectedComic}
                  className={viewMode === 'list' ? 'flex-row' : ''}
                />
              ))}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    {language === 'zh' ? '上一页' : 'Previous'}
                  </Button>
                  
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    {language === 'zh' ? '下一页' : 'Next'}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {language === 'zh' ? '没有找到漫画' : 'No Comics Found'}
            </h3>
            <p className="text-gray-600">
              {language === 'zh' 
                ? '尝试调整搜索条件或筛选选项' 
                : 'Try adjusting your search terms or filters'
              }
            </p>
          </div>
        )}
      </div>

      {/* 漫画阅读器 */}
      {selectedComic && (
        <ComicReader
          comic={selectedComic}
          onClose={() => setSelectedComic(null)}
        />
      )}
    </div>
  );
}
