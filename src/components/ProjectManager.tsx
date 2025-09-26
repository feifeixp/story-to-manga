"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useAuth } from "@/components/AuthProvider";
import { apiClient } from "@/lib/apiClient";
import type { ProjectListItem, CreateProjectParams, ImageSizeConfig } from "@/types/project";
import { IMAGE_SIZE_PRESETS, DEFAULT_IMAGE_SIZE } from "@/types/project";
import type { ComicStyle } from "@/types";

interface ProjectManagerProps {
	isOpen?: boolean;
	onClose?: () => void;
	onProjectSelect?: (projectId: string) => void;
	onNewProject?: () => void;
	currentProjectId?: string | null;
	showCreateButton?: boolean;
	showSelectButton?: boolean;
}

function ProjectManager({
	isOpen = true,
	onClose,
	onProjectSelect,
	onNewProject,
	currentProjectId,
	showCreateButton = true,
	showSelectButton = false,
}: ProjectManagerProps) {
	const { t } = useI18n();
	const { user, session } = useAuth();
	const [projects, setProjects] = useState<ProjectListItem[]>([]);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [newProjectName, setNewProjectName] = useState("");
	const [newProjectDescription, setNewProjectDescription] = useState("");
	const [newProjectStyle, setNewProjectStyle] = useState<ComicStyle>("manga");
	const [newProjectImageSize, setNewProjectImageSize] = useState<string>("landscape_16_9");
	const [isCreating, setIsCreating] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	// 加载项目列表
	const loadProjects = useCallback(async () => {
		setIsLoading(true);
		setLoadError(null);

		try {
			console.log('📋 ProjectManager: Loading projects...');

			const result = await apiClient.getProjects();

			if (result.success && result.projects) {
				const projectList = result.projects.map(project => ({
					id: project.id,
					name: project.name,
					description: project.description,
					createdAt: new Date(project.createdAt).getTime(),
					updatedAt: new Date(project.updatedAt).getTime(),
					style: project.style,
					panelCount: 0, // TODO: 从项目数据中获取
					characterCount: 0, // TODO: 从项目数据中获取
					imageSize: DEFAULT_IMAGE_SIZE, // 使用完整的默认尺寸配置
				}));

				console.log('📋 ProjectManager: Loaded projects:', projectList.length);
				setProjects(projectList);

				if (projectList.length === 0) {
					console.log('⚠️ ProjectManager: No projects found');
				}
			} else {
				throw new Error('Failed to load projects');
			}
		} catch (error) {
			console.error('❌ ProjectManager: Failed to load projects:', error);

			// 提供更友好的错误信息
			let errorMessage = 'Failed to load projects';

			if (error instanceof Error) {
				if (error.message === 'Failed to fetch') {
					errorMessage = '网络连接失败，请检查网络连接或刷新页面重试';
				} else {
					errorMessage = error.message;
				}
			}

			setLoadError(errorMessage);
			setProjects([]);

			console.log('❌ ProjectManager: Project loading failed, no auto-retry to prevent infinite loop');
		} finally {
			setIsLoading(false);
		}
	}, []);

	// 当对话框打开时加载项目
	useEffect(() => {
		if (isOpen) {
			loadProjects();
		}
	}, [isOpen, loadProjects]);

	const handleCreateProject = async () => {
		if (!newProjectName.trim()) return;

		setIsCreating(true);
		try {
			const trimmedDescription = newProjectDescription.trim();
			const projectData = {
				name: newProjectName.trim(),
				description: trimmedDescription || '',
				style: newProjectStyle,
			};

			const result = await apiClient.createProject(projectData);

			if (!result.success || !result.project) {
				throw new Error('Failed to create project');
			}

			const project = result.project;

			// 刷新项目列表
			await loadProjects();

			// 重置表单
			setNewProjectName("");
			setNewProjectDescription("");
			setNewProjectStyle("manga");
			setNewProjectImageSize("landscape_16_9");
			setShowCreateForm(false);

			// 通知父组件新项目已创建
			onNewProject?.();
			onProjectSelect?.(project.id);
			onClose?.();
		} catch (error) {
			console.error("Failed to create project:", error);
			alert('创建项目失败: ' + (error instanceof Error ? error.message : '未知错误'));
		} finally {
			setIsCreating(false);
		}
	};

	const handleDeleteProject = async (projectId: string, projectName: string) => {
		if (!confirm(t("confirmDeleteProject", { name: projectName }))) {
			return;
		}

		try {
			const result = await apiClient.deleteProject(projectId);

			if (!result.success) {
				throw new Error('Failed to delete project');
			}

			await loadProjects();

			// 如果删除的是当前项目，通知父组件
			if (projectId === currentProjectId) {
				onNewProject?.(); // 创建新的空项目
			}
		} catch (error) {
			console.error("Failed to delete project:", error);
			alert('删除项目失败: ' + (error instanceof Error ? error.message : '未知错误'));
		}
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString();
	};

	const formatTime = (timestamp: number) => {
		return new Date(timestamp).toLocaleString();
	};

	if (isOpen === false) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
				{/* 头部 */}
				<div className="flex items-center justify-between p-6 border-b">
					<h2 className="text-2xl font-bold text-gray-900">
						{t("projectManager")}
					</h2>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 text-2xl"
					>
						×
					</button>
				</div>

				{/* 内容区域 */}
				<div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
					{/* 创建新项目按钮 */}
					<div className="mb-6">
						<button
							onClick={() => setShowCreateForm(true)}
							className="btn-manga-primary"
							disabled={showCreateForm}
						>
							{t("createNewProject")}
						</button>
					</div>

					{/* 创建项目表单 */}
					{showCreateForm && (
						<div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
							<h3 className="text-lg font-semibold mb-4">{t("createNewProject")}</h3>
							
							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">
										{t("projectName")} *
									</label>
									<input
										type="text"
										value={newProjectName}
										onChange={(e) => setNewProjectName(e.target.value)}
										className="form-control-manga w-full"
										placeholder={t("enterProjectName")}
										maxLength={100}
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">
										{t("projectDescription")}
									</label>
									<textarea
										value={newProjectDescription}
										onChange={(e) => setNewProjectDescription(e.target.value)}
										className="form-control-manga w-full"
										placeholder={t("enterProjectDescription")}
										rows={3}
										maxLength={500}
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">
										{t("comicStyle")}
									</label>
									<select
										value={newProjectStyle}
										onChange={(e) => setNewProjectStyle(e.target.value as ComicStyle)}
										className="form-control-manga w-full"
									>
										<option value="manga">{t("manga")}</option>
										<option value="comic">{t("comic")}</option>
										<option value="wuxia">{t("wuxiaCultivation")}</option>
										<option value="healing">{t("healingStyle")}</option>
										<option value="manhwa">{t("manhwaStyle")}</option>
										<option value="cinematic">{t("cinematicStyle")}</option>
										<option value="shojo">{t("shojoManga")}</option>
										<option value="seinen">{t("seinenManga")}</option>
										<option value="chibi">{t("chibiComic")}</option>
										<option value="fantasy">{t("fantasyEpic")}</option>
									</select>
								</div>

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-2">
										{t("imageSize")}
									</label>
									<select
										value={newProjectImageSize}
										onChange={(e) => setNewProjectImageSize(e.target.value)}
										className="form-control-manga w-full"
									>
										{Object.entries(IMAGE_SIZE_PRESETS).map(([key, config]) => (
											<option key={key} value={key}>
												{config.aspectRatio} ({config.width}×{config.height})
											</option>
										))}
									</select>
									<p className="text-xs text-gray-500 mt-1">
										{t("imageSizeDescription")}
									</p>
								</div>

								<div className="flex space-x-3">
									<button
										onClick={handleCreateProject}
										disabled={!newProjectName.trim() || isCreating}
										className="btn-manga-primary"
									>
										{isCreating ? t("creating") : t("create")}
									</button>
									<button
										onClick={() => {
											setShowCreateForm(false);
											setNewProjectName("");
											setNewProjectDescription("");
											setNewProjectStyle("manga");
											setNewProjectImageSize("landscape_16_9");
										}}
										className="btn-manga-outline"
									>
										{t("cancel")}
									</button>
								</div>
							</div>
						</div>
					)}

					{/* 项目列表 */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold">{t("existingProjects")}</h3>
							<button
								onClick={loadProjects}
								disabled={isLoading}
								className="btn-manga-outline text-sm px-3 py-1"
								title="刷新项目列表"
							>
								{isLoading ? '🔄 刷新中...' : '🔄 刷新'}
							</button>
						</div>

						{/* 加载状态 */}
						{isLoading && (
							<div className="text-center py-8 text-gray-500">
								<div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full mb-2"></div>
								<p>正在加载项目列表...</p>
							</div>
						)}

						{/* 错误状态 */}
						{loadError && !isLoading && (
							<div className="text-center py-8">
								<div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
									<p className="text-red-800 font-medium">加载项目失败</p>
									<p className="text-red-600 text-sm mt-1">{loadError}</p>
								</div>
								<button
									onClick={loadProjects}
									className="btn-manga-primary"
								>
									重试
								</button>
							</div>
						)}

						{/* 空状态 */}
						{!isLoading && !loadError && projects.length === 0 && (
							<div className="text-center py-8 text-gray-500">
								<p>{t("noProjectsFound")}</p>
								<p className="text-sm mt-2">{t("createFirstProject")}</p>
								<div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
									<p className="text-yellow-800 text-sm">
										💡 如果你之前创建过项目但看不到，可能是数据同步问题。
										请尝试点击上方的"刷新"按钮，或者重新创建项目。
									</p>
								</div>
							</div>
						)}

						{/* 项目列表 */}
						{!isLoading && !loadError && projects.length > 0 && (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{projects.map((project, index) => {
									// 🔧 调试：检查项目数据结构
									console.log('🔍 ProjectManager: Project data structure:', {
										project,
										hasId: !!project.id,
										projectKeys: Object.keys(project)
									});

									// 获取项目数据
									const projectId = project.id;
									const projectName = project.name;
									const projectDescription = project.description;
									const projectCreatedAt = project.createdAt;
									const projectUpdatedAt = project.updatedAt;
									const projectStyle = project.style;
									const projectPanelCount = project.panelCount || 0;
									const projectCharacterCount = project.characterCount || 0;

									return (
										<div
											key={projectId || `project-${index}`}
											className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
												projectId === currentProjectId
													? "border-blue-500 bg-blue-50"
													: "border-gray-200"
											}`}
										>
											{/* 项目缩略图 */}
											{project.thumbnail && (
												<div className="mb-3">
													<img
														src={project.thumbnail}
														alt={projectName}
														className="w-full h-32 object-cover rounded"
													/>
												</div>
											)}

											{/* 项目信息 */}
											<div className="space-y-2">
												<h4 className="font-semibold text-gray-900 truncate">
													{projectName}
												</h4>

												{projectDescription && (
													<p className="text-sm text-gray-600 line-clamp-2">
														{projectDescription}
													</p>
												)}

												<div className="text-xs text-gray-500 space-y-1">
													<div className="flex justify-between">
														<span>{t("style")}:</span>
														<span>{t(projectStyle)}</span>
													</div>
													<div className="flex justify-between">
														<span>{t("panels")}:</span>
														<span>{projectPanelCount}</span>
													</div>
													<div className="flex justify-between">
														<span>{t("characters")}:</span>
														<span>{projectCharacterCount}</span>
													</div>
													<div className="flex justify-between">
														<span>{t("updated")}:</span>
														<span>{formatDate(projectUpdatedAt)}</span>
													</div>
												</div>

												{/* 操作按钮 */}
												<div className="flex space-x-2 pt-2">
													{showSelectButton ? (
														// 项目管理页面：显示"开始创作"按钮
														<button
															onClick={() => {
																console.log('🔗 ProjectManager: Selecting project:', projectId);
																onProjectSelect?.(projectId);
															}}
															className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm py-2 px-4 rounded transition-colors"
														>
															开始创作
														</button>
													) : (
														// 模态框：显示"打开"按钮
														<button
															onClick={() => {
																console.log('🔗 ProjectManager: Opening project:', projectId);
																onProjectSelect?.(projectId);
																onClose?.();
															}}
															className="flex-1 btn-manga-primary text-sm py-1"
														>
															{projectId === currentProjectId ? t("current") : t("open")}
														</button>
													)}
													<button
														onClick={() => handleDeleteProject(projectId, projectName)}
														className="btn-manga-outline text-sm py-1 px-3 text-red-600 border-red-300 hover:bg-red-50"
													>
														{t("delete")}
													</button>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

export default ProjectManager;
export { ProjectManager };
