import { NextRequest, NextResponse } from 'next/server';
import { getR2Client } from '@/lib/r2Storage';
import { getDeviceId } from '@/lib/deviceFingerprint';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const panelNumber = searchParams.get('panelNumber');

    if (!projectId || !panelNumber) {
      return NextResponse.json(
        { error: 'Missing projectId or panelNumber' },
        { status: 400 }
      );
    }

    // 获取用户ID（认证用户或匿名用户）
    let userId: string;
    const authHeader = request.headers.get('authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      // 认证用户
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      
      userId = user.id;
    } else {
      // 匿名用户
      const deviceId = request.headers.get('x-device-id');
      if (!deviceId) {
        // 生成临时设备ID
        userId = await getDeviceId();
      } else {
        userId = deviceId;
      }
    }

    // 查找实际的文件路径（因为用户ID可能不匹配）
    const { getR2Client } = await import('@/lib/r2Storage');
    const r2Client = getR2Client();

    // 搜索模式：*/projects/{projectId}/panels/panel_{panelNumber}.jpg
    const searchSuffix = `/projects/${projectId}/panels/panel_${panelNumber}.jpg`;

    let actualObjectKey: string | null = null;

    try {
      // 列出所有文件，查找匹配的面板
      const files = await r2Client.listFiles('', 1000);

      // 查找匹配的文件
      const matchingFile = files.find(file =>
        file.key.endsWith(searchSuffix)
      );

      if (matchingFile) {
        actualObjectKey = matchingFile.key;
        console.log(`✅ Found actual file at: ${actualObjectKey}`);
      }
    } catch (error) {
      console.error('❌ Error searching for file:', error);
    }

    if (!actualObjectKey) {
      // 如果找不到文件，使用默认路径
      actualObjectKey = `${userId}/projects/${projectId}/panels/panel_${panelNumber}.jpg`;
      console.log(`⚠️ File not found, using default path: ${actualObjectKey}`);
    }

    // 生成公开URL（用于分享功能）
    const { generatePublicUrl } = await import('@/lib/r2Config');
    const publicUrl = generatePublicUrl(actualObjectKey);

    console.log(`🔗 Generated public URL for panel ${panelNumber}: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      objectKey: actualObjectKey,
      isPublic: true
    });

  } catch (error) {
    console.error('❌ Error getting panel URL:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get panel URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
