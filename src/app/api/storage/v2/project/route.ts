/**
 * 新版本的项目存储API (v2)
 * 支持分离的JSON数据保存和按需加载
 */

import { NextRequest, NextResponse } from 'next/server';
import { newCloudStorage } from '@/lib/newCloudStorage';
import { getDeviceId } from '@/lib/deviceFingerprint';

// POST - 保存项目数据
export async function POST(request: NextRequest) {
  try {
    console.log('📝 [Storage API v2] Saving project data...');

    const requestData = await request.json();
    const {
      projectId,
      story,
      style,
      aiModel,
      storyAnalysis,
      storyBreakdown,
      characterReferences,
      generatedPanels,
      uploadedCharacterReferences,
      uploadedSettingReferences,
      imageSize,
      generationState,
      setting,
      scenes
    } = requestData;

    // 验证必需字段
    if (!projectId || !story || !style) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: projectId, story, style' },
        { status: 400 }
      );
    }

    // 获取用户ID
    let userId: string;
    const authHeader = request.headers.get('authorization');
    const deviceId = request.headers.get('x-device-id');

    if (authHeader?.startsWith('Bearer ')) {
      // Supabase用户
      const token = authHeader.substring(7);
      // TODO: 验证Supabase token并获取用户ID
      userId = 'supabase-user-id'; // 临时占位符
    } else if (deviceId) {
      // 匿名用户
      userId = `device-${deviceId}`;
    } else {
      return NextResponse.json(
        { success: false, error: 'Device ID required for anonymous users' },
        { status: 401 }
      );
    }

    console.log(`👤 User ID: ${userId}`);
    console.log(`📊 Project data summary:`, {
      projectId,
      story: story.slice(0, 50) + '...',
      style,
      aiModel,
      hasStoryAnalysis: !!storyAnalysis,
      hasStoryBreakdown: !!storyBreakdown,
      characterReferencesCount: characterReferences?.length || 0,
      generatedPanelsCount: generatedPanels?.length || 0,
      uploadedCharacterReferencesCount: uploadedCharacterReferences?.length || 0,
      uploadedSettingReferencesCount: uploadedSettingReferences?.length || 0
    });

    // 使用新的存储服务保存数据
    const result = await newCloudStorage.saveProject(
      projectId,
      userId,
      {
        story,
        style,
        aiModel: aiModel || 'auto',
        storyAnalysis,
        storyBreakdown,
        characterReferences: characterReferences || [],
        generatedPanels: generatedPanels || [],
        uploadedCharacterReferences: uploadedCharacterReferences || [],
        uploadedSettingReferences: uploadedSettingReferences || [],
        imageSize: imageSize || {
          width: 1024,
          height: 576,
          aspectRatio: '16:9'
        },
        generationState,
        setting,
        scenes: scenes || []
      }
    );

    if (result.success) {
      console.log(`✅ [Storage API v2] Project ${projectId} saved successfully`);
      return NextResponse.json({
        success: true,
        message: 'Project saved successfully with new architecture',
        data: result.data
      });
    } else {
      console.error(`❌ [Storage API v2] Failed to save project ${projectId}:`, result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ [Storage API v2] Error saving project:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - 加载项目数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const includeGeneration = searchParams.get('includeGeneration') !== 'false';
    const includeImages = searchParams.get('includeImages') !== 'false';

    console.log(`📖 [Storage API v2] Loading project ${projectId}...`);

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 获取用户ID
    let userId: string;
    const authHeader = request.headers.get('authorization');
    const deviceId = request.headers.get('x-device-id');

    if (authHeader?.startsWith('Bearer ')) {
      // Supabase用户
      const token = authHeader.substring(7);
      // TODO: 验证Supabase token并获取用户ID
      userId = 'supabase-user-id'; // 临时占位符
    } else if (deviceId) {
      // 匿名用户
      userId = `device-${deviceId}`;
    } else {
      return NextResponse.json(
        { success: false, error: 'Device ID required for anonymous users' },
        { status: 401 }
      );
    }

    console.log(`👤 User ID: ${userId}`);

    // 使用新的存储服务加载数据
    const result = await newCloudStorage.loadProject(
      projectId,
      userId,
      {
        includeGeneration,
        includeImages
      }
    );

    if (result.success) {
      console.log(`✅ [Storage API v2] Project ${projectId} loaded successfully`);
      return NextResponse.json({
        success: true,
        data: result.data
      });
    } else {
      console.error(`❌ [Storage API v2] Failed to load project ${projectId}:`, result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('❌ [Storage API v2] Error loading project:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE - 删除项目
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    console.log(`🗑️ [Storage API v2] Deleting project ${projectId}...`);

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 获取用户ID
    let userId: string;
    const authHeader = request.headers.get('authorization');
    const deviceId = request.headers.get('x-device-id');

    if (authHeader?.startsWith('Bearer ')) {
      // Supabase用户
      const token = authHeader.substring(7);
      // TODO: 验证Supabase token并获取用户ID
      userId = 'supabase-user-id'; // 临时占位符
    } else if (deviceId) {
      // 匿名用户
      userId = `device-${deviceId}`;
    } else {
      return NextResponse.json(
        { success: false, error: 'Device ID required for anonymous users' },
        { status: 401 }
      );
    }

    console.log(`👤 User ID: ${userId}`);

    // TODO: 实现项目删除逻辑
    console.log(`⚠️ [Storage API v2] Project deletion not yet implemented`);

    return NextResponse.json(
      { success: false, error: 'Project deletion not yet implemented' },
      { status: 501 }
    );

  } catch (error) {
    console.error('❌ [Storage API v2] Error deleting project:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
