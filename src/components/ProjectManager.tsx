"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
	getProjectList,
	createProject,
	deleteProject,
	getCurrentProjectId,
	setCurrentProject,
} from "@/lib/hybridStorage";
import type { ProjectListItem, CreateProjectParams, ImageSizeConfig } from "@/types/project";
import { IMAGE_SIZE_PRESETS } from "@/types/project";
import type { ComicStyle } from "@/types";

interface ProjectManagerProps {
	isOpen: boolean;
	onClose: () => void;
	onProjectSelect: (projectId: string) => void;
	onNewProject: () => void;
	currentProjectId?: string | null;
}

export default function ProjectManager({
	isOpen,
	onClose,
	onProjectSelect,
	onNewProject,
	currentProjectId,
}: ProjectManagerProps) {
	const { t } = useI18n();
	const [projects, setProjects] = useState<ProjectListItem[]>([]);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [newProjectName, setNewProjectName] = useState("");
	const [newProjectDescription, setNewProjectDescription] = useState("");
	const [newProjectStyle, setNewProjectStyle] = useState<ComicStyle>("manga");
	const [newProjectImageSize, setNewProjectImageSize] = useState<string>("landscape_16_9");
	const [isCreating, setIsCreating] = useState(false);

	// 加载项目列表
	useEffect(() => {
		if (isOpen) {
			loadProjects();
		}
	}, [isOpen]);

	const loadProjects = async () => {
		try {
			const projectList = await getProjectList();
			setProjects(projectList);
		} catch (error) {
			console.error('Failed to load projects:', error);
			setProjects([]);
		}
	};

	const handleCreateProject = async () => {
		if (!newProjectName.trim()) return;

		setIsCreating(true);
		try {
			const trimmedDescription = newProjectDescription.trim();
			const selectedImageSize = IMAGE_SIZE_PRESETS[newProjectImageSize];
			const params: CreateProjectParams = {
				name: newProjectName.trim(),
				...(trimmedDescription && { description: trimmedDescription }),
				style: newProjectStyle,
				...(selectedImageSize && { imageSize: selectedImageSize }),
			};

			const metadata = await createProject(params);

			// 刷新项目列表
			await loadProjects();
			
			// 重置表单
			setNewProjectName("");
			setNewProjectDescription("");
			setNewProjectStyle("manga");
			setNewProjectImageSize("landscape_16_9");
			setShowCreateForm(false);
			
			// 通知父组件新项目已创建
			onNewProject();
			onProjectSelect(metadata.id);
			onClose();
		} catch (error) {
			console.error("Failed to create project:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const handleDeleteProject = async (projectId: string, projectName: string) => {
		if (!confirm(t("confirmDeleteProject", { name: projectName }))) {
			return;
		}

		try {
			await deleteProject(projectId);
			await loadProjects();
			
			// 如果删除的是当前项目，通知父组件
			if (projectId === currentProjectId) {
				onNewProject(); // 创建新的空项目
			}
		} catch (error) {
			console.error("Failed to delete project:", error);
		}
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString();
	};

	const formatTime = (timestamp: number) => {
		return new Date(timestamp).toLocaleString();
	};

	if (!isOpen) return null;

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
						<h3 className="text-lg font-semibold">{t("existingProjects")}</h3>
						
						{projects.length === 0 ? (
							<div className="text-center py-8 text-gray-500">
								<p>{t("noProjectsFound")}</p>
								<p className="text-sm mt-2">{t("createFirstProject")}</p>
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{projects.map((project) => (
									<div
										key={project.metadata.id}
										className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
											project.metadata.id === currentProjectId
												? "border-blue-500 bg-blue-50"
												: "border-gray-200"
										}`}
									>
										{/* 项目缩略图 */}
										{project.metadata.thumbnail && (
											<div className="mb-3">
												<img
													src={project.metadata.thumbnail}
													alt={project.metadata.name}
													className="w-full h-32 object-cover rounded"
												/>
											</div>
										)}

										{/* 项目信息 */}
										<div className="space-y-2">
											<h4 className="font-semibold text-gray-900 truncate">
												{project.metadata.name}
											</h4>
											
											{project.metadata.description && (
												<p className="text-sm text-gray-600 line-clamp-2">
													{project.metadata.description}
												</p>
											)}

											<div className="text-xs text-gray-500 space-y-1">
												<div className="flex justify-between">
													<span>{t("style")}:</span>
													<span>{t(project.metadata.style)}</span>
												</div>
												<div className="flex justify-between">
													<span>{t("panels")}:</span>
													<span>{project.metadata.panelCount}</span>
												</div>
												<div className="flex justify-between">
													<span>{t("characters")}:</span>
													<span>{project.metadata.characterCount}</span>
												</div>
												<div className="flex justify-between">
													<span>{t("updated")}:</span>
													<span>{formatDate(project.metadata.updatedAt)}</span>
												</div>
											</div>

											{/* 操作按钮 */}
											<div className="flex space-x-2 pt-2">
												<button
													onClick={() => {
														onProjectSelect(project.metadata.id);
														onClose();
													}}
													className="flex-1 btn-manga-primary text-sm py-1"
												>
													{project.metadata.id === currentProjectId ? t("current") : t("open")}
												</button>
												<button
													onClick={() => handleDeleteProject(project.metadata.id, project.metadata.name)}
													className="btn-manga-outline text-sm py-1 px-3 text-red-600 border-red-300 hover:bg-red-50"
												>
													{t("delete")}
												</button>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
