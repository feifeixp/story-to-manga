/**
 * 新版本的项目列表API (v2)
 * 支持用户项目列表查询和管理
 */

import { NextRequest, NextResponse } from 'next/server';
import { newCloudStorage } from '@/lib/newCloudStorage';

// GET - 获取用户的项目列表
export async function GET(request: NextRequest) {
  try {
    console.log('📋 [Projects API v2] Getting user projects...');

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

    // 获取用户项目列表
    const result = await newCloudStorage.getUserProjects(userId);

    if (result.success) {
      console.log(`✅ [Projects API v2] Found ${result.data?.length || 0} projects for user ${userId}`);
      return NextResponse.json({
        success: true,
        data: result.data || [],
        count: result.data?.length || 0
      });
    } else {
      console.error(`❌ [Projects API v2] Failed to get projects for user ${userId}:`, result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ [Projects API v2] Error getting user projects:', error);
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
