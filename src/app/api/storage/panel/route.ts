import { NextRequest, NextResponse } from 'next/server';
import { getR2Client, base64ToBuffer } from '@/lib/r2Storage';
import { supabase } from '@/lib/supabase';
import { deviceFingerprint } from '@/lib/deviceFingerprint';

interface SavePanelRequest {
  userId: string;
  projectId: string;
  panelNumber: number;
  imageData: string;
  metadata?: {
    generatedAt: string;
    userType: 'anonymous' | 'registered';
    [key: string]: any;
  };
}

export async function POST(request: NextRequest) {
  try {
    const requestData: SavePanelRequest = await request.json();
    const { userId, projectId, panelNumber, imageData, metadata } = requestData;

    if (!userId || !projectId || !panelNumber || !imageData) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 验证用户身份
    let isValidUser = false;
    let actualUserId = userId;

    // 检查是否为注册用户
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        isValidUser = true;
        actualUserId = user.id;
      }
    }

    // 检查是否为匿名用户
    if (!isValidUser) {
      const deviceId = request.headers.get('x-device-id');
      if (deviceId && deviceFingerprint.isAnonymous(deviceId) && deviceId === userId) {
        isValidUser = true;
        actualUserId = deviceId;
      }
    }

    if (!isValidUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid user authentication' },
        { status: 401 }
      );
    }

    const r2Client = getR2Client();
    
    // 生成存储路径
    let storagePath: string;
    if (deviceFingerprint.isAnonymous(actualUserId)) {
      // 匿名用户路径
      storagePath = `anonymous/${actualUserId}/projects/${projectId}/panels/panel_${panelNumber}.jpg`;
    } else {
      // 注册用户路径
      storagePath = `users/${actualUserId}/projects/${projectId}/panels/panel_${panelNumber}.jpg`;
    }

    // 转换base64图片数据
    let imageBuffer: Buffer;
    try {
      imageBuffer = base64ToBuffer(imageData);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid image data format' },
        { status: 400 }
      );
    }

    // 上传到R2
    const uploadResult = await r2Client.uploadFile(storagePath, imageBuffer, {
      contentType: 'image/jpeg',
      metadata: {
        type: 'generated-panel',
        userId: actualUserId,
        projectId,
        panelNumber: panelNumber.toString(),
        userType: deviceFingerprint.isAnonymous(actualUserId) ? 'anonymous' : 'registered',
        uploadedAt: new Date().toISOString(),
        ...metadata,
      },
    });

    // 生成访问URL
    const accessUrl = `https://fac7207421271dd5183fcab70164cad1.r2.cloudflarestorage.com/mangashare/${storagePath}`;

    console.log(`Panel ${panelNumber} saved successfully for ${actualUserId} (${deviceFingerprint.isAnonymous(actualUserId) ? 'anonymous' : 'registered'})`);

    return NextResponse.json({
      success: true,
      url: accessUrl,
      key: storagePath,
      panelNumber,
      metadata: {
        userId: actualUserId,
        projectId,
        userType: deviceFingerprint.isAnonymous(actualUserId) ? 'anonymous' : 'registered',
        uploadedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Error saving panel to cloud:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save panel' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const projectId = searchParams.get('projectId');
    const panelNumber = searchParams.get('panelNumber');

    if (!userId || !projectId || !panelNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 验证用户身份（同POST方法）
    let isValidUser = false;
    let actualUserId = userId;

    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        isValidUser = true;
        actualUserId = user.id;
      }
    }

    if (!isValidUser) {
      const deviceId = request.headers.get('x-device-id');
      if (deviceId && deviceFingerprint.isAnonymous(deviceId) && deviceId === userId) {
        isValidUser = true;
        actualUserId = deviceId;
      }
    }

    if (!isValidUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid user authentication' },
        { status: 401 }
      );
    }

    const r2Client = getR2Client();
    
    // 生成存储路径
    let storagePath: string;
    if (deviceFingerprint.isAnonymous(actualUserId)) {
      storagePath = `anonymous/${actualUserId}/projects/${projectId}/panels/panel_${panelNumber}.jpg`;
    } else {
      storagePath = `users/${actualUserId}/projects/${projectId}/panels/panel_${panelNumber}.jpg`;
    }

    try {
      // 从R2下载图片
      const imageBuffer = await r2Client.downloadFile(storagePath);
      const base64Data = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

      return NextResponse.json({
        success: true,
        imageData: base64Data,
        panelNumber: parseInt(panelNumber),
        metadata: {
          userId: actualUserId,
          projectId,
          userType: deviceFingerprint.isAnonymous(actualUserId) ? 'anonymous' : 'registered',
        }
      });

    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Panel not found' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Error retrieving panel from cloud:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to retrieve panel' 
      },
      { status: 500 }
    );
  }
}
