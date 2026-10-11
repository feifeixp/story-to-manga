import { type NextRequest, NextResponse } from "next/server";
import {
	characterGenLogger,
	logApiRequest,
	logApiResponse,
	logError,
} from "@/lib/logger";
import { characterPrompt } from "@/lib/mangaPrompts";
import { cacheHelpers } from "@/lib/cacheManager";
import { getAIModelRouter, selectAIModel, type AIModel } from "@/lib/aiModelRouter";
import type { CharacterReference, ComicStyle } from "@/types";

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const endpoint = "/api/generate-character-refs";

	logApiRequest(characterGenLogger, endpoint, "POST");

	try {
		const body = await request.json();
		const { characters, setting, style, uploadedCharacterReferences, uploadedCharacterRefs = [], aiModel = "auto", language = "en" } = body;

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

		const uploads: { name?: string; characterName?: string; image: string }[] = uploadedCharacterReferences || uploadedCharacterRefs;
		const cacheContext = JSON.stringify({ setting, language, aiModel, uploads, sheetVersion: 1 });
		// Version the prompt contract so old portrait cache entries cannot become sheets.
		const cachedRefs = cacheHelpers.getCachedCharacterRef(characters, cacheContext, style);
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

		const characterReferences: CharacterReference[] = [];

		for (const character of characters) {
			const characterStartTime = Date.now();

			characterGenLogger.debug({
				character_name: character.name,
				style,
				language,
				selected_model: selectedModel,
			}, "Generating character reference");

			try {
				const prompt = characterPrompt(character, style, language);
				const matchingUploads = uploads.filter((ref) => (ref.name || ref.characterName) === character.name);

				characterGenLogger.info({
					character_name: character.name,
					prompt_length: prompt.length,
					style: style,
					language: language,
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
					{ width: 1536, height: 1024, aspectRatio: "3:2", volcEngineSize: "2K" },
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
						...(character.design ? { design: character.design } : {}),
						sheetVersion: 1,
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
			cacheHelpers.cacheCharacterRef(characters, cacheContext, style, characterReferences);
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
