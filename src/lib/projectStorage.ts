import type {
	CharacterReference,
	ComicStyle,
	GeneratedPanel,
	StoryAnalysis,
	StoryBreakdown,
	UploadedCharacterReference,
	UploadedSettingReference,
} from "@/types";
import type {
	ProjectData,
	ProjectMetadata,
	ProjectListItem,
	CreateProjectParams,
	UpdateProjectParams,
	ImageSizeConfig,
	GenerationState,
} from "@/types/project";
import { DEFAULT_IMAGE_SIZE } from "@/types/project";

// 存储键
const STORAGE_KEYS = {
	PROJECT_LIST: "manga-projects-list",
	PROJECT_DATA: (id: string) => `manga-project-${id}`,
	CURRENT_PROJECT: "manga-current-project",
	VERSION: "manga-project-storage-version",
} as const;

const STORAGE_VERSION = "2.0.0";

// IndexedDB 设置
const DB_NAME = "MangaProjectsDB";
const DB_VERSION = 2;
const IMAGE_STORE = "project-images";

class ProjectImageStorage {
	private db: IDBDatabase | null = null;

	async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(IMAGE_STORE)) {
					db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
				}
			};
		});
	}

	async storeImage(projectId: string, imageId: string, imageData: string): Promise<void> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const transaction = this.db.transaction([IMAGE_STORE], "readwrite");
			const store = transaction.objectStore(IMAGE_STORE);
			const fullId = `${projectId}-${imageId}`;
			const request = store.put({ id: fullId, projectId, imageId, imageData, timestamp: Date.now() });

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async getImage(projectId: string, imageId: string): Promise<string | null> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const transaction = this.db.transaction([IMAGE_STORE], "readonly");
			const store = transaction.objectStore(IMAGE_STORE);
			const fullId = `${projectId}-${imageId}`;
			const request = store.get(fullId);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const result = request.result;
				resolve(result ? result.imageData : null);
			};
		});
	}

	async deleteProjectImages(projectId: string): Promise<void> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const transaction = this.db.transaction([IMAGE_STORE], "readwrite");
			const store = transaction.objectStore(IMAGE_STORE);
			const request = store.openCursor();

			request.onerror = () => reject(request.error);
			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					const record = cursor.value;
					if (record.projectId === projectId) {
						cursor.delete();
					}
					cursor.continue();
				} else {
					resolve();
				}
			};
		});
	}

	async clear(): Promise<void> {
		if (!this.db) await this.init();

		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error("Database not initialized"));
				return;
			}

			const transaction = this.db.transaction([IMAGE_STORE], "readwrite");
			const store = transaction.objectStore(IMAGE_STORE);
			const request = store.clear();

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}
}

const projectImageStorage = new ProjectImageStorage();

// 生成唯一项目ID
function generateProjectId(): string {
	return `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 获取项目列表
export function getProjectList(): ProjectListItem[] {
	try {
		const storedData = localStorage.getItem(STORAGE_KEYS.PROJECT_LIST);
		if (!storedData) return [];

		const projectList: ProjectListItem[] = JSON.parse(storedData);
		return projectList.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
	} catch (error) {
		console.error("Failed to load project list:", error);
		return [];
	}
}

// 保存项目列表
function saveProjectList(projects: ProjectListItem[]): void {
	try {
		localStorage.setItem(STORAGE_KEYS.PROJECT_LIST, JSON.stringify(projects));
	} catch (error) {
		console.error("Failed to save project list:", error);
		throw error;
	}
}

// 创建新项目
export function createProject(params: CreateProjectParams): ProjectMetadata {
	const projectId = generateProjectId();
	const now = Date.now();

	const metadata: ProjectMetadata = {
		id: projectId,
		name: params.name,
		description: params.description,
		createdAt: now,
		updatedAt: now,
		panelCount: 0,
		characterCount: 0,
		style: params.style || "manga",
		imageSize: params.imageSize || DEFAULT_IMAGE_SIZE,
	};

	// 添加到项目列表
	const projects = getProjectList();
	projects.push({ metadata });
	saveProjectList(projects);

	// 设置为当前项目
	setCurrentProject(projectId);

	return metadata;
}

// 获取当前项目ID
export function getCurrentProjectId(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT);
	} catch {
		return null;
	}
}

// 设置当前项目
export function setCurrentProject(projectId: string): void {
	try {
		localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT, projectId);
	} catch (error) {
		console.error("Failed to set current project:", error);
		throw error;
	}
}

// 更新项目元数据
export function updateProjectMetadata(projectId: string, updates: UpdateProjectParams): void {
	const projects = getProjectList();
	const projectIndex = projects.findIndex(p => p.metadata.id === projectId);

	if (projectIndex === -1) {
		throw new Error(`Project ${projectId} not found`);
	}

	projects[projectIndex].metadata = {
		...projects[projectIndex].metadata,
		...updates,
		updatedAt: Date.now(),
	};

	saveProjectList(projects);
}

// 保存项目数据
export async function saveProjectData(
	projectId: string,
	story: string,
	style: ComicStyle,
	storyAnalysis: StoryAnalysis | null,
	storyBreakdown: StoryBreakdown | null,
	characterReferences: CharacterReference[],
	generatedPanels: GeneratedPanel[],
	uploadedCharacterReferences: UploadedCharacterReference[] = [],
	uploadedSettingReferences: UploadedSettingReference[] = [],
	imageSize?: ImageSizeConfig,
	generationState?: GenerationState,
): Promise<void> {
	try {
		// 准备文本数据（不包含图片）
		const textData = {
			version: STORAGE_VERSION,
			story,
			style,
			imageSize: imageSize || DEFAULT_IMAGE_SIZE,
			storyAnalysis,
			storyBreakdown,
			characterReferences: characterReferences.map(({ image, ...char }) => char),
			generatedPanels: generatedPanels.map(({ image, ...panel }) => panel),
			uploadedCharacterReferences: uploadedCharacterReferences.map(({ image, ...ref }) => ref),
			uploadedSettingReferences: uploadedSettingReferences.map(({ image, ...ref }) => ref),
			generationState,
			timestamp: Date.now(),
		};

		// 保存文本数据到 localStorage
		localStorage.setItem(STORAGE_KEYS.PROJECT_DATA(projectId), JSON.stringify(textData));

		// 保存图片到 IndexedDB
		await projectImageStorage.init();

		// 保存角色图片
		for (const char of characterReferences) {
			if (char.image) {
				await projectImageStorage.storeImage(projectId, `char-${char.name}`, char.image);
			}
		}

		// 保存面板图片
		for (const panel of generatedPanels) {
			if (panel.image) {
				await projectImageStorage.storeImage(projectId, `panel-${panel.panelNumber}`, panel.image);
			}
		}

		// 保存上传的角色参考图片
		for (const ref of uploadedCharacterReferences) {
			if (ref.image) {
				await projectImageStorage.storeImage(projectId, `uploaded-char-${ref.id}`, ref.image);
			}
		}

		// 保存上传的场景参考图片
		for (const ref of uploadedSettingReferences) {
			if (ref.image) {
				await projectImageStorage.storeImage(projectId, `uploaded-setting-${ref.id}`, ref.image);
			}
		}

		// 更新项目元数据
		const thumbnail = generatedPanels.length > 0 ? generatedPanels[0].image : undefined;
		updateProjectMetadata(projectId, {
			thumbnail,
		});

		// 更新项目统计信息
		const projects = getProjectList();
		const projectIndex = projects.findIndex(p => p.metadata.id === projectId);
		if (projectIndex !== -1) {
			projects[projectIndex].metadata.panelCount = generatedPanels.length;
			projects[projectIndex].metadata.characterCount = characterReferences.length;
			projects[projectIndex].metadata.style = style;
			projects[projectIndex].metadata.updatedAt = Date.now();
			saveProjectList(projects);
		}

		console.log(`✅ Project ${projectId} saved successfully`);
	} catch (error) {
		console.error(`❌ Failed to save project ${projectId}:`, error);
		throw error;
	}
}

// 加载项目数据
export async function loadProjectData(projectId: string): Promise<ProjectData | null> {
	try {
		// 加载文本数据
		const storedData = localStorage.getItem(STORAGE_KEYS.PROJECT_DATA(projectId));
		if (!storedData) return null;

		const textData = JSON.parse(storedData);

		// 版本检查
		if (textData.version !== STORAGE_VERSION) {
			console.warn(`Project ${projectId} version mismatch, skipping load`);
			return null;
		}

		// 加载图片
		await projectImageStorage.init();

		// 恢复角色图片
		const characterReferences: CharacterReference[] = [];
		for (const char of textData.characterReferences) {
			try {
				const image = await projectImageStorage.getImage(projectId, `char-${char.name}`);
				if (image) {
					characterReferences.push({ ...char, image });
				}
			} catch (error) {
				console.warn(`Failed to load image for character ${char.name}:`, error);
			}
		}

		// 恢复面板图片
		const generatedPanels: GeneratedPanel[] = [];
		for (const panel of textData.generatedPanels) {
			try {
				const image = await projectImageStorage.getImage(projectId, `panel-${panel.panelNumber}`);
				if (image) {
					generatedPanels.push({ ...panel, image });
				}
			} catch (error) {
				console.warn(`Failed to load image for panel ${panel.panelNumber}:`, error);
			}
		}

		// 恢复上传的角色参考图片
		const uploadedCharacterReferences: UploadedCharacterReference[] = [];
		for (const ref of textData.uploadedCharacterReferences) {
			try {
				const image = await projectImageStorage.getImage(projectId, `uploaded-char-${ref.id}`);
				if (image) {
					uploadedCharacterReferences.push({ ...ref, image });
				}
			} catch (error) {
				console.warn(`Failed to load uploaded character reference ${ref.id}:`, error);
			}
		}

		// 恢复上传的场景参考图片
		const uploadedSettingReferences: UploadedSettingReference[] = [];
		for (const ref of textData.uploadedSettingReferences) {
			try {
				const image = await projectImageStorage.getImage(projectId, `uploaded-setting-${ref.id}`);
				if (image) {
					uploadedSettingReferences.push({ ...ref, image });
				}
			} catch (error) {
				console.warn(`Failed to load uploaded setting reference ${ref.id}:`, error);
			}
		}

		// 获取项目元数据
		const projects = getProjectList();
		const project = projects.find(p => p.metadata.id === projectId);
		if (!project) {
			throw new Error(`Project metadata not found for ${projectId}`);
		}

		return {
			metadata: project.metadata,
			story: textData.story,
			style: textData.style,
			imageSize: project.metadata.imageSize || DEFAULT_IMAGE_SIZE, // 向后兼容
			storyAnalysis: textData.storyAnalysis,
			storyBreakdown: textData.storyBreakdown,
			characterReferences,
			generatedPanels,
			uploadedCharacterReferences,
			uploadedSettingReferences,
			generationState: textData.generationState,
		};
	} catch (error) {
		console.error(`❌ Failed to load project ${projectId}:`, error);
		return null;
	}
}

// 删除项目
export async function deleteProject(projectId: string): Promise<void> {
	try {
		// 删除项目数据
		localStorage.removeItem(STORAGE_KEYS.PROJECT_DATA(projectId));

		// 删除项目图片
		await projectImageStorage.deleteProjectImages(projectId);

		// 从项目列表中移除
		const projects = getProjectList();
		const filteredProjects = projects.filter(p => p.metadata.id !== projectId);
		saveProjectList(filteredProjects);

		// 如果删除的是当前项目，清除当前项目设置
		if (getCurrentProjectId() === projectId) {
			localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT);
		}

		console.log(`✅ Project ${projectId} deleted successfully`);
	} catch (error) {
		console.error(`❌ Failed to delete project ${projectId}:`, error);
		throw error;
	}
}

// 清除所有项目数据
export async function clearAllProjects(): Promise<void> {
	try {
		// 清除项目列表
		localStorage.removeItem(STORAGE_KEYS.PROJECT_LIST);
		localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT);

		// 清除所有项目数据
		const keys = Object.keys(localStorage);
		for (const key of keys) {
			if (key.startsWith('manga-project-')) {
				localStorage.removeItem(key);
			}
		}

		// 清除所有图片
		await projectImageStorage.clear();

		console.log("✅ All projects cleared successfully");
	} catch (error) {
		console.error("❌ Failed to clear all projects:", error);
		throw error;
	}
}
