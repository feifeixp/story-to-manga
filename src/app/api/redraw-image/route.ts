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

// 清理提示词中的对话，移除角色名字以避免在图片中显示文字
function cleanDialogueInPrompt(prompt: string): string {
	// 匹配各种对话格式并清理角色名字
	return prompt
		// 匹配 "角色名: '对话内容'" 或 "角色名: "对话内容""
		.replace(/([^:\n]+):\s*['"]([^'"]+)['"]/g, '"$2"')
		// 匹配 "Dialogue: "角色名: '对话内容'""
		.replace(/Dialogue:\s*"([^:]+):\s*['"]([^'"]+)['"]"/g, 'Dialogue: "$2"')
		// 匹配 "Dialogue: 角色名: '对话内容'"
		.replace(/Dialogue:\s*([^:]+):\s*['"]([^'"]+)['"]/g, 'Dialogue: "$2"')
		// 匹配中文冒号格式 "角色名：'对话内容'"
		.replace(/([^：\n]+)：\s*['"]([^'"]+)['"]/g, '"$2"')
		// 清理多余的空格
		.replace(/\s+/g, ' ')
		.trim();
}

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const endpoint = "/api/redraw-image";
	const requestId = Math.random().toString(36).substring(2, 15);
	let imageType: string = "";
	let imageId: string = "";

	redrawLogger.info({ requestId }, "🎨 Starting image redraw request");
	logApiRequest(panelLogger, endpoint);

	try {
		const requestData = await request.json();
		const {
			imageType: requestImageType, // 'panel' or 'character'
			imageId: requestImageId, // panel number or character name
			originalPrompt,
			newPrompt, // optional, if user wants to modify the prompt
			referenceImages = [],
			language = "en",
			aiModel = "auto",
			imageSize, // 图片尺寸配置
			style = "manga", // 漫画风格
		} = requestData;

		imageType = requestImageType;
		imageId = requestImageId;

		redrawLogger.info(
			{
				requestId,
				image_type: imageType,
				image_id: imageId,
				has_new_prompt: !!newPrompt,
				original_prompt_length: originalPrompt?.length || 0,
				new_prompt_length: newPrompt?.length || 0,
				reference_images_count: referenceImages?.length || 0,
				ai_model: aiModel,
				language,
				style,
			},
			"📝 Processing image redraw request",
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

		// 清理提示词中的角色名字，避免在图片中显示文字
		finalPrompt = cleanDialogueInPrompt(finalPrompt);

		// 使用promptPrefix而不是panelPrompt，确保风格一致性
		const stylePrefix = getStylePrompt(style as any, 'prefix', language);

		redrawLogger.info(
			{
				requestId,
				style,
				language,
				style_prefix_preview: stylePrefix.substring(0, 100) + "...",
				original_prompt_preview: originalPrompt.substring(0, 200) + "...",
				final_prompt_preview: finalPrompt.substring(0, 200) + "...",
			},
			"🎨 Generated style prefix for redraw",
		);

		// 为panel类型构建完整的提示词，避免"漫画面板"导致的黑白色问题
		if (imageType === 'panel') {
			const panelInstructions = language === 'zh'
				? `创建一个图像，风格：${stylePrefix}。

${finalPrompt}

重要：使用提供的角色参考图片保持视觉一致性。每个角色都应该与参考图片中的外观完全匹配。

面板应包含：
- 清晰的面板边框
- 对话气泡和对话文字（如有）- 重要：如果对话包含角色归属如"角色：'文字'"，只在对话气泡中放入说话内容，不要放角色名字
- 思考气泡（如需要）
- 适当的音效
- 与参考图片匹配的一致角色设计

生成一个具有适当构图和框架的单个面板图像。`
				: `Create an image in ${stylePrefix}.

${finalPrompt}

IMPORTANT: Use the character reference images provided to maintain visual consistency. Each character should match their appearance from the reference images exactly.

The panel should include:
- Clear panel border
- Speech bubbles with dialogue text (if any) - IMPORTANT: If dialogue includes character attribution like "Character: 'text'", only put the spoken text in the speech bubble, NOT the character name
- Thought bubbles if needed
- Sound effects where appropriate
- Consistent character designs matching the references

Generate a single panel image with proper framing and composition.`;

			finalPrompt = panelInstructions;
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

		// Do not start an overlapping paid retry when a still-running request times out.
		const selectedModel = selectAIModel(language as "en" | "zh", aiModel as any);
		const aiRouter = getAIModelRouter();
		if (imageType !== "panel" && imageType !== "character") {
			throw new Error(`Unsupported image type: ${imageType}`);
		}
		const result = await aiRouter.generateComicPanel(
			finalPrompt,
			processedReferenceImages,
			language as "en" | "zh",
			selectedModel,
			imageSize,
			style as any,
		);

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

		redrawLogger.info(
			{
				requestId,
				image_type: imageType,
				image_id: imageId,
				model_used: result.modelUsed,
				image_size_kb: result.imageData
					? Math.round((result.imageData.length * 0.75) / 1024)
					: 0,
				duration_ms: Date.now() - startTime,
			},
			"🎉 Successfully redrew image",
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
