/**
 * 内容生成 Hook
 * 负责故事分析、角色生成、故事分解、面板生成等AI内容生成功能
 */
import { useCallback, useState } from 'react';
import { ComicStyle } from '@/types';

interface GenerationState {
  isGenerating: boolean;
  isPaused: boolean;
  currentPanel: number;
  totalPanels: number;
  completedPanels: number;
  failedPanels: number[];
  batchInfo?: {
    currentBatch: number;
    totalBatches: number;
    batchSize: number;
  };
}

interface GenerationOptions {
  story: string;
  style: ComicStyle;
  language: string;
  aiModel: string;
  imageSize?: any;
  projectId?: string;
}

export const useContentGeneration = () => {
  const [generationState, setGenerationState] = useState<GenerationState>({
    isGenerating: false,
    isPaused: false,
    currentPanel: 0,
    totalPanels: 0,
    completedPanels: 0,
    failedPanels: [],
  });

  const [currentStepText, setCurrentStepText] = useState("");

  // 故事分析
  const analyzeStory = useCallback(async (options: GenerationOptions) => {
    try {
      setCurrentStepText("Analyzing story...");
      
      const response = await fetch('/api/analyze-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: options.story,
          style: options.style,
          language: options.language,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze story: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to analyze story');
      }

      console.log('✅ Story analysis completed');
      return result.analysis;
    } catch (error) {
      console.error('❌ Story analysis failed:', error);
      throw error;
    }
  }, []);

  // 角色生成
  const generateCharacterReferences = useCallback(async (
    storyAnalysis: any,
    options: GenerationOptions,
    uploadedCharacterReferences: any[] = []
  ) => {
    try {
      setCurrentStepText("Generating character references...");

      const response = await fetch('/api/generate-character-refs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyAnalysis,
          style: options.style,
          uploadedCharacterReferences,
          language: options.language,
          aiModel: options.aiModel,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate character references: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate character references');
      }

      console.log('✅ Character references generated');
      return result.characterReferences;
    } catch (error) {
      console.error('❌ Character generation failed:', error);
      throw error;
    }
  }, []);

  // 故事分解
  const breakdownStory = useCallback(async (
    story: string,
    storyAnalysis: any,
    options: GenerationOptions
  ) => {
    try {
      setCurrentStepText("Breaking down story into panels...");

      const response = await fetch('/api/breakdown-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story,
          storyAnalysis,
          style: options.style,
          language: options.language,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to breakdown story: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to breakdown story');
      }

      console.log('✅ Story breakdown completed');
      return result.breakdown;
    } catch (error) {
      console.error('❌ Story breakdown failed:', error);
      throw error;
    }
  }, []);

  // 批量生成面板
  const generatePanelsBatch = useCallback(async (
    panels: any[],
    characterReferences: any[],
    storyAnalysis: any,
    options: GenerationOptions,
    uploadedSettingReferences: any[] = [],
    batchSize: number = 5
  ) => {
    try {
      setGenerationState(prev => ({
        ...prev,
        isGenerating: true,
        totalPanels: panels.length,
        completedPanels: 0,
        failedPanels: [],
      }));

      const totalBatches = Math.ceil(panels.length / batchSize);
      let allGeneratedPanels: any[] = [];

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, panels.length);
        const batchPanels = panels.slice(startIndex, endIndex);

        setGenerationState(prev => ({
          ...prev,
          batchInfo: {
            currentBatch: batchIndex + 1,
            totalBatches,
            batchSize,
          },
        }));

        setCurrentStepText(
          `Generating batch ${batchIndex + 1}/${totalBatches} (panels ${startIndex + 1}-${endIndex})...`
        );

        const response = await fetch('/api/generate-panels-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            panels: batchPanels,
            characterReferences,
            setting: storyAnalysis?.setting || '',
            style: options.style,
            uploadedSettingReferences,
            language: options.language,
            aiModel: options.aiModel,
            imageSize: options.imageSize,
            projectId: options.projectId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate batch ${batchIndex + 1}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || `Failed to generate batch ${batchIndex + 1}`);
        }

        allGeneratedPanels = [...allGeneratedPanels, ...result.panels];
        
        setGenerationState(prev => ({
          ...prev,
          completedPanels: allGeneratedPanels.length,
        }));
      }

      setGenerationState(prev => ({
        ...prev,
        isGenerating: false,
      }));

      console.log('✅ All panels generated successfully');
      return allGeneratedPanels;
    } catch (error) {
      console.error('❌ Panel generation failed:', error);
      setGenerationState(prev => ({
        ...prev,
        isGenerating: false,
      }));
      throw error;
    }
  }, []);

  // 重新生成单个面板
  const regeneratePanel = useCallback(async (
    panelNumber: number,
    panel: any,
    characterReferences: any[],
    storyAnalysis: any,
    options: GenerationOptions,
    uploadedSettingReferences: any[] = []
  ) => {
    try {
      setCurrentStepText(`Regenerating panel ${panelNumber}...`);

      const response = await fetch('/api/generate-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panel,
          characterReferences,
          setting: storyAnalysis.setting,
          style: options.style,
          uploadedSettingReferences,
          language: options.language,
          aiModel: options.aiModel,
          imageSize: options.imageSize,
          projectId: options.projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to regenerate panel ${panelNumber}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || `Failed to regenerate panel ${panelNumber}`);
      }

      console.log(`✅ Panel ${panelNumber} regenerated successfully`);
      return result.panel;
    } catch (error) {
      console.error(`❌ Panel ${panelNumber} regeneration failed:`, error);
      throw error;
    }
  }, []);

  // 暂停/恢复生成
  const pauseGeneration = useCallback(() => {
    setGenerationState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resumeGeneration = useCallback(() => {
    setGenerationState(prev => ({ ...prev, isPaused: false }));
  }, []);

  // 停止生成
  const stopGeneration = useCallback(() => {
    setGenerationState(prev => ({
      ...prev,
      isGenerating: false,
      isPaused: false,
    }));
  }, []);

  return {
    generationState,
    currentStepText,
    analyzeStory,
    generateCharacterReferences,
    breakdownStory,
    generatePanelsBatch,
    regeneratePanel,
    pauseGeneration,
    resumeGeneration,
    stopGeneration,
    setCurrentStepText,
    setGenerationState,
  };
};
