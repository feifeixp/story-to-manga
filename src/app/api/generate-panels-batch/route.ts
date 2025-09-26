import { type NextRequest, NextResponse } from "next/server";
import { getAIModelRouter } from "@/lib/aiModelRouter";
import { cacheHelpers } from "@/lib/cacheManager";
import { getStylePrompt } from "@/lib/styleConfig";
import {
	logApiRequest,
	logApiResponse,
	logError,
	panelLogger,
} from "@/lib/logger";
import { cloudFirstStorage } from "@/lib/cloudFirst";

// 清理对话内容，移除角色名字以避免在图片中显示文字
function cleanDialogue(dialogue: string): string {
	if (!dialogue) return dialogue;

	// 匹配各种对话格式并清理角色名字
	return dialogue
		// 匹配 "角色名: '对话内容'" 或 "角色名: "对话内容""
		.replace(/^([^:：]+)[:：]\s*['"]?([^'"]+)['"]?$/, '$2')
		// 匹配 "角色名说：'对话内容'"
		.replace(/^([^说]+)说[:：]\s*['"]?([^'"]+)['"]?$/, '$2')
		// 清理引号
		.replace(/^['"]|['"]$/g, '')
		.trim();
}

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const endpoint = "/api/generate-panels-batch";
	let panels: any[] = [];

	logApiRequest(panelLogger, endpoint);

	try {
		const requestData = await request.json();
		panels = requestData.panels || [];
		const {
			characterReferences,
			setting,
			scenes = [], // 添加场景信息参数
			style,
			uploadedSettingReferences = [],
			language = "en",
			aiModel = "auto",
			imageSize,
			batchSize = 3, // 默认批次大小
			projectId, // 添加项目ID参数
		} = requestData;

		panelLogger.debug(
			{
				panels_count: panels.length,
				character_refs_count: characterReferences?.length || 0,
				uploaded_setting_refs_count: uploadedSettingReferences?.length || 0,
				style,
				ai_model: aiModel,
				language,
				batch_size: batchSize,
			},
			"Received batch panel generation request",
		);

		if (!panels || panels.length === 0 || !characterReferences || !setting || !style) {
			panelLogger.warn(
				{
					panels: panels?.length || 0,
					characterReferences: !!characterReferences,
					setting: !!setting,
					style: !!style,
				},
				"Missing required parameters",
			);
			logApiResponse(panelLogger, endpoint, false, Date.now() - startTime, {
				error: "Missing parameters",
			});
			return NextResponse.json(
				{
					error: "Panels, character references, setting, and style are required",
				},
				{ status: 400 },
			);
		}

		// 限制批次大小以避免超时和资源问题
		const maxBatchSize = 5;
		const effectiveBatchSize = Math.min(batchSize, maxBatchSize, panels.length);

		panelLogger.info(
			{
				requested_panels: panels.length,
				effective_batch_size: effectiveBatchSize,
			},
			"Starting batch panel generation",
		);

		// 使用标准的风格配置，确保一致性
		const stylePrefix = getStylePrompt(style as any, 'prefix', language);

		// 注意：角色参考图片将在每个面板处理时动态选择，而不是在这里固定选择
		// 这样可以确保每个面板使用正确的角色参考图片

		// 准备全局场景参考图片（所有面板共享）
		const globalSettingImages = uploadedSettingReferences
			.slice(0, 4) // 最多4张场景参考图片
			.map((ref: { image?: string }) => ref.image)
			.filter((img: string | undefined): img is string => !!img);

		// 获取AI模型路由器
		const aiRouter = getAIModelRouter();
		const results: any[] = [];
		const errors: any[] = [];

		// 分批处理面板
		for (let i = 0; i < panels.length; i += effectiveBatchSize) {
			const batch = panels.slice(i, i + effectiveBatchSize);
			
			panelLogger.info(
				{
					batch_index: Math.floor(i / effectiveBatchSize) + 1,
					batch_size: batch.length,
					panels_in_batch: batch.map(p => p.panelNumber),
				},
				"Processing batch",
			);

			// 并行处理当前批次的面板
			const batchPromises = batch.map(async (panel: any, index: number) => {
				try {
					// 检查缓存
					const panelDescription = panel.description || panel.panelDescription || panel.sceneDescription;
					const cachedPanel = cacheHelpers.getCachedPanelImage(
						panel.panelNumber,
						panelDescription,
						characterReferences,
						style,
						imageSize
					);

					if (cachedPanel) {
						panelLogger.info(
							{ panel_number: panel.panelNumber },
							"Using cached panel image"
						);
						return {
							success: true,
							panelNumber: panel.panelNumber,
							image: cachedPanel,
							cached: true,
						};
					}

					// 🎯 为当前面板动态选择正确的角色参考图片
					const panelCharacters = panel.characters || [];
					const panelCharacterImages: string[] = [];

					// 根据面板中的角色名字匹配对应的参考图片
					panelCharacters.forEach((charName: string) => {
						const matchingCharRef = characterReferences.find(
							(ref: { name: string; image?: string }) => ref.name === charName
						);
						if (matchingCharRef && matchingCharRef.image) {
							panelCharacterImages.push(matchingCharRef.image);
						}
					});

					// 准备当前面板的参考图片
					const panelReferenceImages: string[] = [];

					// 添加匹配的角色参考图片（最多2张）
					panelReferenceImages.push(...panelCharacterImages.slice(0, 2));

					// 添加场景参考图片（填充剩余槽位，最多4张总计）
					const remainingSlots = 4 - panelReferenceImages.length;
					if (remainingSlots > 0) {
						panelReferenceImages.push(...globalSettingImages.slice(0, remainingSlots));
					}

					panelLogger.info({
						panel_number: panel.panelNumber,
						panel_characters: panelCharacters,
						matched_character_refs: panelCharacterImages.length,
						total_reference_images: panelReferenceImages.length,
						setting_images_added: Math.max(0, panelReferenceImages.length - panelCharacterImages.length)
					}, "Selected reference images for panel");

					// 构建角色描述
					const charactersInPanel = (panel.characters || [])
						.map((charName: string) => {
							const charRef = characterReferences.find(
								(ref: { name: string; image?: string }) => ref.name === charName,
							);
							return charRef
								? `${charName} (matching the character design shown in reference image)`
								: charName;
						})
						.join(" and ");

					// 查找面板对应的具体场景信息
					const panelScene = panel.sceneId ? scenes.find((scene: any) => scene.id === panel.sceneId) : null;

					// 根据语言选择提示词开头
					const promptStart = language === 'zh'
						? `创建一个漫画面板，风格：${stylePrefix}。

全局设定：${setting.location}，${setting.timePeriod}，氛围：${setting.mood}`
						: `Create a single comic panel in ${stylePrefix}.

Global Setting: ${setting.location}, ${setting.timePeriod}, mood: ${setting.mood}`;

					// 构建提示词
					let prompt = promptStart;

					// 添加具体场景信息
					if (panelScene) {
						const sceneInfo = language === 'zh'
							? `

具体场景：${panelScene.name}
场景位置：${panelScene.location}
场景描述：${panelScene.description}
时间：${panelScene.timeOfDay || '未指定'}
场景氛围：${panelScene.mood}
关键视觉元素：${panelScene.visualElements.join('，')}

重要：保持与此特定场景的视觉一致性。使用场景的视觉元素、氛围和位置细节来创建连贯的环境。`
							: `

Specific Scene: ${panelScene.name}
Scene Location: ${panelScene.location}
Scene Description: ${panelScene.description}
Time of Day: ${panelScene.timeOfDay || 'unspecified'}
Scene Mood: ${panelScene.mood}
Key Visual Elements: ${panelScene.visualElements.join(', ')}

IMPORTANT: Maintain visual consistency with this specific scene. Use the scene's visual elements, mood, and location details to create a cohesive environment.`;

						prompt += sceneInfo;
					}

					const panelDetails = language === 'zh'
						? `

面板详情：
第${panel.panelNumber}格：${charactersInPanel}的${panel.cameraAngle}镜头。场景：${panel.sceneDescription}。${panel.dialogue ? `对话："${cleanDialogue(panel.dialogue)}"` : "无对话。"}。氛围：${panel.visualMood}。

重要：使用提供的角色参考图片保持视觉一致性。每个角色都应该与参考图片中的外观完全匹配。
`
						: `

Panel Details:
Panel ${panel.panelNumber}: ${panel.cameraAngle} shot of ${charactersInPanel}. Scene: ${panel.sceneDescription}. ${panel.dialogue ? `Dialogue: "${cleanDialogue(panel.dialogue)}"` : "No dialogue."}. Mood: ${panel.visualMood}.

IMPORTANT: Use the character reference images provided to maintain visual consistency. Each character should match their appearance from the reference images exactly.
`;

					prompt += panelDetails;

					// 添加场景参考图片说明
					if (uploadedSettingReferences.length > 0) {
						prompt += `
IMPORTANT: Use the provided setting/environment reference images to guide the visual style, atmosphere, and environmental details of this panel. Incorporate the visual elements, lighting, and mood shown in the setting references while adapting them to the ${stylePrefix} aesthetic.
`;
					}

					prompt += `
The panel should include:
- Clear panel border
- Speech bubbles with dialogue text (if any) - IMPORTANT: If dialogue includes character attribution like "Character: 'text'", only put the spoken text in the speech bubble, NOT the character name
- Thought bubbles if needed
- Sound effects where appropriate
- Consistent character designs matching the references

Generate a single comic panel image with proper framing and composition.
`;

					// 错开请求时间，避免同时发送（在批次内）
					if (index > 0) {
						await new Promise(resolve => setTimeout(resolve, index * 200));
					}

					// 生成面板 - 使用为当前面板动态选择的参考图片
					const result = await aiRouter.generateComicPanel(
						prompt,
						panelReferenceImages, // 使用动态选择的参考图片，而不是固定的referenceImages
						language as "en" | "zh",
						aiModel as any,
						imageSize,
						style,
					);

					if (!result.success || !result.imageData) {
						throw new Error(result.error || "Failed to generate panel");
					}

					// 缓存生成的面板图片
					if (result.imageData) {
						cacheHelpers.cachePanelImage(
							panel.panelNumber,
							panelDescription,
							characterReferences,
							style,
							imageSize,
							result.imageData
						);
					}

					// 保存到云端（如果提供了项目ID）
					let cloudUrl: string | null = null;
					let publicImageUrl: string = result.imageData; // 默认使用原始图片数据

					if (result.imageData && projectId) {
						try {
							await cloudFirstStorage.initialize();
							const saveResult = await cloudFirstStorage.saveGeneratedPanel(
								projectId,
								panel.panelNumber,
								result.imageData,
								{
									modelUsed: result.modelUsed,
									style,
									generatedAt: new Date().toISOString(),
									panelDescription,
									characters: panel.characters,
								}
							);

							if (saveResult.success && saveResult.url) {
								cloudUrl = saveResult.url;
								panelLogger.info(`Panel ${panel.panelNumber} saved to cloud in batch: ${cloudUrl}`);
							} else {
								panelLogger.error(`Failed to save panel ${panel.panelNumber} to cloud in batch: ${saveResult.error}`);
							}

							// 如果成功保存到云端，获取公开URL用于前端显示
							if (cloudUrl) {
								try {
									const { generatePublicUrl } = await import('@/lib/r2Config');
									publicImageUrl = generatePublicUrl(cloudUrl);
									panelLogger.info(`Panel ${panel.panelNumber} public URL in batch: ${publicImageUrl}`);
								} catch (urlError) {
									panelLogger.error(`Failed to generate public URL for panel ${panel.panelNumber} in batch: ${urlError}`);
								}
							}
						} catch (cloudError) {
							panelLogger.warn(`Failed to save panel ${panel.panelNumber} to cloud in batch: ${cloudError}`);
							// 不影响主流程，继续处理
						}
					}

					panelLogger.info(
						{
							panel_number: panel.panelNumber,
							model_used: result.modelUsed,
							cloud_url: cloudUrl,
						},
						"Successfully generated panel in batch",
					);

					return {
						success: true,
						panelNumber: panel.panelNumber,
						image: publicImageUrl, // 使用公开URL而不是代理URL
						modelUsed: result.modelUsed,
						cached: false,
						cloudUrl, // 包含云端URL
					};

				} catch (error) {
					panelLogger.error(
						{
							panel_number: panel.panelNumber,
							error: error instanceof Error ? error.message : String(error),
						},
						"Failed to generate panel in batch",
					);

					return {
						success: false,
						panelNumber: panel.panelNumber,
						error: error instanceof Error ? error.message : String(error),
					};
				}
			});

			// 等待当前批次完成
			const batchResults = await Promise.all(batchPromises);
			
			// 分离成功和失败的结果
			batchResults.forEach(result => {
				if (result.success) {
					results.push(result);
				} else {
					errors.push(result);
				}
			});

			// 批次间延迟，避免API限制
			if (i + effectiveBatchSize < panels.length) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}

		const successCount = results.length;
		const errorCount = errors.length;
		const totalDuration = Date.now() - startTime;

		panelLogger.info(
			{
				total_panels: panels.length,
				successful_panels: successCount,
				failed_panels: errorCount,
				duration_ms: totalDuration,
			},
			"Batch panel generation completed",
		);

		logApiResponse(panelLogger, endpoint, true, totalDuration, {
			total_panels: panels.length,
			successful_panels: successCount,
			failed_panels: errorCount,
		});

		return NextResponse.json({
			success: true,
			results: results,
			errors: errors,
			summary: {
				totalPanels: panels.length,
				successfulPanels: successCount,
				failedPanels: errorCount,
				durationMs: totalDuration,
			},
		});

	} catch (error) {
		logError(panelLogger, error, "batch panel generation", {
			panels_count: panels?.length || 0,
			duration_ms: Date.now() - startTime,
		});
		logApiResponse(panelLogger, endpoint, false, Date.now() - startTime, {
			error: "Batch panel generation failed",
			panels_count: panels?.length || 0,
		});

		// 处理特定错误类型
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
			{
				error: error instanceof Error ? error.message : "Batch panel generation failed",
			},
			{ status: 500 },
		);
	}
}
