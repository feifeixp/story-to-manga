/**
 * 主要的漫画应用 Hook
 * 整合所有功能模块，提供统一的接口
 */
import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { useAppState } from './useAppState';
import { useProjectManager } from './useProjectManager';
import { useContentGeneration } from './useContentGeneration';
import { useContentSharing } from './useContentSharing';
import { useContentEditor } from './useContentEditor';

// 全局初始化锁，防止多个组件实例同时初始化
let globalInitializingLock = false;
import { ComicStyle } from '@/types';

export const useMangaApp = () => {
  const searchParams = useSearchParams();
  const { i18n } = useI18n();

  // 使用各个功能模块
  const appState = useAppState();
  const projectManager = useProjectManager();
  const contentGeneration = useContentGeneration();
  const contentSharing = useContentSharing();
  const contentEditor = useContentEditor();

  // 完整的漫画生成流程
  const generateComic = useCallback(async () => {
    if (!appState.story.trim()) {
      throw new Error("Please enter a story");
    }

    if (appState.wordCount > 500) {
      throw new Error("Story must be 500 words or less");
    }

    try {
      appState.setIsGenerating(true);
      appState.clearResults();

      // 如果没有当前项目，创建新项目
      let projectId = projectManager.currentProjectId;
      if (!projectId) {
        const projectName = appState.story.slice(0, 50) + (appState.story.length > 50 ? "..." : "");
        projectId = await projectManager.createProject(
          projectName,
          `Created from story: ${appState.story.slice(0, 100)}${appState.story.length > 100 ? "..." : ""}`,
          appState.style
        );
      }

      const generationOptions = {
        story: appState.story,
        style: appState.style,
        language: i18n?.language || 'en',
        aiModel: appState.aiModel,
        imageSize: appState.imageSize,
        projectId,
      };

      // 1. 故事分析
      const analysis = await contentGeneration.analyzeStory(generationOptions);
      appState.setStoryAnalysis(analysis);
      appState.setOpenAccordions(new Set(["analysis"]));

      // 自动保存故事分析结果
      if (projectId) {
        await projectManager.saveProjectData(
          projectId,
          appState.story,
          appState.style,
          analysis,
          appState.storyBreakdown,
          appState.characterReferences,
          appState.generatedPanels,
          appState.uploadedCharacterReferences,
          appState.uploadedSettingReferences,
          appState.imageSize,
          undefined,
          contentGeneration.generationState
        );
      }

      // 2. 角色生成
      const characterReferences = await contentGeneration.generateCharacterReferences(
        analysis,
        generationOptions,
        appState.uploadedCharacterReferences
      );
      appState.setCharacterReferences(characterReferences);
      appState.setOpenAccordions(new Set(["analysis", "characters"]));

      // 自动保存角色生成结果
      if (projectId) {
        await projectManager.saveProjectData(
          projectId,
          appState.story,
          appState.style,
          analysis,
          appState.storyBreakdown,
          characterReferences,
          appState.generatedPanels,
          appState.uploadedCharacterReferences,
          appState.uploadedSettingReferences,
          appState.imageSize,
          undefined,
          contentGeneration.generationState
        );
      }

      // 3. 故事分解
      const breakdown = await contentGeneration.breakdownStory(
        appState.story,
        analysis,
        generationOptions
      );
      appState.setStoryBreakdown(breakdown);
      appState.setOpenAccordions(new Set(["analysis", "characters", "layout"]));

      // 自动保存故事分解结果
      if (projectId) {
        await projectManager.saveProjectData(
          projectId,
          appState.story,
          appState.style,
          analysis,
          breakdown,
          characterReferences,
          appState.generatedPanels,
          appState.uploadedCharacterReferences,
          appState.uploadedSettingReferences,
          appState.imageSize,
          undefined,
          contentGeneration.generationState
        );
      }

      // 4. 面板生成
      const generatedPanels = await contentGeneration.generatePanelsBatch(
        breakdown.panels,
        characterReferences,
        analysis,
        generationOptions,
        appState.uploadedSettingReferences
      );
      appState.setGeneratedPanels(generatedPanels);
      appState.setOpenAccordions(new Set(["analysis", "characters", "layout", "panels", "compositor"]));

      // 保存完整的项目数据
      if (projectId) {
        await projectManager.saveProjectData(
          projectId,
          appState.story,
          appState.style,
          analysis,
          breakdown,
          characterReferences,
          generatedPanels,
          appState.uploadedCharacterReferences,
          appState.uploadedSettingReferences,
          appState.imageSize,
          undefined,
          contentGeneration.generationState
        );
      }

      console.log('✅ Comic generation completed successfully');
    } catch (error) {
      console.error('❌ Comic generation failed:', error);
      throw error;
    } finally {
      appState.setIsGenerating(false);
    }
  }, [
    appState,
    projectManager,
    contentGeneration,
    i18n?.language,
  ]);

  // 项目选择处理
  const handleProjectSelect = useCallback((projectId: string) => {
    projectManager.selectProject(projectId, (projectData) => {
      appState.setProjectData(projectData);
    });
  }, [projectManager, appState]);

  // 新项目处理
  const handleNewProject = useCallback(() => {
    appState.clearAllData();
    projectManager.clearCurrentProject();
  }, [appState, projectManager]);

  // 重新生成面板
  const handleRegeneratePanel = useCallback(async (panelNumber: number) => {
    if (!appState.storyBreakdown || !appState.storyAnalysis) {
      throw new Error('Story breakdown and analysis required');
    }

    const panel = appState.storyBreakdown.panels.find((p: any) => p.panelNumber === panelNumber);
    if (!panel) {
      throw new Error(`Panel ${panelNumber} not found`);
    }

    const generationOptions = {
      story: appState.story,
      style: appState.style,
      language: i18n?.language || 'en',
      aiModel: appState.aiModel,
      imageSize: appState.imageSize,
      ...(projectManager.currentProjectId && { projectId: projectManager.currentProjectId }),
    };

    const regeneratedPanel = await contentGeneration.regeneratePanel(
      panelNumber,
      panel,
      appState.characterReferences,
      appState.storyAnalysis,
      generationOptions,
      appState.uploadedSettingReferences
    );

    // 更新面板
    const updatedPanels = appState.generatedPanels.map(p =>
      p.panelNumber === panelNumber ? regeneratedPanel : p
    );
    appState.setGeneratedPanels(updatedPanels);

    // 保存更新
    if (projectManager.currentProjectId) {
      await projectManager.saveProjectData(
        projectManager.currentProjectId,
        appState.story,
        appState.style,
        appState.storyAnalysis,
        appState.storyBreakdown,
        appState.characterReferences,
        updatedPanels,
        appState.uploadedCharacterReferences,
        appState.uploadedSettingReferences,
        appState.imageSize,
        undefined,
        contentGeneration.generationState
      );
    }
  }, [
    appState,
    projectManager,
    contentGeneration,
    i18n?.language,
  ]);

  // 初始化应用
  useEffect(() => {
    const initializeApp = async () => {
      // 使用全局锁防止重复初始化
      if (globalInitializingLock) {
        console.log('⏳ App initialization already in progress globally, skipping');
        return;
      }

      try {
        globalInitializingLock = true;
        console.log('🚀 Initializing manga app...');

        // 检查URL参数中的项目ID
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('projectId');

        if (urlProjectId) {
          console.log(`🔗 Found project ID in URL: ${urlProjectId}`);
          handleProjectSelect(urlProjectId);
        } else if (!projectManager.currentProjectId) {
          // 创建默认项目
          try {
            const projectId = await projectManager.createProject(
              `创作项目 ${new Date().toLocaleDateString()}`,
              '自动创建的创作项目',
              'manga'
            );
            console.log('✅ Default project created:', projectId);
          } catch (error) {
            console.error('❌ Failed to create default project:', error);
          }
        }
      } catch (error) {
        console.error("Failed to initialize app:", error);
      } finally {
        // 延迟重置锁，给其他可能的初始化调用一些时间
        setTimeout(() => {
          globalInitializingLock = false;
        }, 1000);
      }
    };

    initializeApp();
  }, [projectManager.currentProjectId]); // 只依赖当前项目ID

  // URL参数变化监听
  useEffect(() => {
    const urlProjectId = searchParams.get('projectId');

    if (urlProjectId && urlProjectId !== projectManager.currentProjectId) {
      console.log(`🔗 URL参数变化，加载项目: ${urlProjectId}`);
      handleProjectSelect(urlProjectId);
    }
  }, [searchParams, projectManager.currentProjectId, handleProjectSelect]);

  return {
    // 状态
    ...appState,
    ...projectManager,
    ...contentGeneration,
    ...contentSharing,
    ...contentEditor,

    // 主要操作
    generateComic,
    handleProjectSelect,
    handleNewProject,
    handleRegeneratePanel,
  };
};
