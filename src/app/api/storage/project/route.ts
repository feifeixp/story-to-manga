import { NextRequest, NextResponse } from 'next/server';
import { getR2Client, generateUserFilePath, base64ToBuffer } from '@/lib/r2Storage';
import { supabase } from '@/lib/supabase';
import type {
  ProjectData,
  ProjectMetadata,
  CreateProjectParams,
  UpdateProjectParams,
} from '@/types/project';
import type {
  CharacterReference,
  ComicStyle,
  GeneratedPanel,
  StoryAnalysis,
  StoryBreakdown,
  UploadedCharacterReference,
  UploadedSettingReference,
} from '@/types';

interface SaveProjectRequest {
  projectId: string;
  metadata?: Partial<ProjectMetadata>;
  story?: string;
  style?: ComicStyle;
  storyAnalysis?: StoryAnalysis | null;
  storyBreakdown?: StoryBreakdown | null;
  characterReferences?: CharacterReference[];
  generatedPanels?: GeneratedPanel[];
  uploadedCharacterReferences?: UploadedCharacterReference[];
  uploadedSettingReferences?: UploadedSettingReference[];
  setting?: any;
  scenes?: any[];
  imageSize?: any;
  generationState?: any;
}

interface LoadProjectRequest {
  projectId: string;
}

// 保存项目数据
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 获取用户认证信息（支持匿名用户）
    let userId: string;
    const authHeader = request.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      // 认证用户
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: 'Invalid authorization token' },
          { status: 401 }
        );
      }

      userId = user.id;
    } else {
      // 匿名用户
      const deviceId = request.headers.get('x-device-id');
      if (!deviceId) {
        return NextResponse.json(
          { success: false, error: 'Device ID required for anonymous users' },
          { status: 401 }
        );
      }
      userId = deviceId;
    }
    const requestData: SaveProjectRequest = await request.json();
    const { projectId } = requestData;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const r2Client = getR2Client();
    const timestamp = Date.now();

    // 保存项目元数据
    if (requestData.metadata) {
      const metadataPath = generateUserFilePath(userId, projectId, 'metadata.json');
      const metadataContent = JSON.stringify({
        ...requestData.metadata,
        id: projectId,
        updatedAt: timestamp,
      }, null, 2);

      await r2Client.uploadFile(metadataPath, metadataContent, {
        contentType: 'application/json',
        metadata: {
          type: 'project-metadata',
          userId,
          projectId,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // 保存故事数据
    const storyData = {
      version: '2.0.0',
      story: requestData.story || '',
      style: requestData.style || 'manga',
      aiModel: requestData.aiModel || 'auto',
      storyAnalysis: requestData.storyAnalysis || null,
      storyBreakdown: requestData.storyBreakdown || null,
      characterReferences: (requestData.characterReferences || []).map(char => {
        // 保留R2 URL，只移除base64数据（base64数据会单独保存到文件）
        if (char.image && char.image.startsWith('http')) {
          return char; // 保留R2 URL
        } else {
          const { image, ...charWithoutImage } = char;
          return charWithoutImage; // 移除base64数据
        }
      }),
      generatedPanels: (requestData.generatedPanels || []).map(panel => {
        // 保留R2 URL，只移除base64数据
        if (panel.image && panel.image.startsWith('http')) {
          return panel; // 保留R2 URL
        } else {
          const { image, ...panelWithoutImage } = panel;
          return panelWithoutImage; // 移除base64数据
        }
      }),
      uploadedCharacterReferences: (requestData.uploadedCharacterReferences || []).map(({ image, ...ref }) => ref),
      uploadedSettingReferences: (requestData.uploadedSettingReferences || []).map(({ image, ...ref }) => ref),
      setting: requestData.setting,
      scenes: requestData.scenes || [],
      imageSize: requestData.imageSize,
      generationState: requestData.generationState,
      timestamp,
    };

    const storyPath = generateUserFilePath(userId, projectId, 'story.json');
    await r2Client.uploadFile(storyPath, JSON.stringify(storyData, null, 2), {
      contentType: 'application/json',
      metadata: {
        type: 'story-data',
        userId,
        projectId,
        updatedAt: new Date().toISOString(),
      },
    });

    // 保存图片文件
    const imageUploadPromises: Promise<void>[] = [];

    // 保存角色参考图片（只保存base64数据，R2 URL不需要重复保存）
    if (requestData.characterReferences) {
      for (const char of requestData.characterReferences) {
        if (char.image && char.image.startsWith('data:image/')) {
          // 只有base64数据才需要保存到云端
          const imagePath = generateUserFilePath(userId, projectId, `characters/generated/${char.name}.jpg`);
          const imageBuffer = base64ToBuffer(char.image);

          console.log(`💾 Saving character image: ${char.name} to ${imagePath}`);

          imageUploadPromises.push(
            r2Client.uploadFile(imagePath, imageBuffer, {
              contentType: 'image/jpeg',
              metadata: {
                type: 'character-image',
                characterName: char.name,
                userId,
                projectId,
                uploadedAt: new Date().toISOString(),
              },
            }).then(() => {
              console.log(`✅ Character image saved: ${char.name}`);
            }).catch(error => {
              console.error(`❌ Failed to save character image ${char.name}:`, error);
            })
          );
        } else if (char.image && char.image.startsWith('http')) {
          console.log(`🔗 Character ${char.name} already has R2 URL, skipping save`);
        } else {
          console.warn(`⚠️ Character ${char.name} has no image data`);
        }
      }
    }

    // 保存生成的面板图片（只保存base64数据，R2 URL已经存在云端）
    if (requestData.generatedPanels) {
      for (const panel of requestData.generatedPanels) {
        if (panel.image && panel.image.startsWith('data:image/')) {
          // 只有base64数据才需要保存到云端
          const imagePath = generateUserFilePath(userId, projectId, `panels/${panel.panelNumber}.jpg`);
          const imageBuffer = base64ToBuffer(panel.image);

          imageUploadPromises.push(
            r2Client.uploadFile(imagePath, imageBuffer, {
              contentType: 'image/jpeg',
              metadata: {
                type: 'panel-image',
                panelNumber: panel.panelNumber.toString(),
                userId,
                projectId,
                uploadedAt: new Date().toISOString(),
              },
            }).then(() => {})
          );
        }
        // R2 URL不需要重新保存，已经在云端了
      }
    }

    // 保存上传的角色参考图片
    if (requestData.uploadedCharacterReferences) {
      for (const ref of requestData.uploadedCharacterReferences) {
        if (ref.image) {
          const imagePath = generateUserFilePath(userId, projectId, `characters/uploaded/${ref.id}.jpg`);
          const imageBuffer = base64ToBuffer(ref.image);
          
          imageUploadPromises.push(
            r2Client.uploadFile(imagePath, imageBuffer, {
              contentType: 'image/jpeg',
              metadata: {
                type: 'uploaded-character-ref',
                refId: ref.id,
                refName: ref.name,
                userId,
                projectId,
                uploadedAt: new Date().toISOString(),
              },
            }).then(() => {})
          );
        }
      }
    }

    // 保存上传的场景参考图片
    if (requestData.uploadedSettingReferences) {
      for (const ref of requestData.uploadedSettingReferences) {
        if (ref.image) {
          const imagePath = generateUserFilePath(userId, projectId, `settings/uploaded/${ref.id}.jpg`);
          const imageBuffer = base64ToBuffer(ref.image);
          
          imageUploadPromises.push(
            r2Client.uploadFile(imagePath, imageBuffer, {
              contentType: 'image/jpeg',
              metadata: {
                type: 'uploaded-setting-ref',
                refId: ref.id,
                refName: ref.name,
                userId,
                projectId,
                uploadedAt: new Date().toISOString(),
              },
            }).then(() => {})
          );
        }
      }
    }

    // 等待所有图片上传完成
    await Promise.all(imageUploadPromises);

    console.log('Project saved successfully:', {
      userId,
      projectId,
      imagesCount: imageUploadPromises.length,
    });

    return NextResponse.json({
      success: true,
      message: 'Project saved successfully',
      projectId,
      timestamp,
    });

  } catch (error) {
    console.error('Save project error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save project' 
      },
      { status: 500 }
    );
  }
}

// 加载项目数据
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 获取用户认证信息（支持匿名用户）
    let userId: string;
    const authHeader = request.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      // 认证用户
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: 'Invalid authorization token' },
          { status: 401 }
        );
      }

      userId = user.id;
    } else {
      // 匿名用户
      const deviceId = request.headers.get('x-device-id');
      if (!deviceId) {
        return NextResponse.json(
          { success: false, error: 'Device ID required for anonymous users' },
          { status: 401 }
        );
      }
      userId = deviceId;
    }
    const r2Client = getR2Client();

    // 加载项目元数据
    const metadataPath = generateUserFilePath(userId, projectId, 'metadata.json');
    let metadata: ProjectMetadata | null = null;
    
    try {
      const metadataBuffer = await r2Client.downloadFile(metadataPath);
      metadata = JSON.parse(metadataBuffer.toString('utf-8'));
    } catch (error) {
      console.warn('Failed to load project metadata:', error);
    }

    // 加载故事数据
    const storyPath = generateUserFilePath(userId, projectId, 'story.json');
    let storyData: any = null;
    
    try {
      const storyBuffer = await r2Client.downloadFile(storyPath);
      storyData = JSON.parse(storyBuffer.toString('utf-8'));
    } catch (error) {
      console.warn('Failed to load story data:', error);
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // 加载图片数据
    const loadImagePromises: Promise<{ type: string; id: string; data: string }>[] = [];

    // 加载角色图片（只加载没有R2 URL的角色）
    if (storyData.characterReferences) {
      for (const char of storyData.characterReferences) {
        if (!char.image || !char.image.startsWith('http')) {
          // 只有没有R2 URL的角色才尝试从云端加载base64数据
          const imagePath = generateUserFilePath(userId, projectId, `characters/generated/${char.name}.jpg`);
          console.log(`📖 Loading character image: ${char.name} from ${imagePath}`);

          loadImagePromises.push(
            r2Client.downloadFile(imagePath)
              .then(buffer => {
                console.log(`✅ Character image loaded: ${char.name} (${buffer.length} bytes)`);
                return {
                  type: 'character',
                  id: char.name,
                  data: `data:image/jpeg;base64,${buffer.toString('base64')}`,
                };
              })
              .catch(error => {
                console.warn(`⚠️ Failed to load character image ${char.name}:`, error.message);
                return { type: 'character', id: char.name, data: '' };
              })
          );
        } else {
          console.log(`🔗 Character ${char.name} already has R2 URL, skipping load`);
        }
      }
    }

    // 加载面板图片（只加载base64数据，R2 URL直接使用）
    if (storyData.generatedPanels) {
      for (const panel of storyData.generatedPanels) {
        if (!panel.image || !panel.image.startsWith('http')) {
          // 只有没有R2 URL的面板才尝试从云端加载base64数据
          const imagePath = generateUserFilePath(userId, projectId, `panels/${panel.panelNumber}.jpg`);
          loadImagePromises.push(
            r2Client.downloadFile(imagePath)
              .then(buffer => ({
                type: 'panel',
                id: panel.panelNumber.toString(),
                data: `data:image/jpeg;base64,${buffer.toString('base64')}`,
              }))
              .catch(() => ({ type: 'panel', id: panel.panelNumber.toString(), data: '' }))
          );
        }
        // 如果面板已经有R2 URL，直接使用，不需要加载
      }
    }

    // 等待所有图片加载完成
    const images = await Promise.all(loadImagePromises);

    // 将图片数据合并回对象
    const imageMap = new Map(images.map(img => [`${img.type}-${img.id}`, img.data]));

    if (storyData.characterReferences) {
      storyData.characterReferences = storyData.characterReferences.map((char: any) => {
        // 如果角色已经有R2 URL，直接使用
        if (char.image && char.image.startsWith('http')) {
          return char; // 保留R2 URL
        } else {
          // 否则尝试从云端加载base64数据
          const imageData = imageMap.get(`character-${char.name}`) || '';
          return { ...char, image: imageData };
        }
      });
    }

    if (storyData.generatedPanels) {
      storyData.generatedPanels = storyData.generatedPanels.map((panel: any) => {
        // 如果面板已经有R2 URL，保留它；否则使用加载的base64数据
        if (panel.image && panel.image.startsWith('http')) {
          return panel; // 保留R2 URL
        } else {
          return {
            ...panel,
            image: imageMap.get(`panel-${panel.panelNumber}`) || '',
          };
        }
      });
    }

    console.log('Project loaded successfully:', {
      userId,
      projectId,
      imagesLoaded: images.filter(img => img.data).length,
    });

    return NextResponse.json({
      success: true,
      metadata,
      data: storyData,
    });

  } catch (error) {
    console.error('Load project error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to load project' 
      },
      { status: 500 }
    );
  }
}
