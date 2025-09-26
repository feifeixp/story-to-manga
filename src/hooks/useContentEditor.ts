/**
 * 内容编辑 Hook
 * 负责面板编辑、图片修改、内容调整等编辑功能
 */
import { useCallback, useState } from 'react';
import { ComicStyle } from '@/types';

interface EditingImage {
  id: string;
  type: 'panel' | 'character';
  originalImage: string;
  panelNumber?: number;
}

interface ImageEditOptions {
  prompt?: string;
  style?: ComicStyle;
  preserveComposition?: boolean;
  strength?: number;
}

export const useContentEditor = () => {
  const [editingImage, setEditingImage] = useState<EditingImage | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [showImageEditModal, setShowImageEditModal] = useState(false);

  // 开始编辑图片
  const startImageEdit = useCallback((
    id: string,
    type: 'panel' | 'character',
    originalImage: string,
    panelNumber?: number
  ) => {
    setEditingImage({
      id,
      type,
      originalImage,
      ...(panelNumber !== undefined && { panelNumber }),
    });
    setShowImageEditModal(true);
  }, []);

  // 编辑面板图片
  const editPanelImage = useCallback(async (
    panelNumber: number,
    originalImage: string,
    options: ImageEditOptions,
    projectId?: string
  ) => {
    try {
      setIsEditingImage(true);

      const response = await fetch('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImage,
          prompt: options.prompt || '',
          style: options.style || 'manga',
          preserveComposition: options.preserveComposition ?? true,
          strength: options.strength ?? 0.7,
          type: 'panel',
          panelNumber,
          projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to edit panel image: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to edit panel image');
      }

      console.log(`✅ Panel ${panelNumber} image edited successfully`);
      return result.imageData;
    } catch (error) {
      console.error(`❌ Failed to edit panel ${panelNumber} image:`, error);
      throw error;
    } finally {
      setIsEditingImage(false);
    }
  }, []);

  // 编辑角色图片
  const editCharacterImage = useCallback(async (
    characterId: string,
    originalImage: string,
    options: ImageEditOptions,
    projectId?: string
  ) => {
    try {
      setIsEditingImage(true);

      const response = await fetch('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImage,
          prompt: options.prompt || '',
          style: options.style || 'manga',
          preserveComposition: options.preserveComposition ?? true,
          strength: options.strength ?? 0.7,
          type: 'character',
          characterId,
          projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to edit character image: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to edit character image');
      }

      console.log(`✅ Character ${characterId} image edited successfully`);
      return result.imageData;
    } catch (error) {
      console.error(`❌ Failed to edit character ${characterId} image:`, error);
      throw error;
    } finally {
      setIsEditingImage(false);
    }
  }, []);

  // 批量编辑面板
  const batchEditPanels = useCallback(async (
    panels: Array<{
      panelNumber: number;
      originalImage: string;
      editOptions: ImageEditOptions;
    }>,
    projectId?: string
  ) => {
    try {
      setIsEditingImage(true);
      const results = [];

      for (const panel of panels) {
        try {
          const result = await editPanelImage(
            panel.panelNumber,
            panel.originalImage,
            panel.editOptions,
            projectId
          );
          results.push({
            panelNumber: panel.panelNumber,
            success: true,
            imageData: result,
          });
        } catch (error) {
          results.push({
            panelNumber: panel.panelNumber,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      console.log(`✅ Batch edit completed: ${results.filter(r => r.success).length}/${results.length} successful`);
      return results;
    } catch (error) {
      console.error('❌ Batch edit failed:', error);
      throw error;
    } finally {
      setIsEditingImage(false);
    }
  }, [editPanelImage]);

  // 调整面板顺序
  const reorderPanels = useCallback((
    panels: any[],
    fromIndex: number,
    toIndex: number
  ) => {
    const newPanels = [...panels];
    const [movedPanel] = newPanels.splice(fromIndex, 1);
    newPanels.splice(toIndex, 0, movedPanel);
    
    // 重新编号
    return newPanels.map((panel, index) => ({
      ...panel,
      panelNumber: index + 1,
    }));
  }, []);

  // 删除面板
  const deletePanel = useCallback((
    panels: any[],
    panelNumber: number
  ) => {
    const newPanels = panels.filter(panel => panel.panelNumber !== panelNumber);
    
    // 重新编号
    return newPanels.map((panel, index) => ({
      ...panel,
      panelNumber: index + 1,
    }));
  }, []);

  // 插入新面板
  const insertPanel = useCallback((
    panels: any[],
    insertAfter: number,
    newPanel: any
  ) => {
    const newPanels = [...panels];
    newPanels.splice(insertAfter, 0, {
      ...newPanel,
      panelNumber: insertAfter + 1,
    });
    
    // 重新编号
    return newPanels.map((panel, index) => ({
      ...panel,
      panelNumber: index + 1,
    }));
  }, []);

  // 复制面板
  const duplicatePanel = useCallback((
    panels: any[],
    panelNumber: number
  ) => {
    const panelToDuplicate = panels.find(panel => panel.panelNumber === panelNumber);
    if (!panelToDuplicate) {
      throw new Error(`Panel ${panelNumber} not found`);
    }

    const duplicatedPanel = {
      ...panelToDuplicate,
      panelNumber: panelNumber + 1,
      // 清除图片，需要重新生成
      image: null,
    };

    return insertPanel(panels, panelNumber, duplicatedPanel);
  }, [insertPanel]);

  // 更新面板描述
  const updatePanelDescription = useCallback((
    panels: any[],
    panelNumber: number,
    newDescription: string
  ) => {
    return panels.map(panel => 
      panel.panelNumber === panelNumber
        ? { ...panel, description: newDescription, sceneDescription: newDescription }
        : panel
    );
  }, []);

  // 更新面板对话
  const updatePanelDialogue = useCallback((
    panels: any[],
    panelNumber: number,
    newDialogue: string
  ) => {
    return panels.map(panel => 
      panel.panelNumber === panelNumber
        ? { ...panel, dialogue: newDialogue }
        : panel
    );
  }, []);

  // 关闭编辑模态框
  const closeImageEditModal = useCallback(() => {
    setShowImageEditModal(false);
    setEditingImage(null);
  }, []);

  return {
    editingImage,
    isEditingImage,
    showImageEditModal,
    startImageEdit,
    editPanelImage,
    editCharacterImage,
    batchEditPanels,
    reorderPanels,
    deletePanel,
    insertPanel,
    duplicatePanel,
    updatePanelDescription,
    updatePanelDialogue,
    closeImageEditModal,
    setShowImageEditModal,
  };
};
