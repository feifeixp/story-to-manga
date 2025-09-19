import { NextResponse } from 'next/server';
import { getR2Client } from '@/lib/r2Storage';

export async function GET() {
  try {
    // 测试 R2 连接
    const r2Client = getR2Client();
    
    // 简单的连接测试
    const testResult = await r2Client.testConnection();
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        r2Storage: testResult ? 'connected' : 'disconnected',
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
