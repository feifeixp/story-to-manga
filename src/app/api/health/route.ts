import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 测试 Supabase 连接
    const { data, error } = await supabase
      .from('projects')
      .select('count')
      .limit(1);

    const supabaseHealthy = !error;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        supabase: supabaseHealthy ? 'connected' : 'disconnected',
        api: 'running'
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
