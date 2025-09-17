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
		const { story, characters, setting, style } = await request.json();

		storyChunkingLogger.debug(
			{
				story_length: story?.length || 0,
				characters_count: characters?.length || 0,
				style,
				setting: !!setting,
			},
			"Received story chunking request",
		);

		if (!story || !characters || !setting || !style) {
			storyChunkingLogger.warn(
				{
					story: !!story,
					characters: !!characters,
					setting: !!setting,
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
				{ error: "Story, characters, setting, and style are required" },
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

		const prompt = `
Break down this story into individual comic panels with detailed descriptions.

Story: "${story}"
Characters: ${characterNames}
Setting: ${setting.location}, ${setting.timePeriod}, ${setting.mood}
Style: ${style}

${layoutGuidance}

Create 2-50 panels based on the story's complexity and pacing needs. Choose the optimal number of panels to tell this story effectively - simple stories may need fewer panels (2-8), while complex narratives may require more (10-50). For very long stories, break them into logical segments and create detailed panel sequences.

For each panel, describe:
- Characters present
- Action/scene description
- Dialogue (if any)
- Camera angle (close-up, medium shot, wide shot, etc.)
- Visual mood/atmosphere

Return as a flat array of panels with sequential panel numbers.
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
