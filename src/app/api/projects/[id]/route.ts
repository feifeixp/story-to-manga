import { NextRequest, NextResponse } from 'next/server';
import { projectService } from '@/lib/projectService';

/**
 * 获取单个项目详情
 * GET /api/projects/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    console.log(`📄 API: Getting project details for: ${projectId}`);

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 获取项目详情
    const project = await projectService.getProject(projectId);

    if (!project) {
      console.log(`❌ API: Project not found: ${projectId}`);
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log(`✅ API: Project found: ${project.name}`);

    return NextResponse.json({
      success: true,
      project
    });

  } catch (error) {
    console.error('❌ API: Failed to get project:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get project' 
      },
      { status: 500 }
    );
  }
}

/**
 * 更新单个项目
 * PUT /api/projects/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    console.log(`📝 API: Updating project: ${projectId}`);

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updateData = body;

    const updatedProject = await projectService.updateProject(projectId, updateData);

    console.log(`✅ API: Project updated: ${projectId}`);

    return NextResponse.json({
      success: true,
      project: updatedProject
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
 * 删除单个项目
 * DELETE /api/projects/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    console.log(`🗑️ API: Deleting project: ${projectId}`);

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
