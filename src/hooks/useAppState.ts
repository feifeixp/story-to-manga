/**
 * 应用状态管理 Hook
 * 负责主要的应用状态管理，包括故事、样式、面板等核心数据
 */
import { useState, useCallback } from 'react';
import { ComicStyle } from '@/types';
import { ImageSizeConfig } from '@/types/project';

// 默认图片尺寸配置
const DEFAULT_IMAGE_SIZE: ImageSizeConfig = {
  width: 1024,
  height: 1024,
  aspectRatio: '1:1',
  volcEngineSize: '1K',
};

interface UploadedCharacterReference {
  id: string;
  name: string;
  image: string;
  description?: string;
}

interface UploadedSettingReference {
  id: string;
  name: string;
  image: string;
  description?: string;
}

export const useAppState = () => {
  // 主要内容状态
  const [story, setStory] = useState("");
  const [style, setStyle] = useState<ComicStyle>("manga");
  const [imageSize, setImageSize] = useState<ImageSizeConfig>(DEFAULT_IMAGE_SIZE);
  const [aiModel, setAiModel] = useState<string>("auto");

  // 生成结果状态
  const [storyAnalysis, setStoryAnalysis] = useState<any>(null);
  const [storyBreakdown, setStoryBreakdown] = useState<any>(null);
  const [characterReferences, setCharacterReferences] = useState<any[]>([]);
  const [generatedPanels, setGeneratedPanels] = useState<any[]>([]);

  // 上传的参考图片状态
  const [uploadedCharacterReferences, setUploadedCharacterReferences] = useState<UploadedCharacterReference[]>([]);
  const [uploadedSettingReferences, setUploadedSettingReferences] = useState<UploadedSettingReference[]>([]);

  // UI状态
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingState, setIsSavingState] = useState(false);
  const [storageQuotaExceeded, setStorageQuotaExceeded] = useState(false);

  // 错误和失败状态
  const [failedPanel, setFailedPanel] = useState<{
    step: string;
    panelNumber?: number;
  } | null>(null);

  // 模态框状态
  const [showConfirmClearModal, setShowConfirmClearModal] = useState(false);

  // 计算字数
  const wordCount = story.split(/\s+/).filter(word => word.length > 0).length;

  // 清除所有结果
  const clearResults = useCallback(() => {
    setStoryAnalysis(null);
    setStoryBreakdown(null);
    setCharacterReferences([]);
    setGeneratedPanels([]);
    setFailedPanel(null);
    setOpenAccordions(new Set());
  }, []);

  // 清除所有数据
  const clearAllData = useCallback(() => {
    setStory("");
    setStyle("manga");
    setImageSize(DEFAULT_IMAGE_SIZE);
    setAiModel("auto");
    setUploadedCharacterReferences([]);
    setUploadedSettingReferences([]);
    clearResults();
    setShowConfirmClearModal(false);
  }, [clearResults]);

  // 设置完整的项目数据
  const setProjectData = useCallback((projectData: any) => {
    setStyle(projectData.style || 'manga');
    setStory(projectData.story || '');
    setStoryAnalysis(projectData.storyAnalysis || null);
    setStoryBreakdown(projectData.storyBreakdown || null);
    setCharacterReferences(projectData.characterReferences || []);
    setGeneratedPanels(projectData.generatedPanels || []);
    setUploadedCharacterReferences(projectData.uploadedCharacterReferences || []);
    setUploadedSettingReferences(projectData.uploadedSettingReferences || []);
    setImageSize(projectData.imageSize || DEFAULT_IMAGE_SIZE);
    setAiModel(projectData.aiModel || 'auto');

    // 自动展开有内容的部分
    const sectionsToExpand: string[] = [];
    if (projectData.storyAnalysis) sectionsToExpand.push("analysis");
    if (projectData.characterReferences?.length > 0) sectionsToExpand.push("characters");
    if (projectData.storyBreakdown) sectionsToExpand.push("layout");
    if (projectData.generatedPanels?.length > 0) sectionsToExpand.push("panels");
    if (projectData.generatedPanels?.length > 0 && projectData.characterReferences?.length > 0) {
      sectionsToExpand.push("compositor");
    }
    setOpenAccordions(new Set(sectionsToExpand));
  }, []);

  // 添加上传的角色参考
  const addUploadedCharacterReference = useCallback((reference: UploadedCharacterReference) => {
    setUploadedCharacterReferences(prev => [...prev, reference]);
  }, []);

  // 删除上传的角色参考
  const removeUploadedCharacterReference = useCallback((id: string) => {
    setUploadedCharacterReferences(prev => prev.filter(ref => ref.id !== id));
  }, []);

  // 添加上传的设置参考
  const addUploadedSettingReference = useCallback((reference: UploadedSettingReference) => {
    setUploadedSettingReferences(prev => [...prev, reference]);
  }, []);

  // 删除上传的设置参考
  const removeUploadedSettingReference = useCallback((id: string) => {
    setUploadedSettingReferences(prev => prev.filter(ref => ref.id !== id));
  }, []);

  // 切换手风琴展开状态
  const toggleAccordion = useCallback((section: string) => {
    setOpenAccordions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  // 检查是否有内容
  const hasAnyContent = story.trim() ||
    storyAnalysis ||
    characterReferences.length > 0 ||
    generatedPanels.length > 0 ||
    uploadedCharacterReferences.length > 0 ||
    uploadedSettingReferences.length > 0;

  const hasCompositeContent = generatedPanels.length > 0 && characterReferences.length > 0;

  return {
    // 主要内容状态
    story,
    setStory,
    style,
    setStyle,
    imageSize,
    setImageSize,
    aiModel,
    setAiModel,
    wordCount,

    // 生成结果状态
    storyAnalysis,
    setStoryAnalysis,
    storyBreakdown,
    setStoryBreakdown,
    characterReferences,
    setCharacterReferences,
    generatedPanels,
    setGeneratedPanels,

    // 上传的参考图片状态
    uploadedCharacterReferences,
    setUploadedCharacterReferences,
    uploadedSettingReferences,
    setUploadedSettingReferences,
    addUploadedCharacterReference,
    removeUploadedCharacterReference,
    addUploadedSettingReference,
    removeUploadedSettingReference,

    // UI状态
    openAccordions,
    setOpenAccordions,
    toggleAccordion,
    isGenerating,
    setIsGenerating,
    isSavingState,
    setIsSavingState,
    storageQuotaExceeded,
    setStorageQuotaExceeded,

    // 错误和失败状态
    failedPanel,
    setFailedPanel,

    // 模态框状态
    showConfirmClearModal,
    setShowConfirmClearModal,

    // 操作函数
    clearResults,
    clearAllData,
    setProjectData,

    // 计算属性
    hasAnyContent,
    hasCompositeContent,
  };
};
