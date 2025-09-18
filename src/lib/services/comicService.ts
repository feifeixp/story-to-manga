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

  // 创建新漫画作品
  static async createComic(data: CreateComicData, userId: string, userName: string, userAvatar?: string) {
    try {
      console.log('🔧 ComicService.createComic called with:', { data, userId, userName, userAvatar });

      // 创建漫画主记录
      const comicInsertData = {
        title: data.title,
        description: data.description,
        author_id: userId,
        author_name: userName,
        author_avatar: userAvatar,
        cover_image: data.panels[0]?.image_url, // 使用第一个面板作为封面
        style: data.style,
        tags: data.tags,
        total_panels: data.panels.length,
        is_published: data.is_published || false,
        published_at: data.is_published ? new Date().toISOString() : null
      };

      console.log('📝 Inserting comic data:', comicInsertData);

      const { data: comic, error: comicError } = await supabase
        .from('comics')
        .insert(comicInsertData)
        .select()
        .single();

      console.log('📊 Comic insert result:', { comic, comicError });

      if (comicError) {
        console.error('❌ Comic insert error:', comicError);
        throw new Error(comicError.message);
      }

      console.log('✅ Comic created successfully:', comic);

      // 创建漫画面板
      const panelsData = data.panels.map((panel, index) => ({
        comic_id: comic.id,
        panel_number: panel.panel_number || index + 1,
        image_url: panel.image_url,
        text_content: panel.text_content
      }));

      console.log('📝 Inserting panels data:', panelsData);

      const { error: panelsError } = await supabase
        .from('comic_panels')
        .insert(panelsData);

      console.log('📊 Panels insert result:', { panelsError });

      if (panelsError) {
        throw new Error(panelsError.message);
      }

      return {
        success: true,
        data: comic
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create comic'
      };
    }
  }

  // 更新漫画作品
  static async updateComic(data: UpdateComicData) {
    try {
      const { id, panels, ...updateData } = data;

      // 更新漫画主记录
      const { error: comicError } = await supabase
        .from('comics')
        .update({
          ...updateData,
          total_panels: panels?.length || undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (comicError) {
        throw new Error(comicError.message);
      }

      // 如果有面板数据，更新面板
      if (panels) {
        // 删除现有面板
        const { error: deleteError } = await supabase
          .from('comic_panels')
          .delete()
          .eq('comic_id', id);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        // 插入新面板
        const panelsData = panels.map((panel, index) => ({
          comic_id: id,
          panel_number: panel.panel_number || index + 1,
          image_url: panel.image_url,
          text_content: panel.text_content
        }));

        const { error: panelsError } = await supabase
          .from('comic_panels')
          .insert(panelsData);

        if (panelsError) {
          throw new Error(panelsError.message);
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update comic'
      };
    }
  }

  // 发布漫画作品
  static async publishComic(comicId: string, userId: string) {
    try {
      const { error } = await supabase
        .from('comics')
        .update({
          is_published: true,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', comicId)
        .eq('author_id', userId); // 确保只有作者可以发布

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish comic'
      };
    }
  }

  // 取消发布漫画作品
  static async unpublishComic(comicId: string, userId: string) {
    try {
      const { error } = await supabase
        .from('comics')
        .update({
          is_published: false,
          published_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', comicId)
        .eq('author_id', userId); // 确保只有作者可以取消发布

      if (error) {
        throw new Error(error.message);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unpublish comic'
      };
    }
  }

  // 获取用户的漫画作品
  static async getUserComics(userId: string, includeUnpublished: boolean = true) {
    try {
      let query = supabase
        .from('comics')
        .select(`
          *,
          panels:comic_panels(*)
        `)
        .eq('author_id', userId)
        .order('created_at', { ascending: false });

      if (!includeUnpublished) {
        query = query.eq('is_published', true);
      }

      const { data, error } = await query;

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
        error: error instanceof Error ? error.message : 'Failed to fetch user comics'
      };
    }
  }
}
