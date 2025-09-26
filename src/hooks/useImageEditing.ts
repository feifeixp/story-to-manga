import { useState, useCallback } from "react";
import { useI18n } from "@/components/I18nProvider";
import { handleApiError } from "@/utils/errorUtils";
import type { EditingImage } from "@/types/app";

interface UseImageEditingProps {
	style: string;
	aiModel: string;
	imageSize: any;
	storyAnalysis: any;
	storyBreakdown: any;
	characterReferences: any[];
	uploadedSettingReferences: any[];
	setGeneratedPanels: (panels: any[] | ((prev: any[]) => any[])) => void;
	setCharacterReferences: (refs: any[] | ((prev: any[]) => any[])) => void;
	showError: (message: string) => void;
	saveProjectData: (
		projectId: string,
		story: string,
		style: string,
		storyAnalysis: any,
		storyBreakdown: any,
		characterReferences: any[],
		generatedPanels: any[],
		uploadedCharacterReferences: any[],
		uploadedSettingReferences: any[],
		imageSize?: any,
		tags?: string[],
		currentGenerationState?: any
	) => Promise<{ success: boolean }>;
	currentProjectId: string | null;
	story: string;
	generatedPanels: any[];
	uploadedCharacterReferences: any[];
	generationState: any;
}

export function useImageEditing({
	style,
	aiModel,
	imageSize,
	storyAnalysis,
	storyBreakdown,
	characterReferences,
	uploadedSettingReferences,
	setGeneratedPanels,
	setCharacterReferences,
	showError,
	saveProjectData,
	currentProjectId,
	story,
	generatedPanels,
	uploadedCharacterReferences,
	generationState,
}: UseImageEditingProps) {
	const { i18n } = useI18n();
	const [showImageEditModal, setShowImageEditModal] = useState(false);
	const [editingImage, setEditingImage] = useState<EditingImage | null>(null);
	const [isImageProcessing, setIsImageProcessing] = useState(false);

	// Helper functions for image editing
	const openImageEditModal = useCallback((
		type: 'panel' | 'character',
		id: string | number,
		image: string,
		originalPrompt: string
	) => {
		setEditingImage({ type, id, image, originalPrompt });

		// 🎯 自动为面板重绘预选正确的角色参考图片
		if (type === 'panel' && storyBreakdown) {
			const panelNumber = typeof id === 'number' ? id : parseInt(id.toString());
			const panel = storyBreakdown.panels.find((p: any) => p.panelNumber === panelNumber);

			if (panel && panel.characters && panel.characters.length > 0) {
				// 根据面板涉及的角色自动选择对应的参考图片
				const autoSelectedRefs: Array<{id: string; name: string; image: string; source: 'upload' | 'character'}> = [];

				panel.characters.forEach((charName: string) => {
					const matchingCharRef = characterReferences.find(ref => 
						ref.name.toLowerCase().includes(charName.toLowerCase()) || 
						charName.toLowerCase().includes(ref.name.toLowerCase())
					);
					
					if (matchingCharRef && matchingCharRef.image) {
						autoSelectedRefs.push({
							id: matchingCharRef.name,
							name: matchingCharRef.name,
							image: matchingCharRef.image,
							source: 'character'
						});
					}
				});

				// 更新编辑状态，包含自动选择的参考图片
				setEditingImage(prev => prev ? {
					...prev,
					autoSelectedReferences: autoSelectedRefs
				} : null);

				console.log(`🎯 Auto-selected ${autoSelectedRefs.length} character references for panel ${panelNumber}:`, 
					autoSelectedRefs.map(ref => ref.name));
			}
		}

		setShowImageEditModal(true);
	}, [storyBreakdown, characterReferences]);

	const closeImageEditModal = useCallback(() => {
		setShowImageEditModal(false);
		setEditingImage(null);
	}, []);

	const handleImageRedraw = useCallback(async (newPrompt: string, referenceImages?: Array<{id: string; name: string; image: string; source: 'upload' | 'character'}>) => {
		if (!editingImage) return;

		setIsImageProcessing(true);
		try {
			// 提取参考图片URL
			const referenceImageUrls = referenceImages ? referenceImages.map(ref => ref.image) : [];

			// 创建带超时的fetch请求 (120秒超时)
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 120000);

			let response: Response;
			try {
				response = await fetch("/api/redraw-image", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						imageType: editingImage.type,
						imageId: editingImage.id,
						originalPrompt: editingImage.originalPrompt,
						newPrompt: newPrompt,
						language: i18n?.language || "en",
						aiModel: aiModel,
						imageSize: imageSize,
						style: style, // 添加项目风格参数
						referenceImages: referenceImageUrls,
						// 添加场景数据以确保重绘时场景一致性
						setting: storyAnalysis?.setting,
						scenes: storyAnalysis?.scenes || [],
						uploadedSettingReferences: uploadedSettingReferences || [],
					}),
					signal: controller.signal,
				});
				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorMessage = await handleApiError(response, "Failed to redraw image");
					throw new Error(errorMessage);
				}
			} catch (fetchError) {
				clearTimeout(timeoutId);
				if (fetchError instanceof Error && fetchError.name === 'AbortError') {
					throw new Error('重绘请求超时，请稍后重试。如果问题持续，请尝试简化提示词或减少参考图片数量。');
				}
				throw fetchError;
			}

			const result = await response.json();
			if (!result.success || !result.imageData) {
				throw new Error(result.error || "Failed to redraw image");
			}

			// Update the image in the appropriate state
			if (editingImage.type === 'panel') {
				// Convert editingImage.id to number for panel comparison
				const panelId = typeof editingImage.id === 'string' ? parseInt(editingImage.id) : editingImage.id;
				setGeneratedPanels(prev => prev.map(panel =>
					panel.panelNumber === panelId
						? { ...panel, image: result.imageData }
						: panel
				));
			} else if (editingImage.type === 'character') {
				setCharacterReferences(prev => prev.map(char =>
					char.name === editingImage.id
						? { ...char, image: result.imageData }
						: char
				));
			}

			// Save to project storage if we have a current project
			if (currentProjectId) {
				await saveProjectData(
					currentProjectId,
					story,
					style,
					storyAnalysis,
					storyBreakdown,
					characterReferences,
					generatedPanels,
					uploadedCharacterReferences,
					uploadedSettingReferences,
					imageSize,
					undefined, // tags
					generationState
				);
			}

			closeImageEditModal();
		} catch (error) {
			console.error("Error redrawing image:", error);
			showError(`Failed to redraw image: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			setIsImageProcessing(false);
		}
	}, [editingImage, i18n, aiModel, imageSize, style, storyAnalysis, uploadedSettingReferences, setGeneratedPanels, setCharacterReferences, currentProjectId, saveProjectData, story, storyBreakdown, characterReferences, generatedPanels, uploadedCharacterReferences, generationState, closeImageEditModal, showError]);

	const handleImageModify = useCallback(async (modificationPrompt: string) => {
		if (!editingImage) return;

		setIsImageProcessing(true);
		try {
			// 创建带超时的fetch请求 (120秒超时)
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 120000);

			let response: Response;
			try {
				response = await fetch("/api/modify-image", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						imageType: editingImage.type,
						imageId: editingImage.id,
						originalImage: editingImage.image,
						modificationPrompt: modificationPrompt,
						originalPrompt: editingImage.originalPrompt,
						language: i18n?.language || "en",
						aiModel: aiModel,
						imageSize: imageSize,
					}),
					signal: controller.signal,
				});
				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorMessage = await handleApiError(response, "Failed to modify image");
					throw new Error(errorMessage);
				}
			} catch (fetchError) {
				clearTimeout(timeoutId);
				if (fetchError instanceof Error && fetchError.name === 'AbortError') {
					throw new Error('图像修改请求超时，请稍后重试。如果问题持续，请尝试简化修改要求。');
				}
				throw fetchError;
			}

			const result = await response.json();
			if (!result.success || !result.imageData) {
				throw new Error(result.error || "Failed to modify image");
			}

			// Update the image in the appropriate state
			if (editingImage.type === 'panel') {
				setGeneratedPanels(prev => prev.map(panel =>
					panel.panelNumber === editingImage.id
						? { ...panel, image: result.imageData }
						: panel
				));
			} else if (editingImage.type === 'character') {
				setCharacterReferences(prev => prev.map(char =>
					char.name === editingImage.id
						? { ...char, image: result.imageData }
						: char
				));
			}

			// Save to project storage if we have a current project
			if (currentProjectId) {
				await saveProjectData(
					currentProjectId,
					story,
					style,
					storyAnalysis,
					storyBreakdown,
					characterReferences,
					generatedPanels,
					uploadedCharacterReferences,
					uploadedSettingReferences,
					imageSize,
					undefined, // tags
					generationState
				);
			}

			closeImageEditModal();
		} catch (error) {
			console.error("Error modifying image:", error);
			showError(`Failed to modify image: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			setIsImageProcessing(false);
		}
	}, [editingImage, i18n, aiModel, imageSize, setGeneratedPanels, setCharacterReferences, currentProjectId, saveProjectData, story, style, storyAnalysis, storyBreakdown, characterReferences, generatedPanels, uploadedCharacterReferences, uploadedSettingReferences, generationState, closeImageEditModal, showError]);

	return {
		showImageEditModal,
		editingImage,
		isImageProcessing,
		openImageEditModal,
		closeImageEditModal,
		handleImageRedraw,
		handleImageModify,
	};
}
