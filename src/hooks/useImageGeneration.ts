import { useState, useCallback } from "react";
import { useI18n } from "@/components/I18nProvider";
import { imageOptimizer, OPTIMIZATION_PRESETS } from "@/lib/imageOptimizer";
import { handleApiError } from "@/utils/errorUtils";
import type { GenerationState, OptimizationStats } from "@/types/app";

interface UseImageGenerationProps {
	characterReferences: any[];
	storyAnalysis: any;
	uploadedSettingReferences: any[];
	style: string;
	aiModel: string;
	imageSize: any;
	currentProjectId: string | null;
	generationState: GenerationState;
	setGenerationState: (state: GenerationState | ((prev: GenerationState) => GenerationState)) => void;
	setGeneratedPanels: (panels: any[] | ((prev: any[]) => any[])) => void;
	setOptimizationStats: (stats: OptimizationStats | ((prev: OptimizationStats) => OptimizationStats)) => void;
}

export function useImageGeneration({
	characterReferences,
	storyAnalysis,
	uploadedSettingReferences,
	style,
	aiModel,
	imageSize,
	currentProjectId,
	generationState,
	setGenerationState,
	setGeneratedPanels,
	setOptimizationStats,
}: UseImageGenerationProps) {
	const { i18n } = useI18n();

	// 生成单个面板的辅助函数（优化版）
	const generateSinglePanel = useCallback(async (panel: any, retryCount = 0) => {
		const maxRetries = 2;
		let controller: AbortController | null = null;
		let timeoutId: NodeJS.Timeout | null = null;

		try {
			// 添加请求超时控制
			controller = new AbortController();
			timeoutId = setTimeout(() => {
				if (controller && !controller.signal.aborted) {
					controller.abort();
				}
			}, 120000); // 120秒超时

			const response = await fetch('/api/generate-panel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					panel: {
						description: panel.description || panel.sceneDescription,
						panelDescription: panel.panelDescription || panel.sceneDescription,
						sceneDescription: panel.sceneDescription,
						panelNumber: panel.panelNumber,
						characters: panel.characters || [],
						dialogue: panel.dialogue,
						cameraAngle: panel.cameraAngle,
						visualMood: panel.visualMood,
					},
					characterReferences: characterReferences,
					setting: storyAnalysis?.setting || '',
					style: style,
					uploadedSettingReferences: uploadedSettingReferences || [],
					language: i18n?.language || 'en',
					aiModel: aiModel,
					imageSize: imageSize,
					projectId: currentProjectId, // 添加项目ID以启用云端保存
				}),
				signal: controller.signal,
			});

			// 清理超时控制
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			if (result.success && result.generatedPanel?.image) {
				// 优化图像
				let optimizedImage = result.generatedPanel.image;
				try {
					const optimization = await imageOptimizer.optimizeImage(
						result.generatedPanel.image,
						OPTIMIZATION_PRESETS.STANDARD
					);

					optimizedImage = optimization.data;

					// 更新优化统计
					setOptimizationStats(prev => ({
						totalOriginalSize: prev.totalOriginalSize + optimization.originalSize,
						totalOptimizedSize: prev.totalOptimizedSize + optimization.optimizedSize,
						totalSavings: prev.totalSavings + (optimization.originalSize - optimization.optimizedSize),
						optimizedCount: prev.optimizedCount + 1,
					}));

					console.log(`Panel ${panel.panelNumber} optimized: ${(optimization.originalSize / 1024 / 1024).toFixed(2)}MB → ${(optimization.optimizedSize / 1024 / 1024).toFixed(2)}MB (${(optimization.compressionRatio * 100).toFixed(1)}% compression)`);
				} catch (error) {
					console.warn(`Failed to optimize panel ${panel.panelNumber}:`, error);
				}

				const newPanel = {
					panelNumber: panel.panelNumber,
					description: panel.description,
					image: optimizedImage,
				};

				setGeneratedPanels(prev => {
					const updated = [...prev];
					const existingIndex = updated.findIndex(p => p.panelNumber === panel.panelNumber);
					if (existingIndex >= 0) {
						updated[existingIndex] = newPanel;
					} else {
						updated.push(newPanel);
						updated.sort((a, b) => a.panelNumber - b.panelNumber);
					}
					return updated;
				});

				return newPanel;
			}
			return null;
		} catch (error) {
			// 清理超时控制
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}

			// 特殊处理AbortError
			if (error instanceof Error && error.name === 'AbortError') {
				console.warn(`Panel ${panel.panelNumber} generation was aborted (attempt ${retryCount + 1})`);

				// 如果是超时导致的abort，可以重试
				if (retryCount < maxRetries && !generationState.isPaused) {
					console.log(`Retrying panel ${panel.panelNumber} after timeout in 3 seconds...`);
					await new Promise(resolve => setTimeout(resolve, 3000));
					return generateSinglePanel(panel, retryCount + 1);
				}

				throw new Error(`Panel ${panel.panelNumber} generation timed out after ${retryCount + 1} attempts`);
			}

			console.error(`Error generating panel ${panel.panelNumber} (attempt ${retryCount + 1}):`, error);

			// 自动重试机制（非AbortError）
			if (retryCount < maxRetries && !generationState.isPaused) {
				console.log(`Retrying panel ${panel.panelNumber} in 2 seconds...`);
				await new Promise(resolve => setTimeout(resolve, 2000));
				return generateSinglePanel(panel, retryCount + 1);
			}

			throw error;
		}
	}, [characterReferences, storyAnalysis, uploadedSettingReferences, style, aiModel, imageSize, currentProjectId, i18n, generationState.isPaused, setGeneratedPanels, setOptimizationStats]);

	// 继续生成功能
	const continueGeneration = useCallback(async (storyBreakdown: any, generatedPanels: any[]) => {
		if (!storyBreakdown || generationState.isGenerating) return;

		const remainingPanels = storyBreakdown.panels.filter(
			(panel: any) => !generatedPanels.some(generated => generated.panelNumber === panel.panelNumber)
		);

		if (remainingPanels.length === 0) {
			alert("所有面板都已生成完成！");
			return;
		}

		setGenerationState(prev => ({
			...prev,
			isGenerating: true,
			isPaused: false,
			totalPanels: storyBreakdown.panels.length,
			completedPanels: generatedPanels.length,
			currentPanel: remainingPanels && remainingPanels.length > 0 ? remainingPanels[0]?.panelNumber || 0 : 0,
		}));

		try {
			// 检查是否有剩余面板需要生成
			if (!remainingPanels || remainingPanels.length === 0) {
				console.log('No remaining panels to generate');
				setGenerationState(prev => ({
					...prev,
					isGenerating: false,
				}));
				return;
			}

			// 动态批次大小：根据剩余面板数量和模型类型调整，针对大量面板优化
			const getDynamicBatchSize = () => {
				const totalPanels = remainingPanels.length;
				const isVolcEngine = aiModel === 'volcengine';

				// 如果面板数量很多，减少批次大小以避免前端性能问题
				if (totalPanels > 30) {
					return isVolcEngine ? 2 : 3; // 大量面板时使用更小的批次
				}
				if (totalPanels <= 3) return totalPanels;
				if (isVolcEngine) return Math.min(3, totalPanels); // VolcEngine限制更严格
				return Math.min(5, totalPanels); // Gemini可以更多并行
			};

			const batchSize = getDynamicBatchSize();
			const batches = [];
			for (let i = 0; i < remainingPanels.length; i += batchSize) {
				batches.push(remainingPanels.slice(i, i + batchSize));
			}

			setGenerationState(prev => ({
				...prev,
				batchInfo: {
					currentBatch: 1,
					totalBatches: batches.length,
					batchSize,
				},
			}));

			// 性能监控
			let totalGenerationTime = 0;

			for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
				if (generationState.isPaused) break;

				const batch = batches[batchIndex];
				const batchStart = Date.now();

				setGenerationState(prev => ({
					...prev,
					batchInfo: {
						...prev.batchInfo!,
						currentBatch: batchIndex + 1,
					},
				}));

				// 并行生成当前批次的面板，带有进度更新
				const batchPromises = (batch || []).map(async (panel: any, index: number) => {
					if (generationState.isPaused) return null;

					// 错开请求时间，避免同时发送
					if (index > 0) {
						await new Promise(resolve => setTimeout(resolve, index * 200));
					}

					setGenerationState(prev => ({
						...prev,
						currentPanel: panel.panelNumber,
					}));

					try {
						const result = await generateSinglePanel(panel);
						if (result) {
							setGenerationState(prev => ({
								...prev,
								completedPanels: prev.completedPanels + 1,
							}));
						}
						return result;
					} catch (error) {
						console.error(`Failed to generate panel ${panel.panelNumber}:`, error);
						setGenerationState(prev => ({
							...prev,
							failedPanels: [...prev.failedPanels, panel.panelNumber],
						}));
						return null;
					}
				});

				const batchResults = await Promise.allSettled(batchPromises);
				const batchTime = Date.now() - batchStart;
				totalGenerationTime += batchTime;

				// 记录批次性能
				const successCount = batchResults.filter(r => r.status === 'fulfilled' && r.value).length;
				const batchLength = batch?.length || 0;
				console.log(`Batch ${batchIndex + 1}/${batches.length}: ${successCount}/${batchLength} panels generated in ${batchTime}ms`);

				// 动态调整批次间延迟
				if (batchIndex < batches.length - 1 && batchLength > 0) {
					const avgTimePerPanel = batchTime / batchLength;
					const delay = avgTimePerPanel > 10000 ? 2000 : 1000; // 如果生成慢，延迟更长
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}

			// 性能报告
			const avgTimePerPanel = totalGenerationTime / remainingPanels.length;
			console.log(`Generation completed: ${remainingPanels.length} panels in ${totalGenerationTime}ms (avg: ${avgTimePerPanel.toFixed(0)}ms/panel)`);

			setGenerationState(prev => ({
				...prev,
				isGenerating: false,
				currentPanel: 0,
			}));

			alert("继续生成完成！");
		} catch (error) {
			console.error("Continue generation error:", error);
			setGenerationState(prev => ({
				...prev,
				isGenerating: false,
				currentPanel: 0,
			}));
			alert("继续生成失败，请重试");
		}
	}, [generationState, setGenerationState, generateSinglePanel, aiModel]);

	// 暂停生成
	const pauseGeneration = useCallback(() => {
		setGenerationState(prev => ({
			...prev,
			isPaused: true,
		}));
	}, [setGenerationState]);

	// 恢复生成
	const resumeGeneration = useCallback((storyBreakdown: any, generatedPanels: any[]) => {
		setGenerationState(prev => ({
			...prev,
			isPaused: false,
		}));
		continueGeneration(storyBreakdown, generatedPanels);
	}, [setGenerationState, continueGeneration]);

	return {
		generateSinglePanel,
		continueGeneration,
		pauseGeneration,
		resumeGeneration,
	};
}
