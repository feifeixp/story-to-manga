import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * 项目完整数据存储API
 * 保存和加载项目的完整数据（包括故事、分析、面板等）
 */

interface CompleteProjectData {
  projectId: string;
  story: string;
  style: string;
  storyAnalysis?: any;
  storyBreakdown?: any;
  characterReferences?: any[];
  generatedPanels?: any[];
  uploadedCharacterReferences?: any[];
  uploadedSettingReferences?: any[];
  imageSize?: any;
  tags?: string[];
  aiModel?: string;
  generationState?: any;
  metadata?: any;
}

/**
 * 保存完整项目数据
 * POST /api/project-storage
 */
export async function POST(request: NextRequest) {
  try {
    console.log('💾 API: Saving complete project data...');

    const projectData: CompleteProjectData = await request.json();

    if (!projectData.projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 验证项目是否存在
    const { data: existingProject, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', projectData.projectId)
      .single();

    if (projectError || !existingProject) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // 准备要保存的数据
    const dataToSave = {
      project_id: projectData.projectId,
      story: projectData.story || '',
      style: projectData.style || 'manga',
      story_analysis: projectData.storyAnalysis || null,
      story_breakdown: projectData.storyBreakdown || null,
      character_references: projectData.characterReferences || [],
      generated_panels: projectData.generatedPanels || [],
      uploaded_character_references: projectData.uploadedCharacterReferences || [],
      uploaded_setting_references: projectData.uploadedSettingReferences || [],
      image_size: projectData.imageSize || null,
      tags: projectData.tags || [],
      ai_model: projectData.aiModel || 'auto',
      generation_state: projectData.generationState || null,
      metadata: {
        ...projectData.metadata,
        lastSaved: new Date().toISOString(),
        panelCount: projectData.generatedPanels?.length || 0,
        characterCount: projectData.characterReferences?.length || 0,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 使用 upsert 保存或更新项目数据
    const { data: savedData, error: saveError } = await supabaseAdmin
      .from('project_data')
      .upsert(dataToSave, {
        onConflict: 'project_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ Failed to save project data:', saveError);
      return NextResponse.json(
        { success: false, error: `Failed to save project data: ${saveError.message}` },
        { status: 500 }
      );
    }

    // 同时更新项目表的基本信息
    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({
        story: projectData.story,
        style: projectData.style,
        ai_model: projectData.aiModel || 'auto',
        image_size: projectData.imageSize,
        generation_state: projectData.generationState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectData.projectId);

    if (updateError) {
      console.warn('⚠️ Failed to update project basic info:', updateError);
      // 不抛出错误，因为主要数据已经保存成功
    }

    console.log('✅ API: Complete project data saved successfully');

    return NextResponse.json({
      success: true,
      message: 'Project data saved successfully',
      data: savedData,
    });

  } catch (error) {
    console.error('❌ API: Failed to save project data:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save project data',
      },
      { status: 500 }
    );
  }
}

/**
 * 加载完整项目数据
 * GET /api/project-storage?projectId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    console.log('📂 API: Loading complete project data for:', projectId);

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // 从项目数据表加载完整数据
    const { data: projectData, error: dataError } = await supabaseAdmin
      .from('project_data')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (dataError) {
      if (dataError.code === 'PGRST116') {
        // 数据不存在，返回空数据结构
        console.log('ℹ️ No project data found, returning empty structure');
        return NextResponse.json({
          success: true,
          data: {
            projectId,
            story: '',
            style: 'manga',
            storyAnalysis: null,
            storyBreakdown: null,
            characterReferences: [],
            generatedPanels: [],
            uploadedCharacterReferences: [],
            uploadedSettingReferences: [],
            imageSize: null,
            tags: [],
            aiModel: 'auto',
            generationState: null,
            metadata: {},
          },
        });
      }

      console.error('❌ Failed to load project data:', dataError);
      return NextResponse.json(
        { success: false, error: `Failed to load project data: ${dataError.message}` },
        { status: 500 }
      );
    }

    // 转换数据格式
    const formattedData = {
      projectId: projectData.project_id,
      story: projectData.story || '',
      style: projectData.style || 'manga',
      storyAnalysis: projectData.story_analysis,
      storyBreakdown: projectData.story_breakdown,
      characterReferences: projectData.character_references || [],
      generatedPanels: projectData.generated_panels || [],
      uploadedCharacterReferences: projectData.uploaded_character_references || [],
      uploadedSettingReferences: projectData.uploaded_setting_references || [],
      imageSize: projectData.image_size,
      tags: projectData.tags || [],
      aiModel: projectData.ai_model || 'auto',
      generationState: projectData.generation_state,
      metadata: projectData.metadata || {},
    };

    console.log('✅ API: Complete project data loaded successfully');

    return NextResponse.json({
      success: true,
      data: formattedData,
    });

  } catch (error) {
    console.error('❌ API: Failed to load project data:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load project data',
      },
      { status: 500 }
    );
  }
}
