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
	const endpoint = "/api/generate-panel";
	let panel: any;

	logApiRequest(panelLogger, endpoint);

	try {
		const requestData = await request.json();
		panel = requestData.panel;
		const {
			characterReferences,
			setting,
			scenes = [], // 添加场景信息参数
			style,
			uploadedSettingReferences = [],
			language = "en", // 添加语言参数，默认为英文
			aiModel = "auto", // 添加AI模型选择参数，默认为自动选择
			imageSize, // 添加图片尺寸参数
		} = requestData;

		panelLogger.debug(
			{
				panel_number: panel?.panelNumber,
				characters: panel?.characters,
				character_refs_count: characterReferences?.length || 0,
				uploaded_setting_refs_count: uploadedSettingReferences?.length || 0,
				style,
				ai_model: aiModel,
				language,
			},
			"Received panel generation request",
		);

		if (!panel || !characterReferences || !setting || !style) {
			panelLogger.warn(
				{
					panel: !!panel,
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
					error: "Panel, character references, setting, and style are required",
				},
				{ status: 400 },
			);
		}

		// 检查面板图片缓存
		const panelDescription = panel.description || panel.panelDescription;
		const cachedPanel = cacheHelpers.getCachedPanelImage(
			panel.panelNumber,
			panelDescription,
			characterReferences,
			style,
			imageSize
		);

		if (cachedPanel) {
			panelLogger.info("Returning cached panel image");
			logApiResponse(panelLogger, endpoint, true, Date.now() - startTime, {
				cached: true,
				panel_number: panel.panelNumber,
			});
			return NextResponse.json({
				success: true,
				generatedPanel: {
					panelNumber: panel.panelNumber,
					description: panelDescription,
					image: cachedPanel,
				},
				cached: true,
			});
		}

		// 使用标准的风格配置，确保一致性
		const stylePrefix = getStylePrompt(style as any, 'prefix', language);

		// Process single panel
		panelLogger.debug(
			{
				panel_number: panel.panelNumber,
				camera_angle: panel.cameraAngle,
				style_prefix: `${stylePrefix.substring(0, 50)}...`,
			},
			"Processing single panel",
		);

		const charactersInPanel = panel.characters
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

		// Add setting reference instructions if available
		if (uploadedSettingReferences.length > 0) {
			const settingRefInstruction = language === 'zh'
				? `
重要：使用提供的设定/环境参考图片来指导此面板的视觉风格、氛围和环境细节。融入设定参考中显示的视觉元素、光照和氛围，同时适应${stylePrefix}的美学风格。
`
				: `
IMPORTANT: Use the provided setting/environment reference images to guide the visual style, atmosphere, and environmental details of this panel. Incorporate the visual elements, lighting, and mood shown in the setting references while adapting them to the ${stylePrefix} aesthetic.
`;
			prompt += settingRefInstruction;
		}

		const finalInstructions = language === 'zh'
			? `
面板应包含：
- 清晰的面板边框
- 对话气泡和对话文字（如有）- 重要：如果对话包含角色归属如"角色：'文字'"，只在对话气泡中放入说话内容，不要放角色名字
- 思考气泡（如需要）
- 适当的音效
- 与参考图片匹配的一致角色设计

生成一个具有适当构图和框架的单个漫画面板图像。
`
			: `
The panel should include:
- Clear panel border
- Speech bubbles with dialogue text (if any) - IMPORTANT: If dialogue includes character attribution like "Character: 'text'", only put the spoken text in the speech bubble, NOT the character name
- Thought bubbles if needed
- Sound effects where appropriate
- Consistent character designs matching the references

Generate a single comic panel image with proper framing and composition.
`;

		prompt += finalInstructions;

		// 🎯 准备参考图片 - 根据面板中的角色动态选择
		const referenceImages: string[] = [];

		// 获取当前面板涉及的角色
		const panelCharacters = panel.characters || [];

		// 根据面板中的角色名字匹配对应的参考图片
		panelCharacters.forEach((charName: string) => {
			const matchingCharRef = characterReferences.find(
				(ref: { name: string; image?: string }) => ref.name === charName
			);
			if (matchingCharRef && matchingCharRef.image) {
				referenceImages.push(matchingCharRef.image);
			}
		});

		// 添加场景参考图片（填充剩余槽位，最多4张总计）
		const remainingSlots = Math.max(0, 4 - referenceImages.length);
		const settingImages = uploadedSettingReferences
			.slice(0, remainingSlots)
			.map((ref: { image?: string }) => ref.image)
			.filter((img: string | undefined): img is string => !!img);
		referenceImages.push(...settingImages);

		panelLogger.info(
			{
				panel_number: panel.panelNumber,
				prompt_length: prompt.length,
				panel_characters: panelCharacters,
				matched_character_refs: panelCharacters.length,
				total_character_refs_available: characterReferences.length,
				uploaded_setting_refs_attached: uploadedSettingReferences.length,
				reference_images_count: referenceImages.length,
				character_images_used: referenceImages.length - settingImages.length,
				setting_images_used: settingImages.length,
				language: language,
			},
			"Calling AI Model Router for panel generation with matched character references",
		);

		// 使用AI模型路由器生成漫画面板
		const aiRouter = getAIModelRouter();
		const result = await aiRouter.generateComicPanel(
			prompt,
			referenceImages,
			language as "en" | "zh",
			aiModel as any, // 传递用户选择的模型
			imageSize, // 传递图片尺寸配置
			style, // 传递漫画风格
		);

		if (!result.success || !result.imageData) {
			throw new Error(result.error || "Failed to generate panel");
		}

		// Validate imageData format
		const imageData = result.imageData;

		panelLogger.debug({
			panel_number: panel.panelNumber,
			imageData_type: typeof imageData,
			imageData_preview: typeof imageData === 'string' ? imageData.substring(0, 100) + '...' : imageData,
			imageData_length: typeof imageData === 'string' ? imageData.length : 'N/A'
		}, "Validating image data format");

		const isValidUrl = typeof imageData === 'string' && (imageData.startsWith('http://') || imageData.startsWith('https://'));
		const isValidBase64 = typeof imageData === 'string' && (imageData.startsWith('data:image/') || /^[A-Za-z0-9+/]+=*$/.test(imageData));
		const isValidProxyUrl = typeof imageData === 'string' && imageData.startsWith('/api/image-proxy?url=');

		panelLogger.debug({
			panel_number: panel.panelNumber,
			isValidUrl,
			isValidBase64,
			isValidProxyUrl
		}, "Image data validation results");

		if (!isValidUrl && !isValidBase64 && !isValidProxyUrl) {
			throw new Error(`Invalid image data format. Expected URL, base64, or proxy URL, got: ${typeof imageData} - "${imageData}"`);
		}

		panelLogger.info(
			{
				panel_number: panel.panelNumber,
				model_used: result.modelUsed,
				image_size_kb: result.imageData
					? Math.round((result.imageData.length * 0.75) / 1024)
					: 0,
				duration_ms: Date.now() - startTime,
			},
			"Successfully generated panel",
		);

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
			panelLogger.info("Cached panel image for future use");
		}

		logApiResponse(panelLogger, endpoint, true, Date.now() - startTime, {
			panel_number: panel.panelNumber,
			model_used: result.modelUsed,
			image_size_kb: result.imageData
				? Math.round((result.imageData.length * 0.75) / 1024)
				: 0,
		});

		return NextResponse.json({
			success: true,
			generatedPanel: {
				panelNumber: panel.panelNumber,
				image: result.imageData,
				modelUsed: result.modelUsed,
			},
		});
	} catch (error) {
		logError(panelLogger, error, "panel generation", {
			panel_number: panel?.panelNumber,
			duration_ms: Date.now() - startTime,
		});
		logApiResponse(panelLogger, endpoint, false, Date.now() - startTime, {
			error: "Panel generation failed",
			panel_number: panel?.panelNumber,
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
			{ error: `Failed to generate panel ${panel?.panelNumber || "unknown"}` },
			{ status: 500 },
		);
	}
}
