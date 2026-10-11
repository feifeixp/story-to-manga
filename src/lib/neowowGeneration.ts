import type {
	CharacterReference,
	StoryAnalysis,
	StoryBreakdown,
	UploadedCharacterReference,
	UploadedSettingReference,
} from "../types";
import {
	ANALYSIS_INSTRUCTION,
	BREAKDOWN_INSTRUCTION,
	characterPrompt,
	type PromptReference,
	panelEditPrompt,
	panelPrompt,
} from "./mangaPrompts";
import type { ApiClient } from "./studioWorkflow";
export interface GenerationDriver {
	plan: <T>(
		instruction: string,
		body: unknown,
		signal?: AbortSignal,
	) => Promise<T>;
	image: (
		prompt: string,
		model: string,
		ratio: string,
		refs: string[],
		signal: AbortSignal,
	) => Promise<string>;
}
export function parseJsonReply<T>(text: string): T {
	const cleaned = text
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "");
	const start = cleaned.indexOf("{");
	const end = cleaned.lastIndexOf("}");
	if (start < 0 || end < start)
		throw new Error("文本模型没有返回 JSON，请调整故事后重试。");
	try {
		return JSON.parse(cleaned.slice(start, end + 1)) as T;
	} catch {
		throw new Error("故事规划格式不完整，请减少分镜数量后重试。");
	}
}
export function validateAnalysis(analysis: StoryAnalysis): StoryAnalysis {
	const text = (value: unknown) =>
		typeof value === "string" && value.trim().length > 0;
	if (
		!analysis ||
		!text(analysis.title) ||
		!Array.isArray(analysis.characters) ||
		!analysis.setting ||
		!Array.isArray(analysis.scenes) ||
		analysis.characters.some(
			(c) =>
				!text(c.name) ||
				!text(c.physicalDescription) ||
				typeof c.personality !== "string" ||
				typeof c.role !== "string",
		) ||
		!text(analysis.setting.location) ||
		typeof analysis.setting.timePeriod !== "string" ||
		typeof analysis.setting.mood !== "string" ||
		analysis.scenes.some(
			(s) =>
				!text(s.id) ||
				!text(s.description) ||
				!text(s.name) ||
				typeof s.location !== "string" ||
				typeof s.mood !== "string" ||
				!Array.isArray(s.visualElements) ||
				s.visualElements.some((v) => typeof v !== "string"),
		)
	)
		throw new Error("角色或场景信息不完整，请重新拆解故事。");
	return analysis;
}
interface ImageBody {
	composition?: "single" | "japanese";
	recompose?: boolean;
	imageId?: number;
	style?: string;
	language?: string;
	aiModel?: string;
	imageSize?: { aspectRatio: string };
	characters?: StoryAnalysis["characters"];
	setting?: StoryAnalysis["setting"];
	scenes?: StoryAnalysis["scenes"];
	characterReferences?: CharacterReference[];
	uploadedCharacterReferences?: UploadedCharacterReference[];
	uploadedSettingReferences?: UploadedSettingReference[];
	panel?: StoryBreakdown["panels"][number];
	originalPrompt?: string;
	originalImage?: string;
	modificationPrompt?: string;
	referenceImages?: string[];
}
export function createNeoWoWApi(driver: GenerationDriver): ApiClient {
	const plan = driver.plan;
	const generateImage = driver.image;
	return async <T>(
		path: string,
		raw: unknown,
		external?: AbortSignal,
	): Promise<T> => {
		const signal = external
			? AbortSignal.any([external, AbortSignal.timeout(660_000)])
			: AbortSignal.timeout(660_000);
		if (path === "/api/analyze-story") {
			const result = await plan<{ analysis: StoryAnalysis }>(
				ANALYSIS_INSTRUCTION,
				raw,
				signal,
			);
			return { analysis: validateAnalysis(result.analysis) } as T;
		}
		if (path === "/api/chunk-story")
			return await plan<T>(BREAKDOWN_INSTRUCTION, raw, signal);
		const body = raw as ImageBody;
		const draw = (
			prompt: string,
			refs: string[],
			ratio = body.imageSize?.aspectRatio || "1:1",
		) =>
			generateImage(
				`${prompt}\nCompose for the page-defined ${ratio} frame. Keep essential subjects and lettering within the central 80% safe area.`,
				body.aiModel || "auto",
				ratio,
				[...new Set(refs)],
				signal,
			);
		if (path === "/api/generate-character-refs") {
			const references: CharacterReference[] = [];
			for (const c of body.characters || []) {
				const ref =
					body.uploadedCharacterReferences
						?.filter((r) => r.name === c.name)
						.map((r) => r.image) || [];
				references.push({
					name: c.name,
					description: c.physicalDescription,
					image: await draw(characterPrompt(c, body.style, body.language), ref),
				});
			}
			return { characterReferences: references } as T;
		}
		if (path === "/api/generate-panel" && body.panel) {
			const panel = body.panel;
			const mapped: PromptReference[] = [
				...(body.characterReferences || [])
					.filter((r) => panel.characters.includes(r.name))
					.map((r) => ({
						image: r.image,
						label: `Character identity: ${r.name}`,
					})),
				...(body.uploadedSettingReferences || []).map((r) => ({
					image: r.image,
					label: `Environment: ${r.name}`,
				})),
			];
			const refs: PromptReference[] = [];
			for (const ref of mapped) {
				const existing = refs.find((r) => r.image === ref.image);
				if (existing) existing.label += `; ${ref.label}`;
				else refs.push({ ...ref });
			}
			const scene = body.scenes?.find((s) => s.id === panel.sceneId);
			return {
				generatedPanel: {
					panelNumber: panel.panelNumber,
					composition: body.composition === "japanese" ? "japanese" : "single",
					image: await draw(
						panelPrompt({
							panel,
							composition: body.composition,
							aspectRatio: body.imageSize?.aspectRatio,
							setting: body.setting,
							scene,
							characters: body.characterReferences,
							references: refs,
							style: body.style,
							language: body.language,
						}),
						refs.map((r) => r.image),
					),
				},
			} as T;
		}
		if (path === "/api/redraw-image" || path === "/api/modify-image") {
			const refs = [
				...(body.originalImage ? [body.originalImage] : []),
				...(body.referenceImages || []),
			];
			return {
				imageData: await draw(
					panelEditPrompt({
						...body,
						aspectRatio: body.imageSize?.aspectRatio,
						panelNumber: body.imageId,
					}),
					refs,
				),
			} as T;
		}
		throw new Error(`此版本不支持此接口：${path}`);
	};
}
