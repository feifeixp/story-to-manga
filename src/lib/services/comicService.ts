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

      console.log('🔍 ComicService.getComics called with params:', params);

      let query = supabase
        .from('published_works')
        .select(`
          *,
          author:profiles!published_works_author_id_fkey(name, avatar_url)
        `)
        .eq('is_published', true)
        .eq('visibility', 'public');

      // 添加筛选条件
      if (style) {
        query = query.eq('tags', `{${style}}`); // 假设style存储在tags数组中
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
        case 'most_viewed':
          query = query.order('view_count', { ascending: false });
          break;
        case 'most_liked':
          query = query.order('like_count', { ascending: false });
          break;
        case 'most_favorited':
          query = query.order('favorite_count', { ascending: false });
          break;
        case 'latest':
        default:
          query = query.order('created_at', { ascending: false });
      }

      // 添加分页
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      console.log('📊 Executing query for published works...');
      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Error fetching published works:', error);
        throw new Error(error.message);
      }

      console.log(`✅ Found ${data?.length || 0} published works`);

      // 转换数据格式以匹配Comic接口
      const comics = (data || []).map(work => ({
        id: work.id,
        title: work.title,
        description: work.description,
        style: work.tags?.[0] || 'manga', // 使用第一个tag作为style
        author_id: work.author_id,
        author: work.author,
        thumbnail_url: work.thumbnail_url,
        total_panels: 0, // 这个需要从项目数据中获取
        is_published: work.is_published,
        visibility: work.visibility,
        tags: work.tags || [],
        view_count: work.view_count || 0,
        like_count: work.like_count || 0,
        favorite_count: work.favorite_count || 0,
        created_at: work.created_at,
        updated_at: work.updated_at,
        published_at: work.created_at, // 使用created_at作为published_at
        project_id: work.project_id,
        panels: [] // 面板数据需要单独加载
      }));

      return {
        success: true,
        data: comics,
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
      // 获取混合排序的推荐漫画：最新、最多点赞、最多收藏
      const [latestResult, mostLikedResult, mostFavoritedResult] = await Promise.all([
        // 最新发布的漫画 (2个)
        supabase
          .from('comics')
          .select(`
            *,
            author:profiles(name, avatar_url)
          `)
          .eq('is_published', true)
          .order('published_at', { ascending: false })
          .limit(Math.ceil(limit / 3)),

        // 最多点赞的漫画 (2个)
        supabase
          .from('comics')
          .select(`
            *,
            author:profiles(name, avatar_url)
          `)
          .eq('is_published', true)
          .order('likes_count', { ascending: false })
          .limit(Math.ceil(limit / 3)),

        // 最多收藏的漫画 (2个)
        supabase
          .from('comics')
          .select(`
            *,
            author:profiles(name, avatar_url)
          `)
          .eq('is_published', true)
          .order('favorites_count', { ascending: false })
          .limit(Math.ceil(limit / 3))
      ]);

      // 合并结果并去重
      const allComics = [
        ...(latestResult.data || []),
        ...(mostLikedResult.data || []),
        ...(mostFavoritedResult.data || [])
      ];

      // 去重（基于ID）并限制数量
      const uniqueComics = allComics
        .filter((comic, index, self) =>
          index === self.findIndex(c => c.id === comic.id)
        )
        .slice(0, limit);

      return {
        success: true,
        data: uniqueComics
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

  // 创建新漫画作品 - 使用统一API客户端
  static async createComic(data: CreateComicData, userId: string, userName: string, userAvatar?: string) {
    try {
      console.log('🔧 ComicService.createComic called with:', { data, userId, userName, userAvatar });

      // 使用统一API客户端创建项目和发布作品
      const { UnifiedAPIClient } = await import('@/lib/unifiedApiClient');
      const apiClient = new UnifiedAPIClient();

      // 1. 首先创建一个项目
      console.log('📝 Step 1: Creating project for comic...');

      const projectData = {
        name: data.title,
        description: data.description,
        story: `漫画作品：${data.title}\n\n${data.description}\n\n面板内容：\n${data.panels.map((panel, index) => `面板 ${index + 1}: ${panel.text_content}`).join('\n')}`,
        style: data.style
      };

      const project = await apiClient.createProject(projectData);
      console.log('✅ Project created:', project.id);

      // 2. 保存漫画面板数据到项目存储
      console.log('📝 Step 2: Saving comic panels data...');

      const comicMetadata = {
        type: 'comic',
        title: data.title,
        description: data.description,
        style: data.style,
        totalPanels: data.panels.length,
        authorName: userName,
        authorAvatar: userAvatar,
        panels: data.panels.map((panel, index) => ({
          panelNumber: panel.panel_number || index + 1,
          imageUrl: panel.image_url,
          textContent: panel.text_content
        })),
        createdAt: new Date().toISOString()
      };

      // 保存到项目存储 - 使用统一存储适配器
      try {
        console.log('💾 Attempting to save comic data to unified storage...');
        console.log('📊 Request data:', {
          projectId: project.id,
          story: projectData.story?.substring(0, 100) + '...',
          metadataKeys: Object.keys(comicMetadata)
        });

        // 使用统一存储适配器保存数据
        const { storageAdapter } = await import('@/lib/storageAdapter');

        await storageAdapter.saveProjectData(
          project.id,
          projectData.story || `漫画作品：${data.title}`, // 确保story不为空
          projectData.style || 'manga',
          null, // storyAnalysis
          null, // storyBreakdown
          [], // characterReferences
          data.panels.map((panel, index) => ({
            panelNumber: panel.panel_number || (index + 1),
            image: panel.image_url,
            description: panel.text_content || `面板 ${index + 1}`,
            characters: [],
            setting: '',
            dialogue: panel.text_content || '',
            action: '',
            mood: '',
            prompt: `漫画面板 ${index + 1}: ${panel.text_content}`
          })),
          [], // uploadedCharacterReferences
          [], // uploadedSettingReferences
          { width: 512, height: 768, aspectRatio: '2:3' }, // imageSize
          { isGenerating: false, currentStep: 'completed', progress: 100 }, // generationState
          'manual', // aiModel - 手动创建的漫画
          {
            type: 'shared-comic',
            title: data.title,
            description: data.description,
            authorId: userId,
            authorName: userName,
            createdAt: new Date().toISOString()
          }, // setting
          [] // scenes
        );

        console.log('✅ Comic data saved to unified storage');
      } catch (storageError) {
        console.warn('⚠️ Failed to save comic data to unified storage, but continuing...', storageError);
        // 如果统一存储失败，尝试直接本地保存作为备份
        try {
          const { saveProjectData } = await import('@/lib/projectStorage');
          await saveProjectData(
            project.id,
            projectData.story,
            projectData.style,
            null, // storyAnalysis
            null, // storyBreakdown
            [], // characterReferences
            [], // generatedPanels
            [], // uploadedCharacterReferences
            [], // uploadedSettingReferences
            { width: 512, height: 768 }, // imageSize
            null // generationState
          );
          console.log('✅ Comic data saved to local storage as backup');
        } catch (localError) {
          console.warn('⚠️ Local backup also failed:', localError);
        }
      }

      // 3. 如果需要发布，则发布作品
      if (data.is_published) {
        console.log('📝 Step 3: Publishing work...');

        const publishData = {
          projectId: project.id,
          title: data.title,
          description: data.description,
          tags: data.tags || [],
          visibility: 'public',
          thumbnailUrl: data.panels[0]?.image_url
        };

        try {
          const publishResponse = await apiClient.request('/sharing/publish', {
            method: 'POST',
            body: JSON.stringify(publishData)
          });

          if (!publishResponse.success) {
            console.error('❌ Failed to publish work:', publishResponse.error);
            throw new Error(`Failed to publish work: ${publishResponse.error || 'Unknown error'}`);
          }

          console.log('✅ Work published successfully:', publishResponse.data);
        } catch (publishError) {
          console.error('❌ Publish request failed:', publishError);
          // 发布失败不应该影响整个创建流程，只是记录错误
          console.warn('⚠️ Work created but publishing failed, continuing...');
        }
      }

      return {
        success: true,
        data: {
          id: project.id,
          title: data.title,
          description: data.description,
          isPublished: data.is_published,
          projectId: project.id
        }
      };
    } catch (error) {
      console.error('❌ ComicService.createComic error:', error);
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
