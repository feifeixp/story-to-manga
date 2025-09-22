// 漫画相关类型定义

export interface Comic {
  id: string;
  title: string;
  description: string;
  author_id: string;
  author_name: string;
  author_avatar?: string;
  cover_image: string;
  style: string;
  panels: ComicPanel[];
  tags: string[];
  created_at: string;
  updated_at: string;
  published_at?: string;
  is_published: boolean;
  likes_count: number;
  favorites_count: number;
  views_count: number;
  total_panels: number;
}

export interface ComicPanel {
  id: string;
  comic_id: string;
  panel_number: number;
  image_url: string;
  text_content?: string;
  created_at: string;
}

export interface ComicLike {
  id: string;
  comic_id: string;
  user_id: string;
  created_at: string;
}

export interface ComicFavorite {
  id: string;
  comic_id: string;
  user_id: string;
  created_at: string;
}

export interface ComicView {
  id: string;
  comic_id: string;
  user_id?: string;
  ip_address?: string;
  created_at: string;
}

// 漫画列表查询参数
export interface ComicListParams {
  page?: number;
  limit?: number;
  sort?: 'latest' | 'popular' | 'most_liked' | 'most_viewed' | 'most_favorited';
  style?: string;
  author_id?: string;
  search?: string;
}

// 漫画统计信息
export interface ComicStats {
  total_comics: number;
  total_likes: number;
  total_favorites: number;
  total_views: number;
  popular_styles: Array<{
    style: string;
    count: number;
  }>;
}

// 用户与漫画的交互状态
export interface UserComicInteraction {
  comic_id: string;
  is_liked: boolean;
  is_favorited: boolean;
  has_viewed: boolean;
}

// 漫画阅读器状态
export interface ComicReaderState {
  currentPage: number;
  totalPages: number;
  isFullscreen: boolean;
  readingMode: 'single' | 'double';
  autoPlay: boolean;
  autoPlayInterval: number;
}

// 漫画创建/更新数据
export interface CreateComicData {
  title: string;
  description: string;
  style: string;
  tags: string[];
  panels: Array<{
    panel_number: number;
    image_url: string;
    text_content?: string;
  }>;
  is_published?: boolean;
}

export interface UpdateComicData extends Partial<CreateComicData> {
  id: string;
}
