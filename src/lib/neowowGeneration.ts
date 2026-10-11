import type {
	CharacterReference,
	StoryAnalysis,
	StoryBreakdown,
	UploadedCharacterReference,
	UploadedSettingReference,
} from "../types";
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
const styles: Record<string, string> = {
	healing: "gentle Japanese slice-of-life, soft pastel colors",
	manga: "Japanese black-and-white manga with screentone",
	wuxia: "Chinese ink painting wuxia",
	comic: "retro American comic",
	manhwa: "Korean webtoon",
	cinematic: "cinematic storytelling",
	shojo: "romantic shojo manga",
	seinen: "realistic seinen manga",
	chibi: "cute chibi",
	fantasy: "fantasy adventure comic",
};
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
				'Analyze the story. Return {"analysis":{"title":string,"characters":[{"name":string,"physicalDescription":string,"personality":string,"role":string}],"setting":{"timePeriod":string,"location":string,"mood":string},"scenes":[{"id":string,"name":string,"description":string,"location":string,"timeOfDay":string,"mood":string,"visualElements":string[]}]}}. Include clear character appearance for image generation. Use unique scene IDs.',
				raw,
				signal,
			);
			return { analysis: validateAnalysis(result.analysis) } as T;
		}
		if (path === "/api/chunk-story")
			return await plan<T>(
				'Create exactly panelCount comic panels (2–50), sequentially numbered from 1. Return {"storyBreakdown":{"panels":[{"panelNumber":integer,"characters":string[],"sceneId":string,"sceneDescription":string,"dialogue":string,"cameraAngle":string,"visualMood":string}]}}. Use only the supplied character names and scene IDs. Describe visible actions precisely. Keep dialogue short.',
				raw,
				signal,
			);
		const body = raw as ImageBody;
		const style = styles[body.style || "healing"] || "comic illustration";
		const base = `Comic artwork in ${style} style. Text language: ${body.language || "zh"}. Consistent character appearance. No watermark. Setting: ${JSON.stringify(body.setting || {})}.`;
		const draw = (
			prompt: string,
			refs: string[],
			ratio = body.imageSize?.aspectRatio || "1:1",
		) =>
			generateImage(
				`${base}\n${prompt}`,
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
					image: await draw(
						`Character reference sheet for ${c.name}: ${c.physicalDescription}. Personality: ${c.personality}. One character, full-body front view, plain background, no text.`,
						ref,
					),
				});
			}
			return { characterReferences: references } as T;
		}
		if (path === "/api/generate-panel" && body.panel) {
			const panel = body.panel;
			const refs = [
				...(body.characterReferences || [])
					.filter((r) => panel.characters.includes(r.name))
					.map((r) => r.image),
				...(body.uploadedSettingReferences || []).map((r) => r.image),
			];
			const scene = body.scenes?.find((s) => s.id === panel.sceneId);
			return {
				generatedPanel: {
					panelNumber: panel.panelNumber,
					image: await draw(
						`Draw exactly ONE comic panel, no collage. Scene: ${JSON.stringify(scene || {})}. Action: ${panel.sceneDescription}. Camera: ${panel.cameraAngle}. Mood: ${panel.visualMood}. Characters: ${panel.characters.join(", ")}. Dialogue in speech bubbles: ${panel.dialogue || "none"}. Match the provided character and scene reference images.`,
						refs,
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
					`ONE comic panel. ${body.originalPrompt || ""}. ${body.modificationPrompt ? `Edit the first reference image as follows: ${body.modificationPrompt}. Preserve everything else.` : "Redraw with the same story and consistent characters."}`,
					refs,
				),
			} as T;
		}
		throw new Error(`此版本不支持此接口：${path}`);
	};
}
