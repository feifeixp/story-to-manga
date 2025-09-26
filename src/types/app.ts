// App-specific types for the manga/comic generation app

// 简化的项目数据类型
export interface UnifiedProjectData {
	metadata: {
		id: string;
		name: string;
		description?: string;
		style: string;
		createdAt: string;
		updatedAt: string;
	};
	content: {
		story: string;
		generatedPanels: any[];
		characterReferences: any[];
		settingReferences: any[];
		storyAnalysis?: any;
		imageSize?: any;
		generationState?: any;
	};
}

// Failed step types
export type FailedStep = "analysis" | "characters" | "layout" | "panels" | null;
export type FailedPanel = { step: "panel"; panelNumber: number } | null;

// Generation state management
export interface GenerationState {
	isGenerating: boolean;
	isPaused: boolean;
	currentPanel: number;
	totalPanels: number;
	completedPanels: number;
	failedPanels: number[];
	batchInfo?: {
		currentBatch: number;
		totalBatches: number;
		batchSize: number;
	};
}

// Image editing state
export interface EditingImage {
	type: 'panel' | 'character';
	id: string | number;
	image: string;
	originalPrompt: string;
	autoSelectedReferences?: Array<{
		id: string; 
		name: string; 
		image: string; 
		source: 'upload' | 'character'
	}>;
}

// Optimization statistics
export interface OptimizationStats {
	totalOriginalSize: number;
	totalOptimizedSize: number;
	totalSavings: number;
	optimizedCount: number;
}
