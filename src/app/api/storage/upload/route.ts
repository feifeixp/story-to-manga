import { NextRequest, NextResponse } from 'next/server';
import { getR2Client, generateUserFilePath, generatePublicFilePath, base64ToBuffer, getFileExtension } from '@/lib/r2Storage';
import { supabase } from '@/lib/supabase';
import sharp from 'sharp';

// 支持的图片格式
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_DIMENSION = 2048; // 最大图片尺寸

interface UploadRequest {
  files: {
    data: string; // base64 data
    name: string;
    type: string;
    category: 'character' | 'setting' | 'panel' | 'avatar' | 'cover';
    projectId?: string;
    isPublic?: boolean;
  }[];
  userId?: string;
}

interface UploadResponse {
  success: boolean;
  files?: {
    name: string;
    url: string;
    key: string;
    size: number;
  }[];
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // 获取用户认证信息
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      
      userId = user.id;
    }

    const requestData: UploadRequest = await request.json();
    
    if (!requestData.files || requestData.files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    // 如果没有用户ID但请求中有，使用请求中的（用于向后兼容）
    if (!userId && requestData.userId) {
      userId = requestData.userId;
    }

    const r2Client = getR2Client();
    const uploadResults: {
      name: string;
      url: string;
      key: string;
      size: number;
    }[] = [];

    // 处理每个文件
    for (const file of requestData.files) {
      try {
        // 验证文件
        if (!file.data || !file.name || !file.type) {
          console.warn('Invalid file data:', { name: file.name, hasData: !!file.data, type: file.type });
          continue;
        }

        // 检查文件类型
        if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
          console.warn('Unsupported file type:', file.type);
          continue;
        }

        // 转换base64为Buffer
        const buffer = base64ToBuffer(file.data);
        
        // 检查文件大小
        if (buffer.length > MAX_FILE_SIZE) {
          console.warn('File too large:', { name: file.name, size: buffer.length });
          continue;
        }

        // 图片处理和优化
        let processedBuffer = buffer;
        try {
          const image = sharp(buffer);
          const metadata = await image.metadata();
          
          // 如果图片太大，进行压缩
          if (metadata.width && metadata.height && 
              (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION)) {
            processedBuffer = await image
              .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .jpeg({ quality: 85 })
              .toBuffer();
          } else {
            // 优化图片质量
            processedBuffer = await image
              .jpeg({ quality: 90 })
              .toBuffer();
          }
        } catch (imageError) {
          console.warn('Image processing failed, using original:', imageError);
          processedBuffer = buffer;
        }

        // 生成文件路径
        const timestamp = Date.now();
        const extension = getFileExtension(file.type);
        const fileName = `${file.category}_${timestamp}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
        
        let filePath: string;
        if (file.isPublic && file.projectId) {
          filePath = generatePublicFilePath(file.projectId, fileName);
        } else if (userId && file.projectId) {
          filePath = generateUserFilePath(userId, file.projectId, fileName);
        } else {
          // 临时文件路径
          filePath = `temp/${userId || 'anonymous'}/${fileName}`;
        }

        // 上传到R2
        const uploadResult = await r2Client.uploadFile(filePath, processedBuffer, {
          contentType: file.type,
          metadata: {
            originalName: file.name,
            category: file.category,
            userId: userId || 'anonymous',
            projectId: file.projectId || '',
            uploadedAt: new Date().toISOString(),
          },
          cacheControl: file.isPublic ? 'public, max-age=86400' : 'private, max-age=3600',
          isPublic: file.isPublic,
        });

        uploadResults.push({
          name: file.name,
          url: uploadResult,
          key: filePath,
          size: processedBuffer.length,
        });

        console.log('File uploaded successfully:', {
          name: file.name,
          key: filePath,
          size: processedBuffer.length,
          isPublic: file.isPublic,
        });

      } catch (fileError) {
        console.error('Failed to upload file:', file.name, fileError);
        // 继续处理其他文件，不中断整个上传过程
      }
    }

    if (uploadResults.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files were uploaded successfully' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      files: uploadResults,
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  }
}

// 获取预签名上传URL（用于大文件直接上传）
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');
    const contentType = searchParams.get('contentType');
    const category = searchParams.get('category');
    const projectId = searchParams.get('projectId');
    const isPublic = searchParams.get('isPublic') === 'true';

    if (!fileName || !contentType || !category) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 获取用户认证信息
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      
      userId = user.id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      );
    }

    const r2Client = getR2Client();
    
    // 生成文件路径
    const timestamp = Date.now();
    const extension = getFileExtension(contentType);
    const fileKey = `${category}_${timestamp}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
    
    let filePath: string;
    if (isPublic && projectId) {
      filePath = generatePublicFilePath(projectId, fileKey);
    } else if (projectId) {
      filePath = generateUserFilePath(userId, projectId, fileKey);
    } else {
      filePath = `temp/${userId}/${fileKey}`;
    }

    // 生成预签名URL
    const presignedUrl = await r2Client.generatePresignedUploadUrl(
      filePath,
      3600, // 1小时过期
      contentType
    );

    return NextResponse.json({
      presignedUrl,
      key: filePath,
      expiresIn: 3600,
    });

  } catch (error) {
    console.error('Presigned URL generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}
