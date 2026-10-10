import { GoogleGenAI, Type } from "@google/genai";
import { type NextRequest, NextResponse } from "next/server";
import { parseGeminiJSON } from "@/lib/json-parser";
import {
	logApiRequest,
	logApiResponse,
	logError,
	storyAnalysisLogger,
} from "@/lib/logger";

interface Character {
	name: string;
	physicalDescription: string;
	personality: string;
	role: string;
}

interface Setting {
	timePeriod: string;
	location: string;
	mood: string;
}

interface Scene {
	id: string;
	name: string;
	description: string;
	location: string;
	timeOfDay?: string;
	mood: string;
	visualElements: string[];
}

interface AnalysisData {
	characters: Character[];
	setting: Setting;
	scenes: Scene[];
}

const model = process.env["GOOGLE_TEXT_MODEL"] || "gemini-2.5-flash";

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const endpoint = "/api/analyze-story";

	logApiRequest(storyAnalysisLogger, endpoint);

	try {
		const apiKey = process.env["GOOGLE_AI_API_KEY"];
		if (!apiKey) return NextResponse.json({ error: "请先配置 GOOGLE_AI_API_KEY / Configure GOOGLE_AI_API_KEY before planning." }, { status: 503 });
		const genAI = new GoogleGenAI({ apiKey });
		const { story, style, language = "en" } = await request.json();

		storyAnalysisLogger.debug(
			{
				story_length: story?.length || 0,
				style,
				language,
			},
			"Received story analysis request",
		);

		if (!story || !style) {
			storyAnalysisLogger.warn(
				{ story: !!story, style: !!style },
				"Missing required parameters",
			);
			logApiResponse(
				storyAnalysisLogger,
				endpoint,
				false,
				Date.now() - startTime,
				{ error: "Missing parameters" },
			);
			return NextResponse.json(
				{ error: "Story and style are required" },
				{ status: 400 },
			);
		}

		// Validate story length (500 words max)
		const wordCount = story.trim().split(/\s+/).length;
		storyAnalysisLogger.debug({ wordCount }, "Calculated word count");

		if (wordCount > 500) {
			storyAnalysisLogger.warn(
				{ wordCount, limit: 500 },
				"Story exceeds word limit",
			);
			logApiResponse(
				storyAnalysisLogger,
				endpoint,
				false,
				Date.now() - startTime,
				{ error: "Word limit exceeded" },
			);
			return NextResponse.json(
				{ error: `Story too long. Maximum 500 words, got ${wordCount} words.` },
				{ status: 400 },
			);
		}

		// 根据语言构建提示词
		const prompt = language === 'zh' ? `
分析这个故事并提取主要角色、设定和具体场景：

故事："${story}"

风格：${style}

请提供：
1. 这个故事的标题（如果没有明确提到，请创建一个吸引人的、合适的标题）

2. 主要角色列表（最多1-4个，根据故事复杂性选择）包含：
   - 姓名
   - 外貌描述（年龄、体型、头发、服装、显著特征）
   - 性格特征
   - 在故事中的角色

3. 全局设定描述（时代背景、大致地点、整体氛围）

4. 具体场景列表（2-8个场景，根据故事需要）每个场景包含：
   - 场景名称
   - 具体位置
   - 场景描述
   - 一天中的时间
   - 场景氛围
   - 关键视觉元素

请用中文回答所有内容。确保角色描述详细且适合${style}风格的视觉表现。
` : `
Analyze this story and extract the main characters, setting, and specific scenes:

Story: "${story}"

Style: ${style}

Please provide:
1. A title for this story (create a catchy, appropriate title if one isn't explicitly mentioned)

2. A list of main characters (1-4 maximum, choose based on story complexity) with:
   - Name
   - Physical description (age, build, hair, clothing, distinctive features)
   - Personality traits
   - Role in the story

3. Global setting description (time period, general location, overall mood)

4. Specific scenes that occur in the story (2-8 scenes maximum, based on story complexity) with:
   - Unique ID (scene1, scene2, etc.)
   - Scene name (brief descriptive name)
   - Detailed description of the location/environment
   - Specific location within the global setting
   - Time of day (if relevant: morning, afternoon, evening, night)
   - Mood/atmosphere of this specific scene
   - Key visual elements that should be consistent (architecture, furniture, landscape features, etc.)

Focus on identifying distinct locations where story events occur to ensure visual consistency across panels.
Provide all content in English and ensure character descriptions are detailed and suitable for ${style} style visual representation.
`;

		storyAnalysisLogger.info(
			{
				model: model,
				prompt_length: prompt.length,
			},
			"Calling Gemini API for story analysis",
		);

		// 添加重试机制和超时控制
		const maxRetries = 3;
		let lastError: Error | null = null;
		let result: any = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const attemptStartTime = Date.now();
				storyAnalysisLogger.info(
					{
						attempt,
						maxRetries,
						story_length: story.length,
						word_count: wordCount,
						model: model,
						timeout_seconds: 30,
						api_key_length: apiKey?.length || 0
					},
					`🔄 Attempting Gemini API call (attempt ${attempt}/${maxRetries})`
				);

				// 设置超时控制 (延长到120秒)
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('Request timeout after 120 seconds')), 120000);
				});

				// 使用完整的JSON schema确保结构化输出
				const apiCallPromise = genAI.models.generateContent({
					model: model,
					contents: prompt,
					config: {
						responseMimeType: "application/json",
						responseSchema: {
							type: Type.OBJECT,
							properties: {
								title: { type: Type.STRING },
								characters: {
									type: Type.ARRAY,
									items: {
										type: Type.OBJECT,
										properties: {
											name: { type: Type.STRING },
											physicalDescription: { type: Type.STRING },
											personality: { type: Type.STRING },
											role: { type: Type.STRING },
										},
									},
								},
								setting: {
									type: Type.OBJECT,
									properties: {
										timePeriod: { type: Type.STRING },
										location: { type: Type.STRING },
										mood: { type: Type.STRING },
									},
								},
								scenes: {
									type: Type.ARRAY,
									items: {
										type: Type.OBJECT,
										properties: {
											id: { type: Type.STRING },
											name: { type: Type.STRING },
											description: { type: Type.STRING },
											location: { type: Type.STRING },
											timeOfDay: { type: Type.STRING },
											mood: { type: Type.STRING },
											visualElements: {
												type: Type.ARRAY,
												items: { type: Type.STRING },
											},
										},
									},
								},
							},
						},
					},
				});

				result = await Promise.race([apiCallPromise, timeoutPromise]);

				const attemptDuration = Date.now() - attemptStartTime;
				storyAnalysisLogger.info(
					{
						attempt,
						success: true,
						response_length: result?.text?.length || 0,
						attempt_duration_ms: attemptDuration,
						total_duration_ms: Date.now() - startTime
					},
					`✅ Gemini API call succeeded on attempt ${attempt} (${attemptDuration}ms)`
				);
				break; // 成功则跳出重试循环

			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// 详细记录错误信息
				storyAnalysisLogger.error(
					{
						attempt,
						maxRetries,
						error: lastError.message,
						error_stack: lastError.stack,
						story_length: story.length,
						story_preview: story.substring(0, 200) + "...",
						willRetry: attempt < maxRetries
					},
					`Gemini API call failed on attempt ${attempt} - detailed error info`
				);

				if (attempt < maxRetries) {
					// 检查是否是503服务器过载错误
					const isOverloadError = lastError.message.includes('overloaded') ||
											lastError.message.includes('503') ||
											lastError.message.includes('UNAVAILABLE');

					// 对于服务器过载错误，等待更长时间
					const baseDelay = isOverloadError ? 3000 : 1000;
					const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 15000);

					storyAnalysisLogger.info(
						{
							delay,
							is_overload_error: isOverloadError,
							retry_reason: isOverloadError ? 'server_overload' : 'general_error'
						},
						`Waiting ${delay}ms before retry (${isOverloadError ? 'server overload' : 'general error'})`
					);
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}
		}

		// 如果所有重试都失败了，提供备用方案
		if (!result && lastError) {
			storyAnalysisLogger.error(
				{
					error: lastError.message,
					story_length: story.length,
					story_preview: story.substring(0, 300),
					final_error: "All Gemini API attempts failed, this should not happen in normal operation"
				},
				"CRITICAL: All Gemini API attempts failed, providing fallback analysis"
			);

			// 提供明确的错误信息作为备用方案
			const fallbackAnalysis = {
				title: "故事分析失败 - 请重试",
				characters: [
					{
						name: "未知角色",
						physicalDescription: "无法分析角色外观，请重新生成",
						personality: "无法分析角色性格，请重新生成",
						role: "故事角色"
					}
				],
				setting: {
					timePeriod: style === "wuxia" ? "古代武侠时期" : style === "manga" ? "现代" : "未知时期",
					location: "无法确定地点",
					mood: "无法确定氛围"
				},
				scenes: [
					{
						id: "scene1",
						name: "未知场景",
						description: "无法分析场景描述，请重新生成",
						location: "无法确定具体地点",
						timeOfDay: "未知时间",
						mood: "无法确定场景氛围",
						visualElements: ["无法分析视觉元素"]
					}
				],
				error: "故事分析失败，建议重新尝试生成"
			};

			storyAnalysisLogger.info(
				{ fallback: true },
				"Using fallback story analysis"
			);

			logApiResponse(
				storyAnalysisLogger,
				endpoint,
				true,
				Date.now() - startTime,
				{
					fallback: true,
					characters_count: fallbackAnalysis.characters.length,
					word_count: wordCount,
				},
			);

			return NextResponse.json({
				success: false,
				error: "故事分析失败，请重试",
				details: "AI分析服务暂时不可用，请检查网络连接后重试",
				fallback: true,
				analysis: fallbackAnalysis,
				wordCount,
				message: "使用了备用分析方案，请检查网络连接后重试以获得更好的分析结果"
			}, { status: 503 }); // 503 Service Unavailable
		}
		const text = result.text || "";

		storyAnalysisLogger.debug(
			{
				response_length: text.length,
			},
			"Received response from Gemini API",
		);

		// Parse JSON response
		let analysisData: AnalysisData;
		try {
			analysisData = parseGeminiJSON<AnalysisData>(text);
			storyAnalysisLogger.info(
				{
					characters_count: analysisData.characters.length,
					has_setting: !!analysisData.setting,
				},
				"Successfully parsed story analysis",
			);
		} catch (parseError) {
			logError(storyAnalysisLogger, parseError, "JSON parsing", {
				response_text: text?.substring(0, 1000),
			});
			logApiResponse(
				storyAnalysisLogger,
				endpoint,
				false,
				Date.now() - startTime,
				{
					error: "JSON parsing failed",
					response_preview: text?.substring(0, 200),
				},
			);
			return NextResponse.json(
				{ error: "Failed to parse story analysis" },
				{ status: 500 },
			);
		}

		logApiResponse(
			storyAnalysisLogger,
			endpoint,
			true,
			Date.now() - startTime,
			{
				characters_count: analysisData.characters.length,
				word_count: wordCount,
			},
		);

		return NextResponse.json({
			success: true,
			analysis: analysisData,
			wordCount,
		});
	} catch (error) {
		logError(storyAnalysisLogger, error, "story analysis");
		logApiResponse(
			storyAnalysisLogger,
			endpoint,
			false,
			Date.now() - startTime,
			{ error: "Unexpected error" },
		);
		return NextResponse.json(
			{ error: "Failed to analyze story" },
			{ status: 500 },
		);
	}
}
