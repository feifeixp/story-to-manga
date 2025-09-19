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

    // 构建R2对象键
    const objectKey = `${userId}/projects/${projectId}/panels/panel_${panelNumber}.jpg`;
    
    console.log(`🔍 Looking for panel at key: ${objectKey}`);

    // 获取R2客户端
    const r2Client = getR2Client();
    
    // 检查对象是否存在
    try {
      await r2Client.headObject({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: objectKey,
      });
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return NextResponse.json(
          { error: 'Panel not found in cloud storage' },
          { status: 404 }
        );
      }
      throw error;
    }

    // 生成预签名URL（有效期1小时）
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: objectKey,
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

    console.log(`✅ Generated signed URL for panel ${panelNumber}`);

    return NextResponse.json({
      success: true,
      url: signedUrl,
      objectKey,
      expiresIn: 3600
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
