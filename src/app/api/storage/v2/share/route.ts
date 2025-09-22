/**
 * 新版本的公开分享API (v2)
 * 支持无重复数据的公开分享
 */

import { NextRequest, NextResponse } from 'next/server';
import { newCloudStorage } from '@/lib/newCloudStorage';

// POST - 创建公开分享
export async function POST(request: NextRequest) {
  try {
    console.log('🔗 [Share API v2] Creating public share...');

    const requestData = await request.json();
    const {
      projectId,
      title,
      description,
      tags,
      authorName,
      authorAvatar
    } = requestData;

    // 验证必需字段
    if (!projectId || !title || !authorName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: projectId, title, authorName' },
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
    console.log(`📊 Share data:`, {
      projectId,
      title,
      description: description?.slice(0, 50) + (description?.length > 50 ? '...' : ''),
      tags,
      authorName
    });

    // 创建公开分享
    const result = await newCloudStorage.createPublicShare(
      projectId,
      userId,
      {
        title,
        description,
        tags: tags || [],
        authorName,
        authorAvatar
      }
    );

    if (result.success) {
      console.log(`✅ [Share API v2] Public share created successfully: ${result.data?.comicId}`);
      return NextResponse.json({
        success: true,
        message: 'Public share created successfully',
        data: result.data
      });
    } else {
      console.error(`❌ [Share API v2] Failed to create public share:`, result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ [Share API v2] Error creating public share:', error);
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

// GET - 获取公开分享数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const comicId = searchParams.get('comicId');

    console.log(`📖 [Share API v2] Loading public comic ${comicId}...`);

    if (!comicId) {
      return NextResponse.json(
        { success: false, error: 'Comic ID is required' },
        { status: 400 }
      );
    }

    // 加载公开漫画数据
    const result = await newCloudStorage.loadPublicComic(comicId);

    if (result.success) {
      console.log(`✅ [Share API v2] Public comic ${comicId} loaded successfully`);
      return NextResponse.json({
        success: true,
        data: result.data
      });
    } else {
      console.error(`❌ [Share API v2] Failed to load public comic ${comicId}:`, result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('❌ [Share API v2] Error loading public comic:', error);
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
