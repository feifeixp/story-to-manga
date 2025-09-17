import { type NextRequest, NextResponse } from "next/server";
import { getAIModelRouter, selectAIModel } from "@/lib/aiModelRouter";
import { getStylePrompt } from "@/lib/styleConfig";
import {
	logApiRequest,
	logApiResponse,
	logError,
	panelLogger,
} from "@/lib/logger";

// 使用panelLogger作为redrawLogger
const redrawLogger = panelLogger;

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const endpoint = "/api/redraw-image";
	let imageType: string;
	let imageId: string;

	logApiRequest(panelLogger, endpoint);

	try {
		const requestData = await request.json();
		const {
			imageType, // 'panel' or 'character'
			imageId, // panel number or character name
			originalPrompt,
			newPrompt, // optional, if user wants to modify the prompt
			referenceImages = [],
			language = "en",
			aiModel = "auto",
			imageSize, // 图片尺寸配置
			style = "manga", // 漫画风格
		} = requestData;

		panelLogger.debug(
			{
				image_type: imageType,
				image_id: imageId,
				has_new_prompt: !!newPrompt,
				original_prompt_length: originalPrompt?.length || 0,
				new_prompt_length: newPrompt?.length || 0,
				reference_images_count: referenceImages?.length || 0,
				ai_model: aiModel,
				language,
			},
			"Received image redraw request",
		);

		if (!imageType || !imageId || !originalPrompt) {
			return NextResponse.json(
				{ error: "Missing required parameters: imageType, imageId, or originalPrompt" },
				{ status: 400 },
			);
		}

		// 构建与生成panel API一致的提示词
		let finalPrompt: string;

		if (newPrompt) {
			// 如果用户提供了新的提示词，使用新提示词
			finalPrompt = newPrompt;
		} else {
			// 否则使用原始提示词
			finalPrompt = originalPrompt;
		}

		// 使用标准的风格配置，确保与生成panel API完全一致
		const stylePrefix = getStylePrompt(style as any, 'panel', language);

		// 为panel类型构建完整的提示词（与generate-panel API保持一致）
		if (imageType === 'panel') {
			finalPrompt = `
Create a single comic panel in ${stylePrefix}.

${finalPrompt}

IMPORTANT: Use the character reference images provided to maintain visual consistency. Each character should match their appearance from the reference images exactly.

The panel should include:
- Clear panel border
- Speech bubbles with dialogue text (if any) - IMPORTANT: If dialogue includes character attribution like "Character: 'text'", only put the spoken text in the speech bubble, NOT the character name
- Thought bubbles if needed
- Sound effects where appropriate
- Consistent character designs matching the references

Generate a single comic panel image with proper framing and composition.
`;
		}

		// 处理参考图片：将代理URL转换为实际图片数据
		console.log(`Processing ${referenceImages.length} reference images:`, referenceImages);
		const processedReferenceImages: string[] = [];
		for (const refImage of referenceImages) {
			try {
				console.log(`Processing reference image: ${refImage.substring(0, 100)}...`);
				if (refImage.startsWith('/api/image-proxy?url=')) {
					// 这是一个代理URL，需要获取实际的图片数据
					const actualUrl = decodeURIComponent(refImage.replace('/api/image-proxy?url=', ''));
					console.log(`Extracted actual URL: ${actualUrl.substring(0, 100)}...`);

					// 获取图片数据并转换为base64
					const response = await fetch(actualUrl);
					if (response.ok) {
						const buffer = await response.arrayBuffer();
						const base64 = Buffer.from(buffer).toString('base64');
						const mimeType = response.headers.get('content-type') || 'image/jpeg';
						const processedImage = `data:${mimeType};base64,${base64}`;
						processedReferenceImages.push(processedImage);
						console.log(`Successfully converted proxy URL to base64, size: ${base64.length} chars`);
					} else {
						console.warn(`Failed to fetch reference image: ${actualUrl}, status: ${response.status}`);
					}
				} else if (refImage.startsWith('data:')) {
					// 已经是base64格式，直接使用
					processedReferenceImages.push(refImage);
					console.log(`Using existing base64 image, size: ${refImage.length} chars`);
				} else if (refImage.startsWith('http')) {
					// 直接的URL，尝试获取并转换为base64
					try {
						console.log(`Fetching direct URL: ${refImage.substring(0, 100)}...`);
						const response = await fetch(refImage);
						if (response.ok) {
							const buffer = await response.arrayBuffer();
							const base64 = Buffer.from(buffer).toString('base64');
							const mimeType = response.headers.get('content-type') || 'image/jpeg';
							const processedImage = `data:${mimeType};base64,${base64}`;
							processedReferenceImages.push(processedImage);
							console.log(`Successfully converted direct URL to base64, size: ${base64.length} chars`);
						} else {
							console.warn(`Failed to fetch reference image: ${refImage}, status: ${response.status}`);
						}
					} catch (error) {
						console.warn(`Error fetching reference image ${refImage}:`, error);
					}
				} else {
					console.warn(`Unknown reference image format: ${refImage.substring(0, 100)}...`);
				}
			} catch (error) {
				console.warn(`Error processing reference image ${refImage}:`, error);
			}
		}
		console.log(`Processed ${processedReferenceImages.length} reference images successfully`);

		panelLogger.info(
			{
				image_type: imageType,
				image_id: imageId,
				prompt_length: finalPrompt.length,
				reference_images_count: referenceImages.length,
				processed_reference_images_count: processedReferenceImages.length,
				language: language,
			},
			"Calling AI Model Router for image redraw",
		);

		// Use AI model router to redraw the image with retry mechanism - 使用与generate-panel API相同的方法，添加重试机制
		const selectedModel = selectAIModel(language as "en" | "zh", aiModel as any);
		const aiRouter = getAIModelRouter();
		const maxRetries = 3;
		let lastError: Error | null = null;
		let result: any = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				redrawLogger.info(
					{ attempt, maxRetries, imageType },
					`Attempting AI model generation (attempt ${attempt}/${maxRetries})`
				);

				// 设置超时控制
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('Request timeout after 45 seconds')), 45000);
				});

				let generationPromise: Promise<any>;

				if (imageType === 'panel') {
					// 对于panel类型，使用与generate-panel API完全相同的调用方式
					generationPromise = aiRouter.generateComicPanel(
						finalPrompt,
						processedReferenceImages,
						language as "en" | "zh",
						selectedModel,
						imageSize
					);
				} else if (imageType === 'character') {
					// 对于character类型，也使用generateComicPanel方法
					generationPromise = aiRouter.generateComicPanel(
						finalPrompt,
						processedReferenceImages,
						language as "en" | "zh",
						selectedModel,
						imageSize
					);
				} else {
					throw new Error(`Unsupported image type: ${imageType}`);
				}

				result = await Promise.race([generationPromise, timeoutPromise]);

				redrawLogger.info(
					{ attempt, success: true, imageType },
					`AI model generation succeeded on attempt ${attempt}`
				);
				break; // 成功则跳出重试循环

			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				redrawLogger.warn(
					{
						attempt,
						maxRetries,
						imageType,
						error: lastError.message,
						willRetry: attempt < maxRetries
					},
					`AI model generation failed on attempt ${attempt}`
				);

				if (attempt < maxRetries) {
					// 等待一段时间后重试，使用指数退避
					const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
					redrawLogger.info(
						{ delay },
						`Waiting ${delay}ms before retry`
					);
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}
		}

		// 如果所有重试都失败了
		if (!result && lastError) {
			redrawLogger.error(
				{ error: lastError.message, imageType },
				"All AI model generation attempts failed for image redraw"
			);
			throw lastError;
		}

		if (!result.success || !result.imageData) {
			throw new Error(result.error || "Failed to redraw image");
		}

		// Validate imageData format
		const imageData = result.imageData;

		panelLogger.debug({
			image_type: imageType,
			image_id: imageId,
			imageData_type: typeof imageData,
			imageData_preview: typeof imageData === 'string' ? imageData.substring(0, 100) + '...' : imageData,
			imageData_length: typeof imageData === 'string' ? imageData.length : 'N/A'
		}, "Validating redraw image data format");

		if (!imageData || typeof imageData !== 'string') {
			throw new Error("Invalid image data format received from AI model");
		}

		panelLogger.info(
			{
				image_type: imageType,
				image_id: imageId,
				model_used: result.modelUsed,
				image_size_kb: result.imageData
					? Math.round((result.imageData.length * 0.75) / 1024)
					: 0,
				duration_ms: Date.now() - startTime,
			},
			"Successfully redrew image",
		);

		logApiResponse(panelLogger, endpoint, true, Date.now() - startTime, {
			image_type: imageType,
			image_id: imageId,
			model_used: result.modelUsed,
			image_size_kb: result.imageData
				? Math.round((result.imageData.length * 0.75) / 1024)
				: 0,
		});

		return NextResponse.json({
			success: true,
			imageData: result.imageData,
			modelUsed: result.modelUsed,
		});
	} catch (error) {
		logError(panelLogger, error, "image redraw", {
			image_type: imageType,
			image_id: imageId,
			duration_ms: Date.now() - startTime,
		});
		logApiResponse(panelLogger, endpoint, false, Date.now() - startTime, {
			error: "Image redraw failed",
			image_type: imageType,
			image_id: imageId,
		});

		// Handle specific error types
		if (
			error instanceof Error &&
			error.message.includes("PROHIBITED_CONTENT")
		) {
			return NextResponse.json(
				{
					error: "Content was blocked by safety filters",
					errorType: "PROHIBITED_CONTENT",
				},
				{ status: 400 },
			);
		}

		return NextResponse.json(
			{ error: `Failed to redraw ${imageType} ${imageId || "unknown"}` },
			{ status: 500 },
		);
	}
}
