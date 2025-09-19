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

const apiKey = process.env["GOOGLE_AI_API_KEY"];
if (!apiKey) {
	console.error("GOOGLE_AI_API_KEY environment variable is not set");
}
const genAI = new GoogleGenAI({ apiKey: apiKey! });
const model = "gemini-2.5-flash";

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const endpoint = "/api/analyze-story";

	logApiRequest(storyAnalysisLogger, endpoint);

	try {
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

		// 简化的提示词 - 平衡性能和质量
		const prompt = language === 'zh' ? `
分析故事并提取关键信息：

故事："${story}"
风格：${style}

请返回JSON格式的分析结果，包含：
1. 标题（简洁有吸引力）
2. 主要角色（1-4个）：姓名、外貌、性格、角色
3. 设定：时代、地点、氛围
4. 场景（2-6个）：ID、名称、描述、位置、时间、氛围、视觉元素

确保描述适合${style}风格的视觉表现。
` : `
Analyze the story and extract key information:

Story: "${story}"
Style: ${style}

Return JSON analysis with:
1. Title (concise and catchy)
2. Main characters (1-4): name, appearance, personality, role
3. Setting: time period, location, mood
4. Scenes (2-6): ID, name, description, location, time, mood, visual elements

Ensure descriptions suit ${style} style visual representation.
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

				// 设置超时控制 (缩短到30秒)
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
				});

				// 使用优化的JSON schema - 保持结构化输出但简化复杂度
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
										required: ["name"], // 只要求name字段
									},
								},
								setting: {
									type: Type.OBJECT,
									properties: {
										timePeriod: { type: Type.STRING },
										location: { type: Type.STRING },
										mood: { type: Type.STRING },
									},
									// 不要求任何字段为必需
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
										required: ["name"], // 只要求name字段
									},
								},
							},
							required: ["title"], // 只要求title字段
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

			// Validate parsed data structure
			if (!analysisData || typeof analysisData !== 'object') {
				throw new Error('Invalid analysis data structure');
			}

			// Ensure characters array exists
			if (!Array.isArray(analysisData.characters)) {
				analysisData.characters = [];
			}

			storyAnalysisLogger.info(
				{
					characters_count: analysisData.characters?.length || 0,
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
				characters_count: analysisData.characters?.length || 0,
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
