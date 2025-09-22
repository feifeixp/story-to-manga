import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * 发布作品到公共画廊
 * POST /api/sharing/publish
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 API: Publishing work to public gallery...');

    const body = await request.json();
    const { projectId, title, description, tags = [], visibility = 'public', thumbnailUrl } = body;

    // 验证必需字段
    if (!projectId || !title) {
      return NextResponse.json(
        { success: false, error: 'Project ID and title are required' },
        { status: 400 }
      );
    }

    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('👤 Publishing user:', user.id);

    // 检查项目是否已经发布
    const { data: existingWork, error: checkError } = await supabase
      .from('published_works')
      .select('id, is_published')
      .eq('project_id', projectId)
      .eq('author_id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking existing work:', checkError);
      throw new Error(checkError.message);
    }

    let workId: string;

    if (existingWork) {
      // 更新现有作品
      console.log('📝 Updating existing published work:', existingWork.id);
      
      const { data: updatedWork, error: updateError } = await supabase
        .from('published_works')
        .update({
          title,
          description,
          tags,
          visibility,
          thumbnail_url: thumbnailUrl,
          is_published: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingWork.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('❌ Error updating work:', updateError);
        throw new Error(updateError.message);
      }

      workId = updatedWork.id;
    } else {
      // 创建新的发布作品
      console.log('✨ Creating new published work');
      
      const { data: newWork, error: insertError } = await supabase
        .from('published_works')
        .insert({
          project_id: projectId,
          author_id: user.id,
          title,
          description,
          tags,
          visibility,
          thumbnail_url: thumbnailUrl,
          is_published: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ Error creating work:', insertError);
        throw new Error(insertError.message);
      }

      workId = newWork.id;
    }

    console.log(`✅ Work published successfully: ${workId}`);

    return NextResponse.json({
      success: true,
      data: {
        id: workId,
        projectId,
        title,
        description,
        visibility,
        isPublished: true
      }
    });

  } catch (error) {
    console.error('❌ API: Failed to publish work:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to publish work' 
      },
      { status: 500 }
    );
  }
}

/**
 * 获取已发布的作品
 * GET /api/sharing/publish?projectId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 查询已发布的作品
    const { data: work, error } = await supabase
      .from('published_works')
      .select('*')
      .eq('project_id', projectId)
      .eq('author_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      data: work || null
    });

  } catch (error) {
    console.error('❌ API: Failed to get published work:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get published work' 
      },
      { status: 500 }
    );
  }
}

/**
 * 取消发布作品
 * DELETE /api/sharing/publish?projectId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 取消发布（设置为未发布状态）
    const { error } = await supabase
      .from('published_works')
      .update({
        is_published: false,
        updated_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .eq('author_id', user.id);

    if (error) {
      throw new Error(error.message);
    }

    console.log(`✅ Work unpublished: ${projectId}`);

    return NextResponse.json({
      success: true,
      message: 'Work unpublished successfully'
    });

  } catch (error) {
    console.error('❌ API: Failed to unpublish work:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to unpublish work' 
      },
      { status: 500 }
    );
  }
}
