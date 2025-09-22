import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// R2客户端配置
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { projectId, data } = await request.json();

    if (!projectId || !data) {
      return NextResponse.json(
        { error: 'Missing projectId or data' },
        { status: 400 }
      );
    }

    console.log('🚀 开始上传项目数据到R2...');
    console.log(`📦 项目ID: ${projectId}`);

    // 1. 上传完整项目JSON
    const jsonKey = `projects/${projectId}/project-complete.json`;
    const jsonData = JSON.stringify(data, null, 2);

    const putJsonCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: jsonKey,
      Body: jsonData,
      ContentType: 'application/json',
      CacheControl: 'public, max-age=3600',
      Metadata: {
        'project-id': projectId,
        'upload-time': new Date().toISOString(),
        'data-type': 'project-complete',
      },
    });

    await r2Client.send(putJsonCommand);
    console.log(`✅ JSON文件上传成功: ${jsonKey}`);

    // 2. 生成公开访问URL
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;
    const publicUrl = `${publicDomain}/${jsonKey}`;

    // 3. 如果有面板图片需要上传（base64格式）
    let uploadedImages = 0;
    if (data.generation?.generatedPanels) {
      for (const panel of data.generation.generatedPanels) {
        if (panel.image && panel.image.startsWith('data:image/')) {
          try {
            // 转换base64为buffer
            const base64Data = panel.image.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            // 上传图片
            const imageKey = `projects/${projectId}/panels/panel_${panel.panelNumber}.jpg`;
            const putImageCommand = new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME!,
              Key: imageKey,
              Body: imageBuffer,
              ContentType: 'image/jpeg',
              CacheControl: 'public, max-age=86400',
              Metadata: {
                'project-id': projectId,
                'panel-number': panel.panelNumber.toString(),
                'upload-time': new Date().toISOString(),
              },
            });

            await r2Client.send(putImageCommand);
            
            // 更新面板数据中的图片URL
            panel.image = `${publicDomain}/${imageKey}`;
            uploadedImages++;
            
            console.log(`✅ 面板图片上传成功: ${imageKey}`);
          } catch (imageError) {
            console.warn(`⚠️ 面板 ${panel.panelNumber} 图片上传失败:`, imageError);
          }
        }
      }
    }

    // 4. 如果有角色图片需要上传
    let uploadedCharacters = 0;
    if (data.generation?.characterReferences) {
      for (const character of data.generation.characterReferences) {
        if (character.image && character.image.startsWith('data:image/')) {
          try {
            const base64Data = character.image.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            
            const characterKey = `projects/${projectId}/characters/${character.name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
            const putCharacterCommand = new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME!,
              Key: characterKey,
              Body: imageBuffer,
              ContentType: 'image/jpeg',
              CacheControl: 'public, max-age=86400',
              Metadata: {
                'project-id': projectId,
                'character-name': character.name,
                'upload-time': new Date().toISOString(),
              },
            });

            await r2Client.send(putCharacterCommand);
            
            // 更新角色数据中的图片URL
            character.image = `${publicDomain}/${characterKey}`;
            uploadedCharacters++;
            
            console.log(`✅ 角色图片上传成功: ${characterKey}`);
          } catch (characterError) {
            console.warn(`⚠️ 角色 ${character.name} 图片上传失败:`, characterError);
          }
        }
      }
    }

    // 5. 如果有图片被转换，重新上传更新的JSON
    if (uploadedImages > 0 || uploadedCharacters > 0) {
      const updatedJsonData = JSON.stringify(data, null, 2);
      const updateJsonCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: jsonKey,
        Body: updatedJsonData,
        ContentType: 'application/json',
        CacheControl: 'public, max-age=3600',
        Metadata: {
          'project-id': projectId,
          'upload-time': new Date().toISOString(),
          'data-type': 'project-complete-updated',
          'images-converted': (uploadedImages + uploadedCharacters).toString(),
        },
      });

      await r2Client.send(updateJsonCommand);
      console.log('✅ 更新的JSON文件上传成功');
    }

    return NextResponse.json({
      success: true,
      message: 'Project data uploaded successfully',
      data: {
        projectId,
        jsonUrl: publicUrl,
        uploadedImages,
        uploadedCharacters,
        totalSize: jsonData.length,
      },
    });

  } catch (error) {
    console.error('❌ R2上传失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { error: 'Missing projectId parameter' },
      { status: 400 }
    );
  }

  try {
    // 生成项目JSON的公开访问URL
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;
    const jsonUrl = `${publicDomain}/projects/${projectId}/project-complete.json`;

    // 测试文件是否存在
    const response = await fetch(jsonUrl);
    const exists = response.ok;

    return NextResponse.json({
      success: true,
      projectId,
      jsonUrl,
      exists,
      status: response.status,
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Check failed',
      },
      { status: 500 }
    );
  }
}
