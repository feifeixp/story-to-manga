import { type NextRequest, NextResponse } from "next/server";
import {
	characterGenLogger,
	logApiRequest,
	logApiResponse,
	logError,
} from "@/lib/logger";
import { getStylePrompt } from "@/lib/styleConfig";
import { cacheHelpers } from "@/lib/cacheManager";
import { getAIModelRouter, selectAIModel, type AIModel } from "@/lib/aiModelRouter";
import type { ComicStyle } from "@/types";

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const endpoint = "/api/generate-character-refs";

	logApiRequest(characterGenLogger, endpoint, "POST");

	try {
		const body = await request.json();
		const { characters, setting, style, uploadedCharacterRefs = [], aiModel = "auto", language = "en" } = body;

		characterGenLogger.debug({
			characters_count: characters?.length || 0,
			style,
			setting: !!setting,
			uploaded_refs_count: uploadedCharacterRefs?.length || 0,
			ai_model: aiModel,
			language,
		}, "Received character reference generation request");

		if (!characters || !Array.isArray(characters) || characters.length === 0) {
			return NextResponse.json(
				{ success: false, error: "No characters provided" },
				{ status: 400 }
			);
		}

		// Check cache first
		const cachedRefs = cacheHelpers.getCachedCharacterRef(characters, setting, style);
		if (cachedRefs) {
			characterGenLogger.info("Returning cached character references");
			return NextResponse.json({
				success: true,
				characterReferences: cachedRefs,
			});
		}

		// Select the appropriate AI model based on user language
		const selectedModel = selectAIModel(language, aiModel as AIModel);
		const aiRouter = getAIModelRouter();

		characterGenLogger.info({
			model: aiModel,
			selected_model: selectedModel,
			characters_to_generate: characters.length,
		}, "Starting character reference generation");

		const characterReferences: Array<{
			name: string;
			image: string;
			description: string;
		}> = [];

		const stylePrefix = getStylePrompt(style as ComicStyle, 'character', language as "en" | "zh");

		// 详细日志记录风格和语言信息
		characterGenLogger.info({
			style,
			language,
			selected_model: selectedModel,
			style_prefix_preview: stylePrefix.substring(0, 100) + "...",
			characters_count: characters.length,
		}, "Starting character generation with style and language settings");

		for (const character of characters) {
			const characterStartTime = Date.now();

			characterGenLogger.debug({
				character_name: character.name,
				style,
				language,
				selected_model: selectedModel,
			}, "Generating character reference");

			try {
				// Create prompt for character generation
				const prompt = `Character reference sheet: ${stylePrefix}. Create a character design for ${character.name}. Focus on: ${character.physicalDescription}. Character personality: ${character.personality}. Role: ${character.role}. Setting: ${setting.timePeriod} in ${setting.location}. Mood: ${setting.mood}. Full body character reference sheet with multiple angles and expressions.`;

				// Find matching uploaded images for this character
				const matchingUploads = uploadedCharacterRefs.filter((ref: any) => 
					ref.characterName === character.name
				);

				characterGenLogger.info({
					character_name: character.name,
					prompt_length: prompt.length,
					style: style,
					language: language,
					style_prefix: stylePrefix.substring(0, 100) + "...",
					matching_uploads: matchingUploads.length,
					total_uploads: uploadedCharacterRefs.length,
					selected_model: selectedModel,
					full_prompt_preview: prompt.substring(0, 200) + "...",
				}, `Calling ${selectedModel} API for character generation`);

				// Use AI Model Router for character generation
				const referenceImages = matchingUploads
					.filter((ref: any) => ref.image)
					.map((ref: any) => ref.image);

				const result = await aiRouter.generateComicPanel(
					prompt,
					referenceImages,
					language as "en" | "zh", // 使用传入的语言参数
					selectedModel,
					undefined, // imageSize
					style as ComicStyle // 传递风格参数
				);

				if (result.success && result.imageData) {
					const imageSizeKB = result.imageData
						? Math.round((result.imageData.split(',')[1]?.length || 0) * 0.75 / 1024)
						: 0;

					characterReferences.push({
						name: character.name,
						image: result.imageData,
						description: character.physicalDescription,
					});

					characterGenLogger.info({
						character_name: character.name,
						mime_type: "image/jpeg",
						image_size_kb: imageSizeKB,
						duration_ms: Date.now() - characterStartTime,
						model_used: result.modelUsed,
					}, `Successfully generated character reference with ${result.modelUsed}`);
				} else {
					// Handle generation failure
					const errorMessage = result.error || "Character generation failed";
					characterGenLogger.error({
						character_name: character.name,
						error: errorMessage,
						model_used: result.modelUsed,
					}, "Character generation failed");

					throw new Error(errorMessage);
				}
			} catch (error) {
				logError(characterGenLogger, error, "character reference generation", {
					character_name: character.name,
					duration_ms: Date.now() - characterStartTime,
				});
				logApiResponse(
					characterGenLogger,
					endpoint,
					false,
					Date.now() - startTime,
					{
						error: "Character generation failed",
						failed_character: character.name,
					},
				);
				return NextResponse.json(
					{ error: `Failed to generate reference for ${character.name}` },
					{ status: 500 },
				);
			}
		}

		// 缓存生成结果
		if (characterReferences.length > 0) {
			cacheHelpers.cacheCharacterRef(characters, setting, style, characterReferences);
			characterGenLogger.info("Cached character references for future use");
		}

		logApiResponse(characterGenLogger, endpoint, true, Date.now() - startTime, {
			characters_generated: characterReferences.length,
			total_image_size_kb: characterReferences.reduce((sum, ref) => {
				const base64 = ref.image.split(",")[1] || "";
				return sum + Math.round((base64.length * 0.75) / 1024);
			}, 0),
		});

		return NextResponse.json({
			success: true,
			characterReferences,
		});
	} catch (error) {
		logError(characterGenLogger, error, "character reference generation");
		logApiResponse(
			characterGenLogger,
			endpoint,
			false,
			Date.now() - startTime,
			{ error: "Unexpected error" },
		);
		return NextResponse.json(
			{ error: "Failed to generate character references" },
			{ status: 500 },
		);
	}
}
