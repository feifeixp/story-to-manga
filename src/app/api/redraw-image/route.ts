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
			style, // 漫画风格 - 不设置默认值，使用前端传递的值
			// 添加场景数据支持
			setting,
			scenes = [],
			uploadedSettingReferences = [],
		} = requestData;

		imageType = requestImageType;
		imageId = requestImageId;

		// 验证必需参数
		if (!style) {
			throw new Error("Style parameter is required for image redraw");
		}

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
				has_setting: !!setting,
				scenes_count: scenes?.length || 0,
				uploaded_setting_refs_count: uploadedSettingReferences?.length || 0,
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

		// 为不同类型构建完整的提示词，确保风格一致性
		if (imageType === 'panel') {
			// 构建场景信息
			let sceneInfo = '';
			if (setting) {
				const settingInfo = language === 'zh'
					? `

全局设定：${setting.location}，${setting.timePeriod}，氛围：${setting.mood}`
					: `

Global Setting: ${setting.location}, ${setting.timePeriod}, mood: ${setting.mood}`;
				sceneInfo += settingInfo;
			}

			// 如果有具体场景信息，添加场景详情
			if (scenes && scenes.length > 0 && imageId) {
				// 尝试根据面板ID找到对应的场景
				const panelNumber = parseInt(imageId);
				if (!isNaN(panelNumber) && scenes.length > 0) {
					// 简单的场景匹配逻辑 - 可以根据实际需求调整
					const sceneIndex = Math.min(Math.floor((panelNumber - 1) / 3), scenes.length - 1);
					const panelScene = scenes[sceneIndex];

					if (panelScene) {
						const specificSceneInfo = language === 'zh'
							? `

具体场景：${panelScene.name}
场景位置：${panelScene.location}
场景描述：${panelScene.description}
时间：${panelScene.timeOfDay || '未指定'}
场景氛围：${panelScene.mood}
关键视觉元素：${panelScene.visualElements?.join('，') || '无'}

重要：保持与此特定场景的视觉一致性。使用场景的视觉元素、氛围和位置细节来创建连贯的环境。`
							: `

Specific Scene: ${panelScene.name}
Scene Location: ${panelScene.location}
Scene Description: ${panelScene.description}
Time of Day: ${panelScene.timeOfDay || 'unspecified'}
Scene Mood: ${panelScene.mood}
Key Visual Elements: ${panelScene.visualElements?.join(', ') || 'none'}

IMPORTANT: Maintain visual consistency with this specific scene. Use the scene's visual elements, mood, and location details to create a cohesive environment.`;

						sceneInfo += specificSceneInfo;
					}
				}
			}

			const panelInstructions = language === 'zh'
				? `创建一个图像，风格：${stylePrefix}。${sceneInfo}

${finalPrompt}

重要：使用提供的角色参考图片保持视觉一致性。每个角色都应该与参考图片中的外观完全匹配。${uploadedSettingReferences && uploadedSettingReferences.length > 0 ? '同时使用提供的设定/环境参考图片来指导此面板的视觉风格、氛围和环境细节。' : ''}

面板应包含：
- 清晰的面板边框
- 对话气泡和对话文字（如有）- 重要：如果对话包含角色归属如"角色：'文字'"，只在对话气泡中放入说话内容，不要放角色名字
- 思考气泡（如需要）
- 适当的音效
- 与参考图片匹配的一致角色设计

生成一个具有适当构图和框架的单个面板图像。`
				: `Create an image in ${stylePrefix}.${sceneInfo}

${finalPrompt}

IMPORTANT: Use the character reference images provided to maintain visual consistency. Each character should match their appearance from the reference images exactly.${uploadedSettingReferences && uploadedSettingReferences.length > 0 ? ' Also use the provided setting/environment reference images to guide the visual style, atmosphere, and environmental details of this panel.' : ''}

The panel should include:
- Clear panel border
- Speech bubbles with dialogue text (if any) - IMPORTANT: If dialogue includes character attribution like "Character: 'text'", only put the spoken text in the speech bubble, NOT the character name
- Thought bubbles if needed
- Sound effects where appropriate
- Consistent character designs matching the references

Generate a single panel image with proper framing and composition.`;

			finalPrompt = panelInstructions;
		} else if (imageType === 'character') {
			// 为角色重绘使用角色专用的风格提示词
			const characterStylePrompt = getStylePrompt(style as any, 'character', language);
			const characterInstructions = language === 'zh'
				? `${characterStylePrompt}

${finalPrompt}

重要：创建一个完整的角色参考图，包含：
- 多个角度的角色设计（正面、侧面、背面）
- 不同表情的展示
- 角色的服装细节
- 保持与原始设计的一致性
- 清晰的线条和细节

生成一个专业的角色参考图。`
				: `${characterStylePrompt}

${finalPrompt}

IMPORTANT: Create a complete character reference sheet including:
- Multiple angles of character design (front, side, back)
- Different facial expressions
- Clothing and accessory details
- Consistency with original design
- Clear lines and details

Generate a professional character reference sheet.`;

			finalPrompt = characterInstructions;
		}

		// 处理参考图片：将代理URL转换为实际图片数据
		// 对于面板重绘，还需要添加场景参考图片
		let allReferenceImages = [...referenceImages];

		// 如果是面板重绘且有场景参考图片，添加到参考图片列表中
		if (imageType === 'panel' && uploadedSettingReferences && uploadedSettingReferences.length > 0) {
			const settingImages = uploadedSettingReferences
				.slice(0, 2) // 最多添加2张场景参考图片
				.map((ref: { image?: string }) => ref.image)
				.filter((img: string | undefined): img is string => !!img);

			allReferenceImages.push(...settingImages);

			redrawLogger.info(
				{
					requestId,
					original_reference_count: referenceImages.length,
					setting_reference_count: settingImages.length,
					total_reference_count: allReferenceImages.length,
				},
				"🏞️ Added setting reference images for panel redraw",
			);
		}
		console.log(`Processing ${allReferenceImages.length} reference images:`, allReferenceImages);
		const processedReferenceImages: string[] = [];
		for (const refImage of allReferenceImages) {
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
					{ requestId, attempt, maxRetries, imageType },
					`🔄 Attempting AI model generation (attempt ${attempt}/${maxRetries})`
				);

				// 设置超时控制
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('Request timeout after 45 seconds')), 45000);
				});

				let generationPromise: Promise<any>;

				if (imageType === 'panel') {
					// 添加最终提示词调试信息
					redrawLogger.info(
						{
							requestId,
							final_prompt_to_ai: finalPrompt,
							prompt_length: finalPrompt.length,
							reference_images_count: processedReferenceImages.length,
						},
						"🚀 Sending final prompt to AI for panel redraw",
					);

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
					{ requestId, attempt, success: true, imageType },
					`✅ AI model generation succeeded on attempt ${attempt}`
				);
				break; // 成功则跳出重试循环

			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				redrawLogger.warn(
					{
						requestId,
						attempt,
						maxRetries,
						imageType,
						error: lastError.message,
						willRetry: attempt < maxRetries
					},
					`❌ AI model generation failed on attempt ${attempt}`
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
				{ requestId, error: lastError.message, imageType },
				"💥 All AI model generation attempts failed for image redraw"
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
