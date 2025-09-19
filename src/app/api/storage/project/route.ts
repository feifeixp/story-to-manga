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
    // 获取用户认证信息
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    const userId = user.id;
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
      storyAnalysis: requestData.storyAnalysis || null,
      storyBreakdown: requestData.storyBreakdown || null,
      characterReferences: (requestData.characterReferences || []).map(({ image, ...char }) => char),
      generatedPanels: (requestData.generatedPanels || []).map(({ image, ...panel }) => panel),
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

    // 保存角色参考图片
    if (requestData.characterReferences) {
      for (const char of requestData.characterReferences) {
        if (char.image) {
          const imagePath = generateUserFilePath(userId, projectId, `characters/generated/${char.name}.jpg`);
          const imageBuffer = base64ToBuffer(char.image);
          
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
            }).then(() => {})
          );
        }
      }
    }

    // 保存生成的面板图片
    if (requestData.generatedPanels) {
      for (const panel of requestData.generatedPanels) {
        if (panel.image) {
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

    // 获取用户认证信息
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    const userId = user.id;
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

    // 加载角色图片
    if (storyData.characterReferences) {
      for (const char of storyData.characterReferences) {
        const imagePath = generateUserFilePath(userId, projectId, `characters/generated/${char.name}.jpg`);
        loadImagePromises.push(
          r2Client.downloadFile(imagePath)
            .then(buffer => ({
              type: 'character',
              id: char.name,
              data: `data:image/jpeg;base64,${buffer.toString('base64')}`,
            }))
            .catch(() => ({ type: 'character', id: char.name, data: '' }))
        );
      }
    }

    // 加载面板图片
    if (storyData.generatedPanels) {
      for (const panel of storyData.generatedPanels) {
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
    }

    // 等待所有图片加载完成
    const images = await Promise.all(loadImagePromises);

    // 将图片数据合并回对象
    const imageMap = new Map(images.map(img => [`${img.type}-${img.id}`, img.data]));

    if (storyData.characterReferences) {
      storyData.characterReferences = storyData.characterReferences.map((char: any) => ({
        ...char,
        image: imageMap.get(`character-${char.name}`) || '',
      }));
    }

    if (storyData.generatedPanels) {
      storyData.generatedPanels = storyData.generatedPanels.map((panel: any) => ({
        ...panel,
        image: imageMap.get(`panel-${panel.panelNumber}`) || '',
      }));
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
