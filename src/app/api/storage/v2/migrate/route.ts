/**
 * 数据迁移API (v2)
 * 支持从旧架构迁移到新架构
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataMigration } from '@/lib/dataMigration';

// POST - 执行数据迁移
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [Migration API v2] Starting data migration...');

    const requestData = await request.json();
    const { action, options } = requestData;

    // 验证管理员权限（简单的API密钥验证）
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      );
    }

    let result;

    switch (action) {
      case 'migrate':
        console.log('📦 Executing full data migration...');
        result = await dataMigration.migrateAllData();
        break;

      case 'validate':
        console.log('🔍 Validating migration results...');
        result = await dataMigration.validateMigration();
        break;

      case 'cleanup':
        console.log('🧹 Cleaning up migrated data...');
        result = await dataMigration.cleanupMigratedData();
        break;

      case 'report':
        console.log('📊 Generating migration report...');
        const report = await dataMigration.generateMigrationReport();
        return NextResponse.json({
          success: true,
          data: { report }
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Supported actions: migrate, validate, cleanup, report' },
          { status: 400 }
        );
    }

    console.log(`✅ [Migration API v2] Action '${action}' completed successfully`);

    return NextResponse.json({
      success: true,
      action,
      data: result
    });

  } catch (error) {
    console.error('❌ [Migration API v2] Error during migration:', error);
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

// GET - 获取迁移状态
export async function GET(request: NextRequest) {
  try {
    console.log('📊 [Migration API v2] Getting migration status...');

    // 验证管理员权限
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      );
    }

    // 生成迁移报告
    const report = await dataMigration.generateMigrationReport();

    return NextResponse.json({
      success: true,
      data: {
        report,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [Migration API v2] Error getting migration status:', error);
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
