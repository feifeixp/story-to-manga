import type {
	CharacterReference,
	ComicStyle,
	GeneratedPanel,
	StoryAnalysis,
	StoryBreakdown,
	UploadedCharacterReference,
	UploadedSettingReference,
} from "@/types";

// 图片尺寸配置
export interface ImageSizeConfig {
	width: number;
	height: number;
	aspectRatio: string; // 例如: "16:9", "4:3", "1:1", "9:16"
	volcEngineSize: "1K" | "2K" | "4K"; // VolcEngine API 支持的尺寸
}

// 项目元数据
export interface ProjectMetadata {
	id: string;
	name: string;
	description?: string;
	createdAt: number;
	updatedAt: number;
	thumbnail?: string; // 项目缩略图（第一个面板的图片）
	panelCount: number;
	characterCount: number;
	style: ComicStyle;
	imageSize: ImageSizeConfig; // 项目的图片尺寸配置
}

// 生成状态
export interface GenerationState {
	isGenerating: boolean;
	isPaused: boolean;
	currentPanel: number;
	totalPanels: number;
	completedPanels: number;
	failedPanels: number[];
	lastGeneratedAt?: number;
	batchInfo?: {
		currentBatch: number;
		totalBatches: number;
		batchSize: number;
	};
}

// 完整的项目数据
export interface ProjectData {
	metadata: ProjectMetadata;
	story: string;
	style: ComicStyle;
	imageSize: ImageSizeConfig; // 项目的图片尺寸配置
	storyAnalysis: StoryAnalysis | null;
	storyBreakdown: StoryBreakdown | null;
	characterReferences: CharacterReference[];
	generatedPanels: GeneratedPanel[];
	uploadedCharacterReferences: UploadedCharacterReference[];
	uploadedSettingReferences: UploadedSettingReference[];
	generationState?: GenerationState; // 生成状态
}

// 项目列表项（不包含完整数据，只有元数据）
export interface ProjectListItem {
	metadata: ProjectMetadata;
}

// 项目创建参数
export interface CreateProjectParams {
	name: string;
	description?: string;
	style?: ComicStyle;
	imageSize?: ImageSizeConfig;
}

// 项目更新参数
export interface UpdateProjectParams {
	name?: string;
	description?: string;
	thumbnail?: string;
	imageSize?: ImageSizeConfig;
}

// 预设的图片尺寸配置
export const IMAGE_SIZE_PRESETS: Record<string, ImageSizeConfig> = {
	"landscape_16_9": {
		width: 1920,
		height: 1080,
		aspectRatio: "16:9",
		volcEngineSize: "2K"
	},
	"landscape_4_3": {
		width: 1600,
		height: 1200,
		aspectRatio: "4:3",
		volcEngineSize: "2K"
	},
	"square_1_1": {
		width: 1024,
		height: 1024,
		aspectRatio: "1:1",
		volcEngineSize: "1K"
	},
	"portrait_9_16": {
		width: 1080,
		height: 1920,
		aspectRatio: "9:16",
		volcEngineSize: "2K"
	},
	"portrait_3_4": {
		width: 1200,
		height: 1600,
		aspectRatio: "3:4",
		volcEngineSize: "2K"
	},
	"ultra_wide_21_9": {
		width: 2560,
		height: 1080,
		aspectRatio: "21:9",
		volcEngineSize: "4K"
	}
};

// 默认图片尺寸配置
export const DEFAULT_IMAGE_SIZE: ImageSizeConfig = IMAGE_SIZE_PRESETS.landscape_16_9;
