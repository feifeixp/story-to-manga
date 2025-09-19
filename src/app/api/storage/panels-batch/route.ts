import { NextRequest, NextResponse } from 'next/server';
import { getR2Client, base64ToBuffer } from '@/lib/r2Storage';
import { supabase } from '@/lib/supabase';
import { deviceFingerprint } from '@/lib/deviceFingerprint';

interface PanelData {
  panelNumber: number;
  imageData: string;
  metadata?: {
    generatedAt: string;
    userType: 'anonymous' | 'registered';
    [key: string]: any;
  };
}

interface SavePanelsBatchRequest {
  userId: string;
  projectId: string;
  panels: PanelData[];
}

export async function POST(request: NextRequest) {
  try {
    const requestData: SavePanelsBatchRequest = await request.json();
    const { userId, projectId, panels } = requestData;

    if (!userId || !projectId || !panels || !Array.isArray(panels)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields or invalid panels data' },
        { status: 400 }
      );
    }

    if (panels.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No panels to save' },
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
    const results: Array<{ panelNumber: number; url: string; success: boolean; error?: string }> = [];
    const uploadPromises: Promise<void>[] = [];

    // 批量处理面板上传
    for (const panel of panels) {
      const uploadPromise = (async () => {
        try {
          const { panelNumber, imageData, metadata } = panel;

          if (!panelNumber || !imageData) {
            results.push({
              panelNumber: panelNumber || 0,
              url: '',
              success: false,
              error: 'Missing panel number or image data'
            });
            return;
          }

          // 生成存储路径
          let storagePath: string;
          if (deviceFingerprint.isAnonymous(actualUserId)) {
            storagePath = `anonymous/${actualUserId}/projects/${projectId}/panels/panel_${panelNumber}.jpg`;
          } else {
            storagePath = `users/${actualUserId}/projects/${projectId}/panels/panel_${panelNumber}.jpg`;
          }

          // 转换base64图片数据
          let imageBuffer: Buffer;
          try {
            imageBuffer = base64ToBuffer(imageData);
          } catch (error) {
            results.push({
              panelNumber,
              url: '',
              success: false,
              error: 'Invalid image data format'
            });
            return;
          }

          // 上传到R2
          await r2Client.uploadFile(storagePath, imageBuffer, {
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

          results.push({
            panelNumber,
            url: accessUrl,
            success: true
          });

        } catch (error) {
          console.error(`Error uploading panel ${panel.panelNumber}:`, error);
          results.push({
            panelNumber: panel.panelNumber || 0,
            url: '',
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed'
          });
        }
      })();

      uploadPromises.push(uploadPromise);
    }

    // 等待所有上传完成
    await Promise.all(uploadPromises);

    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`Batch upload completed for ${actualUserId}: ${successCount} success, ${failureCount} failures`);

    return NextResponse.json({
      success: failureCount === 0,
      panels: results,
      summary: {
        total: results.length,
        success: successCount,
        failures: failureCount
      },
      metadata: {
        userId: actualUserId,
        projectId,
        userType: deviceFingerprint.isAnonymous(actualUserId) ? 'anonymous' : 'registered',
        uploadedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Error in batch panel upload:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save panels' 
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

    if (!userId || !projectId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 验证用户身份
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
    
    // 生成基础路径
    let basePath: string;
    if (deviceFingerprint.isAnonymous(actualUserId)) {
      basePath = `anonymous/${actualUserId}/projects/${projectId}/panels/`;
    } else {
      basePath = `users/${actualUserId}/projects/${projectId}/panels/`;
    }

    try {
      // 列出项目的所有面板
      const files = await r2Client.listFiles(basePath);
      const panels: Array<{ panelNumber: number; url: string }> = [];

      for (const file of files) {
        const match = file.key.match(/panel_(\d+)\.jpg$/);
        if (match) {
          const panelNumber = parseInt(match[1]);
          const url = `https://fac7207421271dd5183fcab70164cad1.r2.cloudflarestorage.com/mangashare/${file.key}`;
          panels.push({ panelNumber, url });
        }
      }

      // 按面板号排序
      panels.sort((a, b) => a.panelNumber - b.panelNumber);

      return NextResponse.json({
        success: true,
        panels,
        count: panels.length,
        metadata: {
          userId: actualUserId,
          projectId,
          userType: deviceFingerprint.isAnonymous(actualUserId) ? 'anonymous' : 'registered',
        }
      });

    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to list panels' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Error retrieving panels from cloud:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to retrieve panels' 
      },
      { status: 500 }
    );
  }
}
