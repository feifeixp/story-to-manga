import { NextRequest, NextResponse } from 'next/server';
import { getR2Client } from '@/lib/r2Storage';
import { supabase } from '@/lib/supabase';

interface DownloadRequest {
  key: string;
  userId?: string;
  generatePresignedUrl?: boolean;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const generatePresignedUrl = searchParams.get('presigned') === 'true';

    if (!key) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      );
    }

    // 检查是否是公开文件
    const isPublicFile = key.startsWith('public/');
    
    let userId: string | null = null;

    // 如果不是公开文件，需要验证用户权限
    if (!isPublicFile) {
      const authHeader = request.headers.get('authorization');
      
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Authorization required for private files' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return NextResponse.json(
          { error: 'Invalid authorization token' },
          { status: 401 }
        );
      }
      
      userId = user.id;

      // 验证用户是否有权限访问该文件
      if (!key.startsWith(`users/${userId}/`)) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const r2Client = getR2Client();

    // 检查文件是否存在
    const fileExists = await r2Client.fileExists(key);
    if (!fileExists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // 如果请求预签名URL
    if (generatePresignedUrl) {
      try {
        const presignedUrl = await r2Client.generatePresignedDownloadUrl(key, 3600); // 1小时过期
        
        return NextResponse.json({
          presignedUrl,
          expiresIn: 3600,
        });
      } catch (error) {
        console.error('Failed to generate presigned URL:', error);
        return NextResponse.json(
          { error: 'Failed to generate download URL' },
          { status: 500 }
        );
      }
    }

    // 直接下载文件
    try {
      const fileBuffer = await r2Client.downloadFile(key);
      const fileInfo = await r2Client.getFileInfo(key);
      
      // 设置响应头
      const headers = new Headers();
      headers.set('Content-Type', fileInfo?.contentType || 'application/octet-stream');
      headers.set('Content-Length', fileBuffer.length.toString());
      headers.set('Cache-Control', isPublicFile ? 'public, max-age=86400' : 'private, max-age=3600');
      
      // 如果是图片，设置内联显示
      if (fileInfo?.contentType?.startsWith('image/')) {
        headers.set('Content-Disposition', 'inline');
      }

      return new NextResponse(fileBuffer, {
        status: 200,
        headers,
      });

    } catch (error) {
      console.error('Failed to download file:', error);
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const requestData: DownloadRequest = await request.json();
    const { key, userId, generatePresignedUrl } = requestData;

    if (!key) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      );
    }

    // 检查是否是公开文件
    const isPublicFile = key.startsWith('public/');
    
    let authenticatedUserId: string | null = null;

    // 如果不是公开文件，需要验证用户权限
    if (!isPublicFile) {
      const authHeader = request.headers.get('authorization');
      
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Authorization required for private files' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return NextResponse.json(
          { error: 'Invalid authorization token' },
          { status: 401 }
        );
      }
      
      authenticatedUserId = user.id;

      // 验证用户是否有权限访问该文件
      const requestUserId = userId || authenticatedUserId;
      if (!key.startsWith(`users/${requestUserId}/`)) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const r2Client = getR2Client();

    // 检查文件是否存在
    const fileExists = await r2Client.fileExists(key);
    if (!fileExists) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // 如果请求预签名URL
    if (generatePresignedUrl) {
      try {
        const presignedUrl = await r2Client.generatePresignedDownloadUrl(key, 3600); // 1小时过期
        
        return NextResponse.json({
          success: true,
          presignedUrl,
          expiresIn: 3600,
        });
      } catch (error) {
        console.error('Failed to generate presigned URL:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to generate download URL' },
          { status: 500 }
        );
      }
    }

    // 返回文件信息（不直接返回文件内容，避免大文件问题）
    try {
      const fileInfo = await r2Client.getFileInfo(key);
      
      if (!fileInfo) {
        return NextResponse.json(
          { error: 'File information not available' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        fileInfo: {
          key: fileInfo.key,
          size: fileInfo.size,
          lastModified: fileInfo.lastModified,
          contentType: fileInfo.contentType,
          metadata: fileInfo.metadata,
        },
      });

    } catch (error) {
      console.error('Failed to get file info:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get file information' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
