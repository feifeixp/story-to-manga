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
	CreateProjectParams,
	GenerationState,
	ImageSizeConfig,
	ProjectData,
	ProjectListItem,
	ProjectMetadata,
	ProjectStudioState,
	SaveProjectOptions,
	UpdateProjectParams,
} from "@/types/project";
import { DEFAULT_IMAGE_SIZE } from "@/types/project";

const STORAGE_KEYS = {
	PROJECT_LIST: "manga-projects-list",
	PROJECT_DATA: (id: string) => `manga-project-${id}`,
	CURRENT_PROJECT: "manga-current-project",
} as const;

// Keep compatibility with existing project data and IndexedDB records.
const STORAGE_VERSION = "2.0.0";
const DB_NAME = "MangaProjectsDB";
const DB_VERSION = 2;
const IMAGE_STORE = "project-images";

type StoredImage<T> = Omit<T, "image"> & {
	image?: string;
	imageKey?: string | null;
};
type StoredStudio = Omit<ProjectStudioState, "panelVersions"> & {
	panelVersions?: Record<string, StoredImage<GeneratedPanel>[]>;
};
interface StoredProject {
	version: string;
	story: string;
	style: ComicStyle;
	imageSize?: ImageSizeConfig;
	storyAnalysis: StoryAnalysis | null;
	storyBreakdown: StoryBreakdown | null;
	characterReferences: StoredImage<CharacterReference>[];
	generatedPanels: StoredImage<GeneratedPanel>[];
	uploadedCharacterReferences?: StoredImage<UploadedCharacterReference>[];
	uploadedSettingReferences?: StoredImage<UploadedSettingReference>[];
	generationState?: GenerationState;
	studio?: StoredStudio;
	timestamp: number;
}
interface ImageRecord {
	id: string;
	projectId: string;
	imageId: string;
	imageData: string;
	timestamp: number;
}

class ProjectImageStorage {
	private db: IDBDatabase | null = null;
	private opening: Promise<void> | null = null;

	async init(): Promise<void> {
		if (this.db) return;
		if (this.opening) return this.opening;
		this.opening = new Promise<void>((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				this.db = request.result;
				this.db.onversionchange = () => {
					this.db?.close();
					this.db = null;
				};
				resolve();
			};
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(IMAGE_STORE)) {
					db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
				}
			};
		});
		try {
			await this.opening;
		} finally {
			this.opening = null;
		}
	}

	private async write(action: (store: IDBObjectStore) => void): Promise<void> {
		await this.init();
		const db = this.db;
		if (!db) throw new Error("Database not initialized");
		return new Promise<void>((resolve, reject) => {
			const transaction = db.transaction([IMAGE_STORE], "readwrite");
			// A successful request can still be rolled back. Only report committed writes.
			transaction.oncomplete = () => resolve();
			transaction.onabort = () => reject(transaction.error || new Error("Image transaction aborted"));
			transaction.onerror = () => reject(transaction.error || new Error("Image transaction failed"));
			try {
				action(transaction.objectStore(IMAGE_STORE));
			} catch (error) {
				transaction.abort();
				reject(error);
			}
		});
	}

	async storeImages(records: ImageRecord[]): Promise<void> {
		if (!records.length) return;
		await this.write((store) => {
			for (const record of records) store.put(record);
		});
	}

	async getImage(projectId: string, imageId: string): Promise<string | null> {
		await this.init();
		const db = this.db;
		if (!db) throw new Error("Database not initialized");
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([IMAGE_STORE], "readonly");
			const request = transaction.objectStore(IMAGE_STORE).get(`${projectId}-${imageId}`);
			let image: string | null = null;
			request.onerror = () => reject(request.error);
			request.onsuccess = () => { image = request.result?.imageData ?? null; };
			transaction.oncomplete = () => resolve(image);
			transaction.onabort = () => reject(transaction.error || new Error("Image read transaction aborted"));
			transaction.onerror = () => reject(transaction.error || new Error("Image read transaction failed"));
		});
	}

	async deleteProjectImages(projectId: string, retain = new Set<string>()): Promise<void> {
		await this.write((store) => {
			const request = store.openCursor();
			request.onsuccess = () => {
				const cursor = request.result;
				if (!cursor) return;
				const record = cursor.value as ImageRecord;
				if (record.projectId === projectId && !retain.has(record.imageId)) cursor.delete();
				cursor.continue();
			};
		});
	}

	async clear(): Promise<void> {
		await this.write((store) => { store.clear(); });
	}
}

const projectImageStorage = new ProjectImageStorage();

// Serialize operations within this app instance and across cooperating tabs where Web Locks
// are supported. Reads share the lock so cleanup cannot remove a revision being restored.
// Without Web Locks, autosaves retain old image revisions rather than risking cross-tab loss.
let pendingOperations: Promise<void> = Promise.resolve();
function enqueueOperation<T>(action: (hasExclusiveLock: boolean) => Promise<T>): Promise<T> {
	const result = pendingOperations.then(async (): Promise<T> => {
		const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
		if (locks) return await locks.request("manga-project-storage", { mode: "exclusive" }, async () => await action(true));
		return await action(false);
	});
	pendingOperations = result.then(() => undefined, () => undefined);
	return result;
}

function generateProjectId(): string {
	return `project-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function blankProject(metadata: ProjectMetadata): StoredProject {
	return {
		version: STORAGE_VERSION,
		story: "",
		style: metadata.style,
		imageSize: metadata.imageSize || DEFAULT_IMAGE_SIZE,
		storyAnalysis: null,
		storyBreakdown: null,
		characterReferences: [],
		generatedPanels: [],
		uploadedCharacterReferences: [],
		uploadedSettingReferences: [],
		timestamp: metadata.updatedAt,
	};
}

export function getProjectList(): ProjectListItem[] {
	try {
		const storedData = localStorage.getItem(STORAGE_KEYS.PROJECT_LIST);
		if (!storedData) return [];
		const projects: ProjectListItem[] = JSON.parse(storedData);
		return projects.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
	} catch (error) {
		console.error("Failed to load project list:", error);
		return [];
	}
}

function saveProjectList(projects: ProjectListItem[]): void {
	localStorage.setItem(STORAGE_KEYS.PROJECT_LIST, JSON.stringify(projects));
}

export function createProject(params: CreateProjectParams): ProjectMetadata {
	const now = Date.now();
	const metadata: ProjectMetadata = {
		id: generateProjectId(),
		name: params.name,
		...(params.description && { description: params.description }),
		createdAt: now,
		updatedAt: now,
		panelCount: 0,
		characterCount: 0,
		style: params.style || "manga",
		imageSize: params.imageSize || DEFAULT_IMAGE_SIZE,
	};
	const previousList = getProjectList();
	// Persist a usable document before exposing the project in the list.
	localStorage.setItem(STORAGE_KEYS.PROJECT_DATA(metadata.id), JSON.stringify(blankProject(metadata)));
	try {
		saveProjectList([...previousList, { metadata }]);
		setCurrentProject(metadata.id);
	} catch (error) {
		localStorage.removeItem(STORAGE_KEYS.PROJECT_DATA(metadata.id));
		saveProjectList(previousList);
		throw error;
	}
	return metadata;
}

export function getCurrentProjectId(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT);
	} catch {
		return null;
	}
}

export function setCurrentProject(projectId: string): void {
	localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT, projectId);
}

export function updateProjectMetadata(projectId: string, updates: UpdateProjectParams): void {
	const projects = getProjectList();
	const project = projects.find((item) => item.metadata.id === projectId);
	if (!project) throw new Error(`Project ${projectId} not found`);
	project.metadata = { ...project.metadata, ...updates, updatedAt: Date.now() };
	saveProjectList(projects);
}

/** Saves a snapshot, including optional studio settings and editable project metadata. */
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
	options?: SaveProjectOptions,
): Promise<void> {
	// Capture nested inputs now, before a caller can edit them while this save is queued.
	const snapshot = JSON.parse(JSON.stringify({
		story, style, storyAnalysis, storyBreakdown, characterReferences, generatedPanels,
		uploadedCharacterReferences, uploadedSettingReferences, imageSize, generationState, options,
	})) as {
		story: string; style: ComicStyle; storyAnalysis: StoryAnalysis | null;
		storyBreakdown: StoryBreakdown | null; characterReferences: CharacterReference[];
		generatedPanels: GeneratedPanel[]; uploadedCharacterReferences: UploadedCharacterReference[];
		uploadedSettingReferences: UploadedSettingReference[]; imageSize?: ImageSizeConfig;
		generationState?: GenerationState; options?: SaveProjectOptions;
	};
	return enqueueOperation(async (hasExclusiveLock) => {
		const metadata = getProjectList().find((item) => item.metadata.id === projectId)?.metadata;
		if (!metadata) throw new Error(`Project ${projectId} not found`);
		const previousJSON = localStorage.getItem(STORAGE_KEYS.PROJECT_DATA(projectId));
		const previous = previousJSON ? JSON.parse(previousJSON) as StoredProject : blankProject(metadata);
		const revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const records: ImageRecord[] = [];
		const packImages = <T extends { image: string }>(items: T[], prefix: string): StoredImage<T>[] =>
			items.map(({ image, ...item }, index) => {
				const imageKey = image ? `${revision}-${prefix}-${index}` : null;
				if (imageKey) records.push({
					id: `${projectId}-${imageKey}`, projectId, imageId: imageKey,
					imageData: image, timestamp: Date.now(),
				});
				return { ...item, imageKey };
			});
		let studio = previous.studio;
		if (snapshot.options?.studio) {
			const { panelVersions, ...settings } = snapshot.options.studio;
			studio = { ...settings };
			if (panelVersions) {
				studio.panelVersions = Object.fromEntries(Object.entries(panelVersions).map(
					([panel, versions]) => [panel, packImages(versions, `version-${panel}`)],
				));
			}
		}
		const textData: StoredProject = {
			version: STORAGE_VERSION,
			story: snapshot.story,
			style: snapshot.style,
			imageSize: snapshot.imageSize || metadata.imageSize || previous.imageSize || DEFAULT_IMAGE_SIZE,
			storyAnalysis: snapshot.storyAnalysis,
			storyBreakdown: snapshot.storyBreakdown,
			characterReferences: packImages(snapshot.characterReferences, "char"),
			generatedPanels: packImages(snapshot.generatedPanels, "panel"),
			uploadedCharacterReferences: packImages(snapshot.uploadedCharacterReferences, "uploaded-char"),
			uploadedSettingReferences: packImages(snapshot.uploadedSettingReferences, "uploaded-setting"),
			...(snapshot.generationState && { generationState: snapshot.generationState }),
			...(studio && { studio }),
			timestamp: Date.now(),
		};
		// Copy-on-write keys keep the last saved project's images valid if either store fails.
		await projectImageStorage.storeImages(records);
		const projects = getProjectList();
		const project = projects.find((item) => item.metadata.id === projectId);
		if (!project) throw new Error(`Project ${projectId} not found`);
		const { thumbnail: _oldThumbnail, description, ...rest } = project.metadata;
		const editableMetadata = snapshot.options?.metadata || {
			name: rest.name,
			...(description !== undefined && { description }),
		};
		// Full image data belongs only in IndexedDB; duplicating it here can exhaust localStorage.
		const thumbnail = snapshot.generatedPanels.find((panel) => /^https?:\/\//i.test(panel.image))?.image;
		project.metadata = {
			...rest,
			name: editableMetadata.name,
			...(editableMetadata.description !== undefined && { description: editableMetadata.description }),
			...(thumbnail && { thumbnail }),
			panelCount: snapshot.generatedPanels.length,
			characterCount: snapshot.characterReferences.length,
			style: snapshot.style,
			imageSize: textData.imageSize || DEFAULT_IMAGE_SIZE,
			updatedAt: Date.now(),
		};
		try {
			localStorage.setItem(STORAGE_KEYS.PROJECT_DATA(projectId), JSON.stringify(textData));
			saveProjectList(projects);
		} catch (error) {
			// localStorage writes are individually atomic. Restore the document if its list update fails.
			if (previousJSON === null) localStorage.removeItem(STORAGE_KEYS.PROJECT_DATA(projectId));
			else localStorage.setItem(STORAGE_KEYS.PROJECT_DATA(projectId), previousJSON);
			throw error;
		}
		const retain = new Set<string>();
		JSON.stringify(textData, (key, value) => {
			if (key === "imageKey" && typeof value === "string") retain.add(value);
			return value;
		});
		// Cleanup is best effort after commit; a cleanup failure must not lose the saved project.
		if (hasExclusiveLock && (records.length || previous.generatedPanels?.length || previous.characterReferences?.length
			|| previous.uploadedCharacterReferences?.length || previous.uploadedSettingReferences?.length || previous.studio)) {
			try {
				await projectImageStorage.deleteProjectImages(projectId, retain);
			} catch (error) {
				console.warn(`Could not clean up old images for project ${projectId}:`, error);
			}
		}
	});
}

export async function loadProjectData(projectId: string): Promise<ProjectData | null> {
	return enqueueOperation(async () => {
		try {
			const project = getProjectList().find((item) => item.metadata.id === projectId);
			if (!project) return null;
			const storedData = localStorage.getItem(STORAGE_KEYS.PROJECT_DATA(projectId));
			// Missing data for a populated project is not a recoverable blank project.
			if (!storedData && (project.metadata.panelCount > 0 || project.metadata.characterCount > 0)) return null;
			// Recover projects created by the former metadata-only createProject implementation.
			const data: StoredProject = storedData ? JSON.parse(storedData) : blankProject(project.metadata);
			if (data.version !== STORAGE_VERSION) return null;
			const restoreImages = async <T extends { image: string }>(
				items: StoredImage<T>[], legacyKey: (item: StoredImage<T>) => string,
			): Promise<T[]> => Promise.all(items.map(async (item) => {
				const { imageKey, image: inlineImage, ...fields } = item;
				let image = inlineImage || "";
				if (imageKey !== null) {
					// A read error must fail the whole load. Returning an empty image could let an
					// autosave overwrite a recoverable image and garbage-collect the original.
					image = (await projectImageStorage.getImage(projectId, imageKey || legacyKey(item))) || image;
				}
				// Preserve the editable record when the image key is genuinely absent.
				return { ...fields, image } as unknown as T;
			}));
			const [characterReferences, generatedPanels, uploadedCharacterReferences, uploadedSettingReferences] = await Promise.all([
				restoreImages<CharacterReference>(data.characterReferences || [], (item) => `char-${item.name}`),
				restoreImages<GeneratedPanel>(data.generatedPanels || [], (item) => `panel-${item.panelNumber}`),
				restoreImages<UploadedCharacterReference>(data.uploadedCharacterReferences || [], (item) => `uploaded-char-${item.id}`),
				restoreImages<UploadedSettingReference>(data.uploadedSettingReferences || [], (item) => `uploaded-setting-${item.id}`),
			]);
			let studio: ProjectStudioState | undefined;
			if (data.studio) {
				const { panelVersions, ...settings } = data.studio;
				studio = { ...settings };
				if (panelVersions) {
					studio.panelVersions = Object.fromEntries(await Promise.all(Object.entries(panelVersions).map(
						async ([panel, versions]) => [panel, await restoreImages<GeneratedPanel>(versions, (item) => `panel-${item.panelNumber}`)],
					)));
				}
			}
			return {
				metadata: project.metadata,
				story: data.story,
				style: data.style,
				imageSize: project.metadata.imageSize || data.imageSize || DEFAULT_IMAGE_SIZE,
				storyAnalysis: data.storyAnalysis,
				storyBreakdown: data.storyBreakdown,
				characterReferences,
				generatedPanels,
				uploadedCharacterReferences,
				uploadedSettingReferences,
				...(data.generationState && { generationState: data.generationState }),
				...(studio && { studio }),
			};
		} catch (error) {
			console.error(`Failed to load project ${projectId}:`, error);
			return null;
		}
	});
}

export async function deleteProject(projectId: string): Promise<void> {
	return enqueueOperation(async () => {
		await projectImageStorage.deleteProjectImages(projectId);
		localStorage.removeItem(STORAGE_KEYS.PROJECT_DATA(projectId));
		saveProjectList(getProjectList().filter((item) => item.metadata.id !== projectId));
		if (getCurrentProjectId() === projectId) localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT);
	});
}

export async function clearAllProjects(): Promise<void> {
	return enqueueOperation(async () => {
		await projectImageStorage.clear();
		for (const key of Object.keys(localStorage)) {
			if (key.startsWith("manga-project-")) localStorage.removeItem(key);
		}
		localStorage.removeItem(STORAGE_KEYS.PROJECT_LIST);
		localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT);
	});
}
