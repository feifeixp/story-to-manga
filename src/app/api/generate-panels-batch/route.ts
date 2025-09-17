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
			style,
			uploadedSettingReferences = [],
			language = "en",
			aiModel = "auto",
			imageSize,
			batchSize = 3, // 默认批次大小
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

		// 准备参考图片
		const referenceImages: string[] = [];
		
		// 添加角色参考图片（最多2张）
		const characterImages = characterReferences
			.slice(0, 2)
			.map((ref: { image?: string }) => ref.image)
			.filter((img: string | undefined): img is string => !!img);
		referenceImages.push(...characterImages);

		// 添加场景参考图片（填充剩余槽位，最多4张总计）
		const settingImages = uploadedSettingReferences
			.slice(0, 4 - referenceImages.length)
			.map((ref: { image?: string }) => ref.image)
			.filter((img: string | undefined): img is string => !!img);
		referenceImages.push(...settingImages);

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

					// 构建提示词
					let prompt = `
Create a single comic panel in ${stylePrefix}.

Setting: ${setting.location}, ${setting.timePeriod}, mood: ${setting.mood}

Panel Details:
Panel ${panel.panelNumber}: ${panel.cameraAngle} shot of ${charactersInPanel}. Scene: ${panel.sceneDescription}. ${panel.dialogue ? `Dialogue: "${cleanDialogue(panel.dialogue)}"` : "No dialogue."}. Mood: ${panel.visualMood}.

IMPORTANT: Use the character reference images provided to maintain visual consistency. Each character should match their appearance from the reference images exactly.
`;

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

					// 生成面板
					const result = await aiRouter.generateComicPanel(
						prompt,
						referenceImages,
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

					panelLogger.info(
						{
							panel_number: panel.panelNumber,
							model_used: result.modelUsed,
						},
						"Successfully generated panel in batch",
					);

					return {
						success: true,
						panelNumber: panel.panelNumber,
						image: result.imageData,
						modelUsed: result.modelUsed,
						cached: false,
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
