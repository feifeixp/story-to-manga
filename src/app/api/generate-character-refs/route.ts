import { GoogleGenAI } from "@google/genai";
import { type NextRequest, NextResponse } from "next/server";
import {
	characterGenLogger,
	logApiRequest,
	logApiResponse,
	logError,
} from "@/lib/logger";
import { getStylePrompt } from "@/lib/styleConfig";
import { cacheHelpers } from "@/lib/cacheManager";
import type { ComicStyle } from "@/types";

const genAI = new GoogleGenAI({ apiKey: process.env["GOOGLE_AI_API_KEY"]! });
const geminiModel = "gemini-2.5-flash-image-preview";

// Helper function to convert base64 to format expected by Gemini
function prepareImageForGemini(base64Image: string) {
	// Remove data:image/xxx;base64, prefix if present
	const base64Data = base64Image.replace(/^data:image\/[^;]+;base64,/, "");
	return {
		inlineData: {
			data: base64Data,
			mimeType: "image/jpeg",
		},
	};
}

// Helper function to generate character using VolcEngine
async function generateCharacterWithVolcEngine(prompt: string, uploadedImages: string[] = []) {
	const volcEngineUrl = "https://visual-model-api.volcengineapi.com/api/v1/img2img_inpainting";

	const requestBody: any = {
		req_key: `character_${Date.now()}`,
		prompt: prompt,
		model_version: "general_v1.4",
		seed: -1,
		scale: 7.5,
		ddim_steps: 20,
		width: 512,
		height: 768, // Taller for character reference
		return_url: true,
		logo_info: {
			add_logo: false,
		},
	};

	// Add reference image if provided
	if (uploadedImages.length > 0 && uploadedImages[0]) {
		// Use first uploaded image as reference
		const base64Data = uploadedImages[0].replace(/^data:image\/[^;]+;base64,/, "");
		requestBody.image = base64Data;
	}

	const response = await fetch(volcEngineUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${process.env["VOLCENGINE_API_KEY"]}`,
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		throw new Error(`VolcEngine API error: ${response.status}`);
	}

	const result = await response.json();

	if (result.code !== 10000 || !result.data?.image_url) {
		throw new Error(`VolcEngine generation failed: ${result.message || 'Unknown error'}`);
	}

	// Download the image and convert to base64
	const imageResponse = await fetch(result.data.image_url);
	if (!imageResponse.ok) {
		throw new Error("Failed to download generated image");
	}

	const imageBuffer = await imageResponse.arrayBuffer();
	const base64Image = Buffer.from(imageBuffer).toString('base64');

	return `data:image/jpeg;base64,${base64Image}`;
}

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const endpoint = "/api/generate-character-refs";

	logApiRequest(characterGenLogger, endpoint);

	try {
		const {
			characters,
			setting,
			style,
			uploadedCharacterReferences = [],
			aiModel = 'nanobanana', // Default to nanobanana for backward compatibility
		} = await request.json();

		characterGenLogger.debug(
			{
				characters_count: characters?.length || 0,
				style,
				setting: !!setting,
				uploaded_refs_count: uploadedCharacterReferences?.length || 0,
			},
			"Received character reference generation request",
		);

		if (!characters || !setting || !style) {
			characterGenLogger.warn(
				{
					characters: !!characters,
					setting: !!setting,
					style: !!style,
				},
				"Missing required parameters",
			);
			logApiResponse(
				characterGenLogger,
				endpoint,
				false,
				Date.now() - startTime,
				{ error: "Missing parameters" },
			);
			return NextResponse.json(
				{ error: "Characters, setting, and style are required" },
				{ status: 400 },
			);
		}

		// 检查缓存
		const cachedResult = cacheHelpers.getCachedCharacterRef(characters, setting, style);
		if (cachedResult && Array.isArray(cachedResult)) {
			characterGenLogger.info("Returning cached character references");
			logApiResponse(
				characterGenLogger,
				endpoint,
				true,
				Date.now() - startTime,
				{ cached: true, characters_count: cachedResult.length },
			);
			return NextResponse.json({
				success: true,
				characterReferences: cachedResult,
				cached: true,
			});
		}

		const characterReferences = [];

		characterGenLogger.info(
			{
				model: aiModel,
				characters_to_generate: characters.length,
			},
			"Starting character reference generation",
		);

		for (const character of characters) {
			const characterStartTime = Date.now();
			characterGenLogger.debug(
				{ character_name: character.name },
				"Generating character reference",
			);
			// Get style-specific prompt using the new style configuration system
			const stylePrefix = getStylePrompt(style as ComicStyle, 'character', 'en');

			// Find uploaded references that match this character
			const matchingUploads = uploadedCharacterReferences.filter(
				(ref: { name: string; image: string; id: string; fileName: string }) =>
					ref.name.toLowerCase().includes(character.name.toLowerCase()) ||
					character.name.toLowerCase().includes(ref.name.toLowerCase()),
			);

			let prompt = `
Character reference sheet in ${stylePrefix}. 

Full body character design showing front view of ${character.name}:
- Physical appearance: ${character.physicalDescription}
- Personality: ${character.personality}
- Role: ${character.role}
- Setting context: ${setting.timePeriod}, ${setting.location}
`;

			// Add reference to uploaded images if any match
			if (matchingUploads.length > 0) {
				prompt += `

IMPORTANT: Use the provided reference images as inspiration for this character's design. The reference images show visual elements that should be incorporated while adapting them to the ${stylePrefix} aesthetic. Maintain the essence and key visual features shown in the references.
`;
			} else if (uploadedCharacterReferences.length > 0) {
				prompt += `

Note: Reference images are provided, but use them as general style inspiration for this character design.
`;
			}

			prompt += `

The character should be drawn in a neutral pose against a plain background, showing their full design clearly for reference purposes. This is a character reference sheet that will be used to maintain consistency across multiple comic panels.
`;

			// Prepare input parts for Gemini API
			const inputParts: Array<
				{ text: string } | { inlineData: { data: string; mimeType: string } }
			> = [{ text: prompt }];

			// Add uploaded reference images to input
			for (const upload of uploadedCharacterReferences as {
				name: string;
				image: string;
				id: string;
				fileName: string;
			}[]) {
				if (upload.image) {
					inputParts.push(prepareImageForGemini(upload.image));
				}
			}

			try {
				characterGenLogger.debug(
					{
						character_name: character.name,
						prompt_length: prompt.length,
						style_prefix: `${stylePrefix.substring(0, 50)}...`,
						matching_uploads: matchingUploads.length,
						total_uploads: uploadedCharacterReferences.length,
						input_parts_count: inputParts.length,
						ai_model: aiModel,
					},
					`Calling ${aiModel} API for character generation`,
				);

				let imageData: string;
				let mimeType = "image/jpeg";

				if (aiModel === 'volcengine') {
					// Use VolcEngine for character generation
					const uploadedImageUrls = uploadedCharacterReferences
						.filter((ref: any) => ref.image)
						.map((ref: any) => ref.image);

					imageData = await generateCharacterWithVolcEngine(prompt, uploadedImageUrls);

					characterReferences.push({
						name: character.name,
						image: imageData,
						description: character.physicalDescription,
					});

					characterGenLogger.info(
						{
							character_name: character.name,
							mime_type: mimeType,
							image_size_kb: imageData
								? Math.round((imageData.split(',')[1]?.length || 0) * 0.75 / 1024)
								: 0,
							duration_ms: Date.now() - characterStartTime,
							model_used: 'volcengine',
						},
						"Successfully generated character reference with VolcEngine",
					);
				} else {
					// Use Gemini (nanobanana) for character generation
					const result = await genAI.models.generateContent({
						model: geminiModel,
						contents: inputParts,
					});

					// Process the response following the official pattern
					const candidate = result.candidates?.[0];

					// Add detailed logging for debugging
					characterGenLogger.debug(
						{
							character_name: character.name,
							result_structure: {
								has_candidates: !!result.candidates,
								candidates_length: result.candidates?.length || 0,
								first_candidate: candidate ? {
									has_content: !!candidate.content,
									has_parts: !!candidate.content?.parts,
									parts_length: candidate.content?.parts?.length || 0,
									finish_reason: candidate.finishReason,
									safety_ratings: candidate.safetyRatings?.map(r => ({ category: r.category, probability: r.probability }))
								} : null
							}
						},
						"Gemini API response structure analysis"
					);

					if (!candidate?.content?.parts) {
						const errorDetails = {
							has_result: !!result,
							has_candidates: !!result.candidates,
							candidates_count: result.candidates?.length || 0,
							candidate_finish_reason: candidate?.finishReason,
							candidate_safety_ratings: candidate?.safetyRatings,
							full_result: JSON.stringify(result, null, 2)
						};

						characterGenLogger.error(
							{
								character_name: character.name,
								error_details: errorDetails
							},
							"No content parts received - detailed analysis"
						);

						throw new Error(`No content parts received for character ${character.name}. Finish reason: ${candidate?.finishReason || 'unknown'}`);
					}

					let imageFound = false;
					for (const part of candidate.content.parts) {
						if (part.text) {
							characterGenLogger.info(
								{
									character_name: character.name,
									text_response: part.text,
									text_length: part.text.length,
								},
								"Received text response from model (full content)",
							);
						} else if (part.inlineData) {
							const imageData = part.inlineData.data;
							const mimeType = part.inlineData.mimeType || "image/jpeg";

							characterReferences.push({
								name: character.name,
								image: `data:${mimeType};base64,${imageData}`,
								description: character.physicalDescription,
							});

							characterGenLogger.info(
								{
									character_name: character.name,
									mime_type: mimeType,
									image_size_kb: imageData
										? Math.round((imageData.length * 0.75) / 1024)
										: 0,
									duration_ms: Date.now() - characterStartTime,
									model_used: 'nanobanana',
								},
								"Successfully generated character reference with Gemini",
							);

							imageFound = true;
							break;
						}
					}

					if (!imageFound) {
						throw new Error("No image data received in response parts");
					}
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
