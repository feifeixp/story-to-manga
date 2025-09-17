import { GoogleGenAI, Type } from "@google/genai";
import { type NextRequest, NextResponse } from "next/server";
import { parseGeminiJSON } from "@/lib/json-parser";
import {
	logApiRequest,
	logApiResponse,
	logError,
	storyChunkingLogger,
} from "@/lib/logger";

interface Panel {
	panelNumber: number;
	characters: string[];
	sceneId: string; // 引用具体场景ID
	sceneDescription: string;
	dialogue: string;
	cameraAngle: string;
	visualMood: string;
}

interface StoryBreakdown {
	panels: Panel[];
}

const genAI = new GoogleGenAI({ apiKey: process.env["GOOGLE_AI_API_KEY"]! });
const model = "gemini-2.5-flash";

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const endpoint = "/api/chunk-story";

	logApiRequest(storyChunkingLogger, endpoint);

	try {
		const { story, characters, setting, scenes, style, language = "en" } = await request.json();

		storyChunkingLogger.debug(
			{
				story_length: story?.length || 0,
				characters_count: characters?.length || 0,
				scenes_count: scenes?.length || 0,
				style,
				setting: !!setting,
				language,
			},
			"Received story chunking request",
		);

		if (!story || !characters || !setting || !scenes || !style) {
			storyChunkingLogger.warn(
				{
					story: !!story,
					characters: !!characters,
					setting: !!setting,
					scenes: !!scenes,
					style: !!style,
				},
				"Missing required parameters",
			);
			logApiResponse(
				storyChunkingLogger,
				endpoint,
				false,
				Date.now() - startTime,
				{ error: "Missing parameters" },
			);
			return NextResponse.json(
				{ error: "Story, characters, setting, scenes, and style are required" },
				{ status: 400 },
			);
		}

		const characterNames = characters
			.map((c: { name: string }) => c.name)
			.join(", ");

		storyChunkingLogger.debug(
			{
				character_names: characterNames,
				layout_style: style,
			},
			"Extracted character names and determined layout style",
		);

		const getLayoutGuidance = (style: string) => {
			switch (style) {
				case "manga":
					return `
Manga panel guidelines:
- Dynamic panel shapes and sizes
- Vertical emphasis for dramatic moments
- Action lines and motion blur for movement
- Close-ups for emotional beats
- Wide shots for establishing scenes
- Dramatic angles and perspectives
`;
				case "comic":
					return `
American comic panel guidelines:
- Rectangular panels with consistent borders
- Wide establishing shots
- Medium shots for dialogue
- Close-ups for dramatic moments
- Clean, structured compositions
- Bold, clear visual storytelling
`;
				case "wuxia":
					return `
Wuxia cultivation panel guidelines:
- Flowing, organic panel shapes that follow natural elements
- Vertical panels for flying and ascending scenes
- Circular or curved panels for meditation and spiritual moments
- Wide landscape panels for mountain and nature scenes
- Close-ups with ethereal lighting effects
- Traditional scroll-like compositions
- Emphasis on movement and energy flow
`;
				case "healing":
					return `
Healing anime panel guidelines:
- Soft, rounded panel borders
- Warm, cozy framing for intimate moments
- Small panels for detailed emotional expressions
- Wide panels for peaceful daily life scenes
- Gentle transitions between panels
- Focus on character interactions and emotions
- Comfortable, non-threatening compositions
`;
				case "manhwa":
					return `
Korean manhwa panel guidelines:
- Clean, modern rectangular panels
- Vertical scrolling-friendly layouts
- Wide panels for urban landscapes
- Medium shots for character interactions
- Close-ups with detailed facial expressions
- Contemporary, stylish compositions
- Digital-native panel arrangements
`;
				case "cinematic":
					return `
Cinematic panel guidelines:
- Film-like aspect ratios (16:9, 2.35:1)
- Professional camera angles and shots
- Establishing shots, medium shots, close-ups sequence
- Dramatic lighting and composition
- Depth of field effects in panel design
- Movie storyboard-style layouts
- Professional cinematography principles
`;
				case "shojo":
					return `
Shojo manga panel guidelines:
- Tall, slender panels for elegant flow
- Decorative panel borders (lace, flowers, sparkles)
- Focus on close-ups of eyes and expressions
- Diagonal or floating layouts for romance
- Emphasis on emotional atmosphere over action
- Light, airy compositions with layered tones
`;
				case "seinen":
					return `
Seinen manga panel guidelines:
- Realistic proportions and structured panels
- Heavy shading and contrast
- Wide shots for urban/realistic settings
- Cinematic close-ups for psychological intensity
- Panel pacing reflects tension and realism
- Mature, grounded compositions
`;
				case "chibi":
					return `
Chibi panel guidelines:
- Small, rounded panels
- Exaggerated facial expressions and actions
- Minimalistic backgrounds
- Bold sound effects and motion cues
- Playful panel layouts (heart shapes, bubbles)
- Comedic timing in panel sequence
`;
				case "fantasy":
					return `
Fantasy epic panel guidelines:
- Large, sweeping landscape panels
- Vertical panels for towering castles/forests
- Dynamic diagonal layouts for battles
- Glow and aura effects in panel design
- Emphasis on scale and grandeur
- Heroic and mythical framing
`;
				default:
					return `
General comic panel guidelines:
- Clear panel borders and gutters
- Varied panel sizes for pacing
- Establishing shots to set scenes
- Close-ups for emotional moments
- Consistent visual flow
`;
			}
		};

		const layoutGuidance = getLayoutGuidance(style);

		// 构建场景信息字符串
		const sceneInfo = scenes.map((scene: any) =>
			`${scene.id}: ${scene.name} - ${scene.description} (Location: ${scene.location}, Time: ${scene.timeOfDay || 'unspecified'}, Mood: ${scene.mood}, Visual Elements: ${scene.visualElements.join(', ')})`
		).join('\n');

		// 根据语言构建提示词
		const prompt = language === 'zh' ? `
将这个故事分解为单独的漫画面板，并提供详细描述。

故事："${story}"
角色：${characterNames}
全局设定：${setting.location}，${setting.timePeriod}，氛围：${setting.mood}

可用场景：
${sceneInfo}

风格：${style}

${layoutGuidance}

根据故事的复杂性和节奏需要创建2-50个面板。选择最佳的面板数量来有效地讲述这个故事 - 简单的故事可能需要较少的面板（2-8个），而复杂的叙述可能需要更多（10-50个）。对于很长的故事，将其分解为逻辑段落并创建详细的面板序列。

重要：对于每个面板，您必须通过其ID（scene1、scene2等）引用可用场景之一，以确保视觉一致性。根据故事中动作发生的地点选择最合适的场景。

对于每个面板，请描述：
- 出现的角色
- 场景ID（必须匹配上述可用场景之一）
- 动作/场景描述（应与引用的场景一致）
- 对话（如果有）
- 镜头角度（特写、中景、远景等）
- 视觉氛围/气氛（应与场景的氛围相辅相成）

请用中文描述所有内容，并返回具有连续面板编号的平面面板数组。
` : `
Break down this story into individual comic panels with detailed descriptions.

Story: "${story}"
Characters: ${characterNames}
Global Setting: ${setting.location}, ${setting.timePeriod}, ${setting.mood}

Available Scenes:
${sceneInfo}

Style: ${style}

${layoutGuidance}

Create 2-50 panels based on the story's complexity and pacing needs. Choose the optimal number of panels to tell this story effectively - simple stories may need fewer panels (2-8), while complex narratives may require more (10-50). For very long stories, break them into logical segments and create detailed panel sequences.

IMPORTANT: For each panel, you MUST reference one of the available scenes by its ID (scene1, scene2, etc.) to ensure visual consistency. Choose the most appropriate scene based on where the action takes place in the story.

For each panel, describe:
- Characters present
- Scene ID (must match one of the available scenes above)
- Action/scene description (should be consistent with the referenced scene)
- Dialogue (if any)
- Camera angle (close-up, medium shot, wide shot, etc.)
- Visual mood/atmosphere (should complement the scene's mood)

Provide all content in English and return as a flat array of panels with sequential panel numbers.
`;

		storyChunkingLogger.info(
			{
				model: model,
				prompt_length: prompt.length,
				layout_guidance_type: style,
			},
			"Calling Gemini API for story chunking",
		);

		const result = await genAI.models.generateContent({
			model: model,
			contents: prompt,
			config: {
				thinkingConfig: {
					thinkingBudget: 8192, // Give model time to think through panel layout
				},
				responseMimeType: "application/json",
				responseSchema: {
					type: Type.OBJECT,
					properties: {
						panels: {
							type: Type.ARRAY,
							items: {
								type: Type.OBJECT,
								properties: {
									panelNumber: {
										type: Type.NUMBER,
									},
									characters: {
										type: Type.ARRAY,
										items: {
											type: Type.STRING,
										},
									},
									sceneId: {
										type: Type.STRING,
									},
									sceneDescription: {
										type: Type.STRING,
									},
									dialogue: {
										type: Type.STRING,
									},
									cameraAngle: {
										type: Type.STRING,
									},
									visualMood: {
										type: Type.STRING,
									},
								},
								propertyOrdering: [
									"panelNumber",
									"characters",
									"sceneId",
									"sceneDescription",
									"dialogue",
									"cameraAngle",
									"visualMood",
								],
							},
						},
					},
					propertyOrdering: ["panels"],
				},
			},
		});
		const text = result.text || "";

		storyChunkingLogger.debug(
			{
				response_length: text.length,
			},
			"Received response from Gemini API",
		);

		// Parse JSON response
		let storyBreakdown: StoryBreakdown;
		try {
			storyBreakdown = parseGeminiJSON<StoryBreakdown>(text);
			storyChunkingLogger.info(
				{
					total_panels: storyBreakdown.panels.length,
				},
				"Successfully parsed story breakdown",
			);
		} catch (parseError) {
			logError(storyChunkingLogger, parseError, "JSON parsing", {
				response_text: text?.substring(0, 1000),
			});
			logApiResponse(
				storyChunkingLogger,
				endpoint,
				false,
				Date.now() - startTime,
				{ error: "JSON parsing failed" },
			);
			return NextResponse.json(
				{ error: "Failed to parse story breakdown" },
				{ status: 500 },
			);
		}

		logApiResponse(
			storyChunkingLogger,
			endpoint,
			true,
			Date.now() - startTime,
			{
				panels_generated: storyBreakdown.panels.length,
			},
		);

		return NextResponse.json({
			success: true,
			storyBreakdown,
		});
	} catch (error) {
		logError(storyChunkingLogger, error, "story chunking");
		logApiResponse(
			storyChunkingLogger,
			endpoint,
			false,
			Date.now() - startTime,
			{ error: "Unexpected error" },
		);
		return NextResponse.json(
			{ error: "Failed to chunk story" },
			{ status: 500 },
		);
	}
}
