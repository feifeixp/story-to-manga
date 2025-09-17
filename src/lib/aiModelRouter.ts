import { GoogleGenerativeAI } from "@google/generative-ai";
import {
	type GenerateImageRequest,
	getVolcEngineClient,
	type VolcEngineResponse,
} from "./volcengine";
import type { ImageSizeConfig } from "@/types/project";
import type { ComicStyle } from "@/types";
import { getStylePrompt } from "./styleConfig";

// AI Model Types
export type AIModel = "auto" | "nanobanana" | "volcengine";

// Language Detection
export function detectLanguage(text: string): "zh" | "en" {
	// Simple Chinese character detection
	const chineseRegex = /[\u4e00-\u9fff]/;
	const chineseMatches = text.match(chineseRegex);

	if (chineseMatches && chineseMatches.length > 0) {
		// If more than 10% of characters are Chinese, consider it Chinese
		const chineseRatio = chineseMatches.length / text.length;
		return chineseRatio > 0.1 ? "zh" : "en";
	}

	return "en";
}

// Model Selection Logic
export function selectAIModel(
	language: string,
	userPreference?: AIModel,
): AIModel {
	// If user has explicit preference, respect it (unless it's auto)
	if (userPreference && userPreference !== "auto") {
		return userPreference;
	}

	// Auto selection based on language
	if (language === "zh") {
		return "volcengine"; // VolcEngine has better Chinese support
	} else {
		return "nanobanana"; // nanobanana (Gemini Flash Image) has better English support
	}
}

// NanoBanana (Gemini Flash Image) API Handler
class NanoBananaHandler {
	private genAI: GoogleGenerativeAI;

	constructor(apiKey: string) {
		this.genAI = new GoogleGenerativeAI(apiKey);
	}

	async generateMangaPanel(
		prompt: string,
		characterRefs?: string[],
		settingRefs?: string[],
		language: "en" | "zh" = "en",
		imageSize?: ImageSizeConfig,
		style: ComicStyle = "manga",
	): Promise<any> {
		try {
			// Use Gemini 2.5 Flash Image model for generation
			const model = this.genAI.getGenerativeModel({
				model: "gemini-2.5-flash-image-preview"
			});

			// Enhance prompt based on language and style
			const stylePrefix = getStylePrompt(style, 'prefix', language);
			const enhancedPrompt = `${stylePrefix}。${prompt}`;

			// Prepare input parts
			const inputParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
				{ text: enhancedPrompt }
			];

			// Add reference images if provided
			const allRefs = [...(characterRefs || []), ...(settingRefs || [])];
			for (const ref of allRefs.slice(0, 4)) { // Limit to 4 images
				if (ref.startsWith('data:image/')) {
					// Extract base64 data
					const base64Data = ref.replace(/^data:image\/[^;]+;base64,/, "");
					inputParts.push({
						inlineData: {
							data: base64Data,
							mimeType: "image/jpeg",
						}
					});
				}
			}

			// 添加超时控制 (120秒超时)
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('NanoBanana API timeout after 120 seconds')), 120000);
			});

			const apiCallPromise = model.generateContent(inputParts);
			const result = await Promise.race([apiCallPromise, timeoutPromise]);
			const response = result.response;

			// Check if we got image data
			if (response.candidates && response.candidates[0]?.content?.parts) {
				for (const part of response.candidates[0].content.parts) {
					if (part.inlineData) {
						const imageData = part.inlineData.data;
						const mimeType = part.inlineData.mimeType || "image/jpeg";

						return {
							success: true,
							data: `data:${mimeType};base64,${imageData}`,
						};
					}
				}
			}

			// Check for safety issues and retry with safer prompt
			const candidate = response.candidates?.[0];
			if (candidate?.finishReason === 'IMAGE_SAFETY') {
				console.log("Image generation blocked by safety filter, trying with safer prompt");

				// Create a safer version of the prompt
				const safePrompt = prompt
					.replace(/[^\w\s,.-]/g, '') // Remove special characters
					.replace(/\b(kill|death|blood|war|fight|battle|demon|evil|dark|violence|weapon|sword|knife|gun)\b/gi, 'action') // Replace potentially problematic words
					.replace(/\b(Fang|Yuan)\b/gi, 'Hero'); // Replace specific character names that might trigger filters

				// Add style prefix to safe prompt
				const safeEnhancedPrompt = `${stylePrefix}。${safePrompt}`;

				console.log("Retrying with safety-filtered prompt");

				// Retry with safer prompt
				const safeInputParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
					{ text: safeEnhancedPrompt }
				];

				// Add reference images if provided
				if (characterRefs && characterRefs.length > 0) {
					for (const ref of characterRefs) {
						if (ref.startsWith('data:')) {
							const [header, data] = ref.split(',');
							const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
							safeInputParts.push({
								inlineData: {
									data: data,
									mimeType: mimeType
								}
							});
						}
					}
				}

				// 为安全重试也添加超时控制
				const safeTimeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('NanoBanana safety retry timeout after 120 seconds')), 120000);
				});

				const safeApiCallPromise = model.generateContent(safeInputParts);
				const safeResult = await Promise.race([safeApiCallPromise, safeTimeoutPromise]);
				const safeResponse = safeResult.response;

				// Check safe result
				if (safeResponse.candidates && safeResponse.candidates[0]?.content?.parts) {
					for (const part of safeResponse.candidates[0].content.parts) {
						if (part.inlineData) {
							const imageData = part.inlineData.data;
							const mimeType = part.inlineData.mimeType || "image/jpeg";

							console.log("Successfully generated image with safety retry");
							return {
								success: true,
								data: `data:${mimeType};base64,${imageData}`,
							};
						}
					}
				}
			}

			return {
				success: false,
				error: `No image data received from NanoBanana (Gemini Flash Image). Finish reason: ${candidate?.finishReason || 'unknown'}`,
				code: "NO_IMAGE_DATA",
			};

		} catch (error) {
			console.error("NanoBanana (Gemini Flash Image) API Error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				code: "API_ERROR",
			};
		}
	}
}

// VolcEngine Handler
class VolcEngineHandler {
	private client: any;

	constructor() {
		this.client = getVolcEngineClient();
	}

	async generateMangaPanel(
		prompt: string,
		characterRefs?: string[],
		settingRefs?: string[],
		language: "en" | "zh" = "en",
		imageSize?: ImageSizeConfig,
		style: ComicStyle = "manga",
	): Promise<VolcEngineResponse> {
		if (!this.client) {
			return {
				success: false,
				error: "VolcEngine client not configured",
				code: "CONFIG_ERROR",
			};
		}

		try {
			// Enhance prompt based on language and style consistency
			const stylePrefix = getStylePrompt(style, 'prefix', language);
			const enhancedPrompt = `${stylePrefix}。${prompt}`;

			// Prepare reference images for VolcEngine API (limit to 4 images)
			const imageRefs: string[] = [];

			// Add character reference images
			if (characterRefs && characterRefs.length > 0) {
				imageRefs.push(...characterRefs.slice(0, 2)); // Max 2 character refs
			}

			// Add setting reference images
			if (settingRefs && settingRefs.length > 0) {
				const remainingSlots = 4 - imageRefs.length;
				imageRefs.push(...settingRefs.slice(0, remainingSlots));
			}

			// Extract original URLs from image-proxy paths for VolcEngine
			const volcEngineImageRefs = imageRefs.map(img => {
				if (img.startsWith('/api/image-proxy?url=')) {
					// Extract the original URL from the image-proxy path
					const urlParam = img.split('url=')[1];
					if (urlParam) {
						return decodeURIComponent(urlParam);
					}
				}
				return img;
			});

			console.log(`VolcEngine using ${volcEngineImageRefs.length} reference images`)

			// 调试：检查图片格式
			volcEngineImageRefs.forEach((img, index) => {
				console.log(`Image ${index + 1} format:`, {
					isBase64: img.startsWith('data:image/'),
					isUrl: img.startsWith('http'),
					isVolcEngineUrl: img.includes('ark-content-generation'),
					preview: img.substring(0, 80) + '...'
				});
			});

			const request: GenerateImageRequest = {
				prompt: enhancedPrompt,
				...(volcEngineImageRefs.length > 0 && { image: volcEngineImageRefs }),
				sequential_image_generation: "auto",
				sequential_image_generation_options: {
					max_images: 1,
				},
				response_format: "url",
				size: imageSize?.volcEngineSize || "2K",
				stream: false,
				watermark: false,
			};

			// 添加超时控制 (120秒超时)
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error('VolcEngine API timeout after 120 seconds')), 120000);
			});

			const apiCallPromise = this.client.generateMangaPanel(request);
			const result = await Promise.race([apiCallPromise, timeoutPromise]);

			console.log("VolcEngine API Response:", JSON.stringify(result, null, 2));

			if (!result.success) {
				console.error("VolcEngine generation failed:", result.error, result.code);
				return {
					success: false,
					error: result.error || "VolcEngine generation failed",
					code: result.code || "GENERATION_FAILED",
				};
			}

			// Handle different response formats
			if (result.data) {
				console.log("VolcEngine response data structure:", {
					hasData: !!result.data.data,
					isArray: Array.isArray(result.data.data),
					arrayLength: Array.isArray(result.data.data) ? result.data.data.length : 0,
					firstItem: Array.isArray(result.data.data) && result.data.data.length > 0 ? result.data.data[0] : null
				});

				// Check for URL format response
				if (result.data.data && Array.isArray(result.data.data)) {
					const imageData = result.data.data[0];
					if (imageData && imageData.url) {
						console.log("VolcEngine returned URL:", imageData.url);
						// Create proxy URL to handle CORS and access issues
						const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageData.url)}`;
						return {
							success: true,
							data: proxyUrl,
						};
					}
				}
				// Check for base64 format response
				if (result.data.data && Array.isArray(result.data.data)) {
					const imageData = result.data.data[0];
					if (imageData && imageData.b64_json) {
						console.log("VolcEngine returned base64 data, length:", imageData.b64_json.length);
						// Convert base64 to data URL if it's not already
						const base64Data = imageData.b64_json.startsWith('data:') 
							? imageData.b64_json 
							: `data:image/jpeg;base64,${imageData.b64_json}`;
						return {
							success: true,
							data: base64Data,
						};
					}
				}
			}
			// If no valid image data found in expected format
			console.error("No valid image data in VolcEngine response. Full response:", result);
			return {
				success: false,
				error: "No valid image data in VolcEngine response",
				code: "INVALID_RESPONSE",
			};
		} catch (error) {
			console.error("VolcEngine API Error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				code: "API_ERROR",
			};
		}
	}
}

// Main AI Router Class
export class AIModelRouter {
	private nanoBananaHandler: NanoBananaHandler | null = null;
	private volcEngineHandler: VolcEngineHandler | null = null;

	constructor() {
		// Initialize NanoBanana (Gemini Flash Image) if API key is available
		const geminiApiKey = process.env["GOOGLE_AI_API_KEY"];
		if (geminiApiKey) {
			this.nanoBananaHandler = new NanoBananaHandler(geminiApiKey);
		}

		// Initialize VolcEngine
		this.volcEngineHandler = new VolcEngineHandler();
	}

	async generateMangaPanel(
		prompt: string,
		language: string,
		userPreference?: AIModel,
		characterRefs?: string[],
		settingRefs?: string[],
		style: ComicStyle = "manga",
	): Promise<any> {
		const selectedModel = selectAIModel(language, userPreference);

		console.log(`Using AI model: ${selectedModel} for language: ${language}`);

		try {
			if (selectedModel === "volcengine") {
				if (!this.volcEngineHandler) {
					throw new Error("VolcEngine handler not available");
				}
				return await this.volcEngineHandler.generateMangaPanel(
					prompt,
					characterRefs,
					settingRefs,
					language as "en" | "zh",
					undefined, // imageSize
					style,
				);
			} else if (selectedModel === "nanobanana") {
				if (!this.nanoBananaHandler) {
					throw new Error("NanoBanana handler not available");
				}
				return await this.nanoBananaHandler.generateMangaPanel(
					prompt,
					characterRefs,
					settingRefs,
					language as "en" | "zh",
					undefined, // imageSize - NanoBanana doesn't use imageSize yet
					style,
				);
			}
		} catch (error) {
			console.error(`AI Model Router Error (${selectedModel}):`, error);

			// Fallback logic: try the other model if the primary fails
			const fallbackModel =
				selectedModel === "volcengine" ? "nanobanana" : "volcengine";
			console.log(`Attempting fallback to ${fallbackModel}`);

			try {
				if (fallbackModel === "volcengine" && this.volcEngineHandler) {
					return await this.volcEngineHandler.generateMangaPanel(
						prompt,
						characterRefs,
						settingRefs,
						language as "en" | "zh",
						undefined, // imageSize
						style,
					);
				} else if (fallbackModel === "nanobanana" && this.nanoBananaHandler) {
					return await this.nanoBananaHandler.generateMangaPanel(
						prompt,
						characterRefs,
						settingRefs,
						language as "en" | "zh",
						undefined, // imageSize - NanoBanana doesn't use imageSize yet
						style,
					);
				}
			} catch (fallbackError) {
				console.error(`Fallback model also failed:`, fallbackError);
			}

			return {
				success: false,
				error: error instanceof Error ? error.message : "All AI models failed",
				code: "ALL_MODELS_FAILED",
			};
		}
	}

	async generateComicPanel(
		prompt: string,
		referenceImages: string[],
		language: "en" | "zh",
		userPreference?: AIModel,
		imageSize?: ImageSizeConfig,
		style: ComicStyle = "manga",
	): Promise<{
		success: boolean;
		imageData?: string;
		modelUsed?: string;
		error?: string;
	}> {
		const selectedModel = selectAIModel(language, userPreference);

		console.log(`Using AI model: ${selectedModel} for language: ${language}`);

		try {
			if (selectedModel === "volcengine") {
				if (!this.volcEngineHandler) {
					throw new Error("VolcEngine handler not available");
				}
				// 将referenceImages分为角色和设定参考图片
				const characterRefs = referenceImages.filter(img => img.includes('character') || referenceImages.indexOf(img) < referenceImages.length / 2);
				const settingRefs = referenceImages.filter(img => !characterRefs.includes(img));
				const result = await this.volcEngineHandler.generateMangaPanel(prompt, characterRefs, settingRefs, language, imageSize, style);
				return {
					success: result.success,
					modelUsed: "volcengine",
					imageData: result.success ? result.data : undefined,
					error: result.error || undefined,
				};
			} else if (selectedModel === "nanobanana") {
				if (!this.nanoBananaHandler) {
					throw new Error("NanoBanana handler not available");
				}
				// 将referenceImages分为角色和设定参考图片
				const characterRefs = referenceImages.filter(img => img.includes('character') || referenceImages.indexOf(img) < referenceImages.length / 2);
				const settingRefs = referenceImages.filter(img => !characterRefs.includes(img));
				const result = await this.nanoBananaHandler.generateMangaPanel(prompt, characterRefs, settingRefs, language, imageSize, style);
				return {
					success: result.success,
					modelUsed: "nanobanana",
					imageData: result.success ? result.data : undefined,
					error: result.error,
				};
			} else {
				// Auto fallback to available model
				console.log("Auto-selecting available model");
				if (this.nanoBananaHandler) {
					// 将referenceImages分为角色和设定参考图片
					const characterRefs = referenceImages.filter(img => img.includes('character') || referenceImages.indexOf(img) < referenceImages.length / 2);
					const settingRefs = referenceImages.filter(img => !characterRefs.includes(img));
					const result = await this.nanoBananaHandler.generateMangaPanel(prompt, characterRefs, settingRefs, language, imageSize, style);
					return {
						success: result.success,
						modelUsed: "nanobanana",
						imageData: result.success ? result.data : undefined,
						error: result.error,
					};
				} else if (this.volcEngineHandler) {
					// 将referenceImages分为角色和设定参考图片
					const characterRefs = referenceImages.filter(img => img.includes('character') || referenceImages.indexOf(img) < referenceImages.length / 2);
					const settingRefs = referenceImages.filter(img => !characterRefs.includes(img));
					const result = await this.volcEngineHandler.generateMangaPanel(prompt, characterRefs, settingRefs, language, imageSize, style);
					return {
						success: result.success,
						modelUsed: "volcengine",
						imageData: result.success ? result.data : undefined,
						error: result.error || undefined,
					};
				} else {
					return {
						success: false,
						error: "No image generation models available",
					};
				}
			}
		} catch (error) {
			console.error(`AI Model Router Error (${selectedModel}):`, error);

			// Try fallback model
			const fallbackModel = selectedModel === "volcengine" ? "nanobanana" : "volcengine";
			console.log(`Attempting fallback to ${fallbackModel}`);

			try {
				if (fallbackModel === "volcengine" && this.volcEngineHandler) {
					// 将referenceImages分为角色和设定参考图片
					const characterRefs = referenceImages.filter(img => img.includes('character') || referenceImages.indexOf(img) < referenceImages.length / 2);
					const settingRefs = referenceImages.filter(img => !characterRefs.includes(img));
					const result = await this.volcEngineHandler.generateMangaPanel(prompt, characterRefs, settingRefs, language, imageSize, style);
					return {
						success: result.success,
						modelUsed: "volcengine",
						imageData: result.success ? result.data : undefined,
						error: result.error || undefined,
					};
				} else if (fallbackModel === "nanobanana" && this.nanoBananaHandler) {
					// 将referenceImages分为角色和设定参考图片
					const characterRefs = referenceImages.filter(img => img.includes('character') || referenceImages.indexOf(img) < referenceImages.length / 2);
					const settingRefs = referenceImages.filter(img => !characterRefs.includes(img));
					const result = await this.nanoBananaHandler.generateMangaPanel(prompt, characterRefs, settingRefs, language, imageSize, style);
					return {
						success: result.success,
						modelUsed: "nanobanana",
						imageData: result.success ? result.data : undefined,
						error: result.error || undefined,
					};
				}
			} catch (fallbackError) {
				console.error(`Fallback model also failed:`, fallbackError);
			}

			return {
				success: false,
				error: error instanceof Error ? error.message : "Generation failed",
			};
		}
	}

	getAvailableModels(): AIModel[] {
		const models: AIModel[] = ["auto"];

		if (this.nanoBananaHandler) {
			models.push("nanobanana");
		}

		if (this.volcEngineHandler) {
			models.push("volcengine");
		}

		return models;
	}

	isModelAvailable(model: AIModel): boolean {
		switch (model) {
			case "auto":
				return true;
			case "nanobanana":
				return this.nanoBananaHandler !== null;
			case "volcengine":
				return this.volcEngineHandler !== null;
			default:
				return false;
		}
	}
}

// Export singleton instance
let aiRouter: AIModelRouter | null = null;

export function getAIModelRouter(): AIModelRouter {
	if (!aiRouter) {
		aiRouter = new AIModelRouter();
	}
	return aiRouter;
}
