// === Core Types ===

export type ComicStyle = "manga" | "comic" | "wuxia" | "healing" | "manhwa" | "cinematic" | "shojo" | "seinen" | "chibi" | "fantasy";

// === Domain Types ===

interface Character {
	name: string;
	physicalDescription: string;
	personality: string;
	role: string;
}

interface Setting {
	timePeriod: string;
	location: string;
	mood: string;
}

export interface Scene {
	id: string;
	name: string;
	description: string;
	location: string;
	timeOfDay?: string;
	mood: string;
	visualElements: string[];
}

export interface StoryAnalysis {
	title: string;
	characters: Character[];
	setting: Setting;
	scenes: Scene[];
}

export interface CharacterReference {
	name: string;
	image: string; // base64 data URL
	description: string;
}

export interface StoryBreakdown {
	panels: {
		panelNumber: number;
		characters: string[];
		sceneId: string; // 引用具体场景ID
		sceneDescription: string;
		dialogue?: string;
		cameraAngle: string;
		visualMood: string;
	}[];
}

export interface GeneratedPanel {
	panelNumber: number;
	image: string; // base64 data URL
}

// === Uploaded Reference Types ===

export interface UploadedCharacterReference {
	id: string; // unique identifier for the uploaded image
	name: string; // user-provided name/description for the character
	image: string; // base64 data URL
	fileName: string; // original file name
}

export interface UploadedSettingReference {
	id: string; // unique identifier for the uploaded image
	name: string; // user-provided name/description for the setting
	image: string; // base64 data URL
	fileName: string; // original file name
}
