import { NextRequest, NextResponse } from 'next/server';
import { getR2Client } from '@/lib/r2Storage';
import { generateUserFilePath } from '@/lib/r2Storage';
import { supabase } from '@/lib/supabase';
import type { ProjectListItem } from '@/types/project';

// 获取用户的项目列表
export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('📋 API: Getting project list...');

  try {
    // 获取用户认证信息（支持匿名用户）
    let userId: string;
    const authHeader = request.headers.get('authorization');
    const deviceId = request.headers.get('x-device-id');

    console.log('📋 API: Request headers:');
    console.log('  Authorization:', authHeader ? 'Present' : 'Missing');
    console.log('  Device ID:', deviceId || 'Missing');

    if (authHeader?.startsWith('Bearer ')) {
      // 认证用户
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        console.log('❌ API: Auth error:', authError?.message);
        return NextResponse.json(
          { success: false, error: 'Invalid authorization token' },
          { status: 401 }
        );
      }

      userId = user.id;
      console.log('👤 API: Authenticated user ID:', userId);
    } else {
      // 匿名用户
      if (!deviceId) {
        console.log('❌ API: Missing device ID for anonymous user');
        return NextResponse.json(
          { success: false, error: 'Device ID required for anonymous users' },
          { status: 401 }
        );
      }
      userId = deviceId;
      console.log('📱 API: Anonymous user device ID:', userId);
    }
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User identification required' },
        { status: 401 }
      );
    }

    const r2Client = getR2Client();
    
    // 列出用户的所有项目
    const userPrefix = userId.startsWith('anon_')
      ? `anonymous/${userId}/projects/`
      : `users/${userId}/projects/`;

    console.log('📁 API: Searching in path:', userPrefix);

    try {
      const objects = await r2Client.listFiles(userPrefix);
      console.log('📋 API: Found objects:', objects.length);

      if (objects.length > 0) {
        console.log('📋 API: Object details:');
        objects.slice(0, 5).forEach((obj, index) => {
          console.log(`  ${index + 1}. ${obj.key} (${obj.lastModified})`);
        });
        if (objects.length > 5) {
          console.log(`  ... and ${objects.length - 5} more objects`);
        }
      }
      
      // 提取项目ID和收集元数据
      const projectMap = new Map<string, any>();
      
      for (const obj of objects) {
        const key = obj.key || '';
        
        // 解析项目ID
        const projectMatch = key.match(/projects\/([^\/]+)\//);
        if (!projectMatch) continue;
        
        const projectId = projectMatch[1];
        
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            id: projectId,
            name: projectId,
            createdAt: obj.lastModified?.getTime() || Date.now(),
            updatedAt: obj.lastModified?.getTime() || Date.now(),
            panelCount: 0,
            characterCount: 0,
            style: 'manga',
            imageSize: { width: 1024, height: 576, aspectRatio: '16:9' },
          });
        }
        
        const project = projectMap.get(projectId);
        
        // 更新最后修改时间
        if (obj.lastModified && obj.lastModified.getTime() > project.updatedAt) {
          project.updatedAt = obj.lastModified.getTime();
        }
        
        // 统计面板和角色数量
        if (key.includes('/panels/')) {
          project.panelCount++;
        } else if (key.includes('/characters/')) {
          project.characterCount++;
        }
        
        // 尝试加载项目元数据
        if (key.endsWith('/metadata.json')) {
          try {
            const metadataBuffer = await r2Client.downloadFile(key);
            if (metadataBuffer) {
              const metadataContent = metadataBuffer.toString('utf-8');
              const metadata = JSON.parse(metadataContent);
              Object.assign(project, {
                name: metadata.name || project.name,
                description: metadata.description,
                style: metadata.style || project.style,
                imageSize: metadata.imageSize || project.imageSize,
                createdAt: metadata.createdAt || project.createdAt,
                updatedAt: metadata.updatedAt || project.updatedAt,
              });
            }
          } catch (metadataError) {
            console.warn(`Failed to load metadata for project ${projectId}:`, metadataError);
          }
        }
        
        // 尝试加载故事数据以获取更准确的信息
        if (key.endsWith('/story.json')) {
          try {
            const storyBuffer = await r2Client.downloadFile(key);
            const storyContent = storyBuffer.toString('utf-8');
            if (storyContent) {
              const storyData = JSON.parse(storyContent);
              
              // 更新统计信息
              project.panelCount = storyData.generatedPanels?.length || project.panelCount;
              project.characterCount = storyData.characterReferences?.length || project.characterCount;
              project.style = storyData.style || project.style;
              project.imageSize = storyData.imageSize || project.imageSize;
              
              // 如果没有名称，使用故事的前几个字作为名称
              if (project.name === projectId && storyData.story) {
                project.name = storyData.story.substring(0, 30) + (storyData.story.length > 30 ? '...' : '');
              }
            }
          } catch (storyError) {
            console.warn(`Failed to load story data for project ${projectId}:`, storyError);
          }
        }
      }
      
      // 转换为数组并排序
      const projects: ProjectListItem[] = Array.from(projectMap.values())
        .sort((a, b) => b.updatedAt - a.updatedAt); // 按更新时间倒序

      console.log(`✅ API: Returning ${projects.length} projects`);
      if (projects.length > 0) {
        console.log('📋 API: Project summary:');
        projects.forEach((project, index) => {
          console.log(`  ${index + 1}. ${project.name || project.id} (${new Date(project.updatedAt).toLocaleString()})`);
        });
      }

      return NextResponse.json({
        success: true,
        projects,
        total: projects.length,
      });
      
    } catch (listError) {
      console.error('Failed to list projects:', listError);
      
      // 如果列表失败，返回空列表而不是错误
      return NextResponse.json({
        success: true,
        projects: [],
        total: 0,
      });
    }

  } catch (error) {
    console.error('Get projects error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get projects' 
      },
      { status: 500 }
    );
  }
}

// 删除项目
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // 获取用户认证信息（支持匿名用户）
    let userId: string;
    const authHeader = request.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      // 认证用户
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: 'Invalid authorization token' },
          { status: 401 }
        );
      }

      userId = user.id;
    } else {
      // 匿名用户
      const deviceId = request.headers.get('x-device-id');
      if (!deviceId) {
        return NextResponse.json(
          { success: false, error: 'Device ID required for anonymous users' },
          { status: 401 }
        );
      }
      userId = deviceId;
    }
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User identification required' },
        { status: 401 }
      );
    }

    const { projectId } = await request.json();
    
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const r2Client = getR2Client();
    
    // 删除项目的所有文件
    const projectPrefix = userId.startsWith('anon_') 
      ? `anonymous/${userId}/projects/${projectId}/`
      : `users/${userId}/projects/${projectId}/`;
    
    try {
      const objects = await r2Client.listFiles(projectPrefix);

      // 批量删除所有文件
      const deletePromises = objects.map(obj =>
        obj.key ? r2Client.deleteFile(obj.key) : Promise.resolve()
      );
      
      await Promise.all(deletePromises);
      
      return NextResponse.json({
        success: true,
        message: 'Project deleted successfully',
        projectId,
        deletedFiles: objects.length,
      });
      
    } catch (deleteError) {
      console.error('Failed to delete project files:', deleteError);
      throw new Error('Failed to delete project files');
    }

  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete project' 
      },
      { status: 500 }
    );
  }
}
