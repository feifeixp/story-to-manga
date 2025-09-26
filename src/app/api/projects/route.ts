import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/lib/projectService';
import { ComicStyle } from '@/types';

/**
 * 获取项目列表
 * GET /api/projects
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📋 API: Getting project list...');

    const projects = await projectService.getProjects();

    console.log(`✅ API: Returning ${projects.length} projects`);

    return NextResponse.json({
      success: true,
      projects,
      total: projects.length
    });

  } catch (error) {
    console.error('❌ API: Failed to get project list:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project list',
        projects: [],
        total: 0
      },
      { status: 500 }
    );
  }
}

/**
 * 创建新项目
 * POST /api/projects
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📝 API: Creating new project...');

    const body = await request.json();
    const { name, description, style } = body;

    // 验证必需字段
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    const projectData = {
      name: name.trim(),
      description: description?.trim() || '',
      style: (style as ComicStyle) || 'manga'
    };

    const project = await projectService.createProject(projectData);

    console.log(`✅ API: Project created: ${project.id}`);

    return NextResponse.json({
      success: true,
      project,
      projectId: project.id
    });

  } catch (error) {
    console.error('❌ API: Failed to create project:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project'
      },
      { status: 500 }
    );
  }
}

/**
 * 更新项目
 * PUT /api/projects
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('📝 API: Updating project...');

    const body = await request.json();
    const { projectId, ...updateData } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const project = await projectService.updateProject(projectId, updateData);

    console.log(`✅ API: Project updated: ${projectId}`);

    return NextResponse.json({
      success: true,
      project
    });

  } catch (error) {
    console.error('❌ API: Failed to update project:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project'
      },
      { status: 500 }
    );
  }
}

/**
 * 删除项目
 * DELETE /api/projects
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ API: Deleting project...');

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    await projectService.deleteProject(projectId);

    console.log(`✅ API: Project deleted: ${projectId}`);

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('❌ API: Failed to delete project:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project'
      },
      { status: 500 }
    );
  }
}
