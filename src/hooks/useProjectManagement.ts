import { useCallback, useRef } from "react";
import { apiClient } from "@/lib/apiClient";
import { DEFAULT_IMAGE_SIZE } from "@/types/project";
import type { ComicStyle } from "@/types";

interface UseProjectManagementProps {
	currentProjectId: string | null;
	setCurrentProjectId: (id: string | null) => void;
	clearResults: () => void;
	setStyle: (style: ComicStyle) => void;
	setStory: (story: string) => void;
	setStoryAnalysis: (analysis: any) => void;
	setStoryBreakdown: (breakdown: any) => void;
	setCharacterReferences: (refs: any[]) => void;
	setGeneratedPanels: (panels: any[]) => void;
	setUploadedCharacterReferences: (refs: any[]) => void;
	setUploadedSettingReferences: (refs: any[]) => void;
	setImageSize: (size: any) => void;
	setAiModel: (model: string) => void;
	setGenerationState: (state: any) => void;
	setIsLoadingState: (loading: boolean) => void;
}

export function useProjectManagement({
	currentProjectId,
	setCurrentProjectId,
	clearResults,
	setStyle,
	setStory,
	setStoryAnalysis,
	setStoryBreakdown,
	setCharacterReferences,
	setGeneratedPanels,
	setUploadedCharacterReferences,
	setUploadedSettingReferences,
	setImageSize,
	setAiModel,
	setGenerationState,
	setIsLoadingState,
}: UseProjectManagementProps) {
	// 防止重复请求的缓存
	const loadingProjectsRef = useRef<Set<string>>(new Set());
	
	// 防抖定时器
	const projectSelectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// 🔧 统一的云端项目数据管理函数
	const saveProjectData = useCallback(async (
		projectId: string,
		story: string,
		style: ComicStyle,
		storyAnalysis: any,
		storyBreakdown: any,
		characterReferences: any[],
		generatedPanels: any[],
		uploadedCharacterReferences: any[],
		uploadedSettingReferences: any[],
		imageSize?: any,
		tags?: string[],
		currentGenerationState?: any
	) => {
		try {
			console.log('💾 Saving complete project data to cloud:', projectId);

			// 1. 更新项目基本信息
			await apiClient.updateProject(projectId, {
				name: story.split('\n')[0]?.replace(/^#\s*/, '') || 'Untitled Project',
				description: story.substring(0, 200) + (story.length > 200 ? '...' : ''),
				style,
			});

			// 2. 保存完整的项目数据到专门的存储API
			const completeProjectData = {
				projectId,
				story,
				style,
				storyAnalysis,
				storyBreakdown,
				characterReferences,
				generatedPanels,
				uploadedCharacterReferences,
				uploadedSettingReferences,
				imageSize,
				tags,
				generationState: currentGenerationState || null,
				metadata: {
					lastSaved: new Date().toISOString(),
					panelCount: generatedPanels?.length || 0,
					characterCount: characterReferences?.length || 0,
				}
			};

			// 使用项目存储API保存完整数据
			const response = await fetch('/api/project-storage', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(completeProjectData),
			});

			if (!response.ok) {
				throw new Error(`Failed to save project data: ${response.statusText}`);
			}

			const result = await response.json();
			if (!result.success) {
				throw new Error(result.error || 'Failed to save project data');
			}

			console.log('✅ Complete project data saved successfully');
			return { success: true };
		} catch (error) {
			console.error('❌ Failed to save project data:', error);
			throw error;
		}
	}, []);

	const loadProjectData = useCallback(async (projectId: string) => {
		// 防止重复请求
		if (loadingProjectsRef.current.has(projectId)) {
			console.log(`⏳ Project ${projectId} is already being loaded, skipping duplicate request`);
			return null;
		}

		try {
			loadingProjectsRef.current.add(projectId);
			console.log('📂 Loading complete project data from cloud:', projectId);

			// 1. 加载项目基本信息
			const projectResponse = await apiClient.getProject(projectId);
			if (!projectResponse.success || !projectResponse.project) {
				throw new Error('Project not found');
			}

			// 2. 加载完整项目数据
			const dataResponse = await fetch(`/api/project-storage?projectId=${projectId}`);
			if (!dataResponse.ok) {
				throw new Error(`Failed to load project data: ${dataResponse.statusText}`);
			}

			const dataResult = await dataResponse.json();
			if (!dataResult.success) {
				throw new Error(dataResult.error || 'Failed to load project data');
			}

			const completeData = {
				...projectResponse.project,
				...dataResult.data,
			};

			console.log('✅ Complete project data loaded successfully');
			return completeData;
		} catch (error) {
			console.error('❌ Failed to load project data:', error);
			throw error;
		} finally {
			// 清理缓存，允许后续请求
			loadingProjectsRef.current.delete(projectId);
		}
	}, []);

	// 防抖的项目选择函数
	const debouncedProjectSelect = useCallback((projectId: string) => {
		// 清除之前的定时器
		if (projectSelectTimeoutRef.current) {
			clearTimeout(projectSelectTimeoutRef.current);
		}

		// 设置新的定时器
		projectSelectTimeoutRef.current = setTimeout(() => {
			handleProjectSelectInternal(projectId);
		}, 300); // 300ms 防抖
	}, []);

	// 项目管理函数
	const handleProjectSelectInternal = async (projectId: string) => {
		try {
			setIsLoadingState(true);
			console.log(`🔄 Selecting project: ${projectId}`);

			// 🔧 使用统一数据服务加载完整项目数据
			let projectData = null;

			try {
				console.log('📂 Loading complete project data:', projectId);

				// 使用新的完整数据加载函数
				projectData = await loadProjectData(projectId);

				// 如果返回null，说明请求被跳过（重复请求），直接返回
				if (!projectData) {
					console.log('⏳ Project loading skipped (duplicate request)');
					return;
				}

				console.log('✅ Complete project data loaded successfully:', {
					id: projectData.id || projectData.projectId,
					name: projectData.name,
					style: projectData.style,
					hasStory: !!projectData.story,
					hasAnalysis: !!projectData.storyAnalysis,
					hasBreakdown: !!projectData.storyBreakdown,
					panelCount: projectData.generatedPanels?.length || 0,
					characterCount: projectData.characterReferences?.length || 0,
				});
			} catch (error) {
				console.error('❌ Error loading complete project data:', error);
				projectData = null;
			}

			if (projectData) {
				console.log('✅ Complete project data loaded for selection');

				// 清除当前数据
				clearResults();

				// 设置完整的项目数据到状态
				setStyle(projectData.style || 'manga');
				setStory(projectData.story || '');
				setStoryAnalysis(projectData.storyAnalysis || null);
				setStoryBreakdown(projectData.storyBreakdown || null);
				setCharacterReferences(projectData.characterReferences || []);
				setGeneratedPanels(projectData.generatedPanels || []);
				setUploadedCharacterReferences(projectData.uploadedCharacterReferences || []);
				setUploadedSettingReferences(projectData.uploadedSettingReferences || []);
				setImageSize(projectData.imageSize);
				setAiModel(projectData.aiModel || 'auto');
				setGenerationState(projectData.generationState || {
					isGenerating: false,
					isPaused: false,
					currentPanel: 0,
					totalPanels: 0,
					completedPanels: 0,
					failedPanels: [],
				});

				// 设置当前项目ID
				setCurrentProjectId(projectId);

				console.log('✅ Complete project selection completed successfully');
			} else {
				console.warn('❌ No project data found for project:', projectId);
				// 如果找不到项目数据，清除当前项目ID
				setCurrentProjectId(null);
			}
		} catch (error) {
			console.error("❌ Failed to select project:", error);
			// 出错时也清除当前项目ID
			setCurrentProjectId(null);
		} finally {
			setIsLoadingState(false);
		}
	};

	// 公开的项目选择函数（使用防抖）
	const handleProjectSelect = useCallback((projectId: string) => {
		debouncedProjectSelect(projectId);
	}, [debouncedProjectSelect]);

	const handleNewProject = () => {
		// 清除所有数据，开始新项目
		clearResults();
		setStory("");
		setStyle("manga");
		setCurrentProjectId(null);

		// 清除当前项目设置
		localStorage.removeItem("manga-current-project");
	};

	return {
		saveProjectData,
		loadProjectData,
		handleProjectSelect,
		handleNewProject,
	};
}
