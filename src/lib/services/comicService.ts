import { supabase } from '@/lib/supabase';
import type { 
  Comic, 
  ComicPanel, 
  ComicListParams, 
  CreateComicData, 
  UpdateComicData,
  UserComicInteraction,
  ComicStats
} from '@/lib/types/comic';

export class ComicService {
  // 获取漫画列表
  static async getComics(params: ComicListParams = {}) {
    try {
      const {
        page = 1,
        limit = 12,
        sort = 'latest',
        style,
        author_id,
        search
      } = params;

      let query = supabase
        .from('comics')
        .select(`
          *,
          author:profiles(name, avatar_url),
          panels:comic_panels(count)
        `)
        .eq('is_published', true);

      // 添加筛选条件
      if (style) {
        query = query.eq('style', style);
      }

      if (author_id) {
        query = query.eq('author_id', author_id);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // 添加排序
      switch (sort) {
        case 'popular':
          query = query.order('views_count', { ascending: false });
          break;
        case 'most_liked':
          query = query.order('likes_count', { ascending: false });
          break;
        case 'most_viewed':
          query = query.order('views_count', { ascending: false });
          break;
        default:
          query = query.order('published_at', { ascending: false });
      }

      // 添加分页
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch comics'
      };
    }
  }

  // 获取单个漫画详情
  static async getComic(id: string) {
    try {
      const { data, error } = await supabase
        .from('comics')
        .select(`
          *,
          author:profiles(name, avatar_url),
          panels:comic_panels(*)
        `)
        .eq('id', id)
        .eq('is_published', true)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch comic'
      };
    }
  }

  // 获取热门漫画（首页推荐）
  static async getFeaturedComics(limit: number = 6) {
    try {
      const { data, error } = await supabase
        .from('comics')
        .select(`
          *,
          author:profiles(name, avatar_url)
        `)
        .eq('is_published', true)
        .order('likes_count', { ascending: false })
        .order('views_count', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch featured comics'
      };
    }
  }

  // 记录漫画浏览
  static async recordView(comicId: string, userId?: string) {
    try {
      // 增加浏览计数
      const { error: updateError } = await supabase
        .from('comics')
        .update({ 
          views_count: supabase.sql`views_count + 1`,
          updated_at: new Date().toISOString()
        })
        .eq('id', comicId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // 记录浏览记录（可选，用于分析）
      if (userId) {
        await supabase
          .from('comic_views')
          .insert({
            comic_id: comicId,
            user_id: userId
          });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record view'
      };
    }
  }

  // 点赞漫画
  static async likeComic(comicId: string, userId: string) {
    try {
      // 检查是否已经点赞
      const { data: existingLike } = await supabase
        .from('comic_likes')
        .select('id')
        .eq('comic_id', comicId)
        .eq('user_id', userId)
        .single();

      if (existingLike) {
        // 取消点赞
        const { error: deleteError } = await supabase
          .from('comic_likes')
          .delete()
          .eq('comic_id', comicId)
          .eq('user_id', userId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        // 减少点赞计数
        const { error: updateError } = await supabase
          .from('comics')
          .update({ 
            likes_count: supabase.sql`likes_count - 1`,
            updated_at: new Date().toISOString()
          })
          .eq('id', comicId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        return { success: true, liked: false };
      } else {
        // 添加点赞
        const { error: insertError } = await supabase
          .from('comic_likes')
          .insert({
            comic_id: comicId,
            user_id: userId
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        // 增加点赞计数
        const { error: updateError } = await supabase
          .from('comics')
          .update({ 
            likes_count: supabase.sql`likes_count + 1`,
            updated_at: new Date().toISOString()
          })
          .eq('id', comicId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        return { success: true, liked: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to like comic'
      };
    }
  }

  // 收藏漫画
  static async favoriteComic(comicId: string, userId: string) {
    try {
      // 检查是否已经收藏
      const { data: existingFavorite } = await supabase
        .from('comic_favorites')
        .select('id')
        .eq('comic_id', comicId)
        .eq('user_id', userId)
        .single();

      if (existingFavorite) {
        // 取消收藏
        const { error: deleteError } = await supabase
          .from('comic_favorites')
          .delete()
          .eq('comic_id', comicId)
          .eq('user_id', userId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        // 减少收藏计数
        const { error: updateError } = await supabase
          .from('comics')
          .update({ 
            favorites_count: supabase.sql`favorites_count - 1`,
            updated_at: new Date().toISOString()
          })
          .eq('id', comicId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        return { success: true, favorited: false };
      } else {
        // 添加收藏
        const { error: insertError } = await supabase
          .from('comic_favorites')
          .insert({
            comic_id: comicId,
            user_id: userId
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        // 增加收藏计数
        const { error: updateError } = await supabase
          .from('comics')
          .update({ 
            favorites_count: supabase.sql`favorites_count + 1`,
            updated_at: new Date().toISOString()
          })
          .eq('id', comicId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        return { success: true, favorited: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to favorite comic'
      };
    }
  }

  // 获取用户与漫画的交互状态
  static async getUserInteraction(comicId: string, userId: string): Promise<UserComicInteraction> {
    try {
      const [likeResult, favoriteResult] = await Promise.all([
        supabase
          .from('comic_likes')
          .select('id')
          .eq('comic_id', comicId)
          .eq('user_id', userId)
          .single(),
        supabase
          .from('comic_favorites')
          .select('id')
          .eq('comic_id', comicId)
          .eq('user_id', userId)
          .single()
      ]);

      return {
        comic_id: comicId,
        is_liked: !!likeResult.data,
        is_favorited: !!favoriteResult.data,
        has_viewed: true // 如果能查看就说明已经浏览过
      };
    } catch (error) {
      return {
        comic_id: comicId,
        is_liked: false,
        is_favorited: false,
        has_viewed: false
      };
    }
  }
}
