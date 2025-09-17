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

interface AnalysisData {
	characters: Character[];
	setting: Setting;
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
		const { story, style } = await request.json();

		storyAnalysisLogger.debug(
			{
				story_length: story?.length || 0,
				style,
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

		const prompt = `
Analyze this story and extract the main characters with their detailed characteristics:

Story: "${story}"

Style: ${style}

Please provide:
1. A title for this story (create a catchy, appropriate title if one isn't explicitly mentioned)

2. A list of main characters (1-4 maximum, choose based on story complexity) with:
   - Name
   - Physical description (age, build, hair, clothing, distinctive features)
   - Personality traits
   - Role in the story

3. Setting description (time period, location, mood)
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
				storyAnalysisLogger.info(
					{
						attempt,
						maxRetries,
						story_length: story.length,
						word_count: wordCount,
						model: model,
						timeout_seconds: 60
					},
					`🔄 Attempting Gemini API call (attempt ${attempt}/${maxRetries})`
				);

				// 设置超时控制 (故事分析需要更长时间，因为需要理解和分析整个故事内容)
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('Request timeout after 60 seconds')), 60000);
				});

				const apiCallPromise = genAI.models.generateContent({
					model: model,
					contents: prompt,
					config: {
						responseMimeType: "application/json",
						responseSchema: {
							type: Type.OBJECT,
							properties: {
								title: {
									type: Type.STRING,
								},
								characters: {
									type: Type.ARRAY,
									items: {
										type: Type.OBJECT,
										properties: {
											name: {
												type: Type.STRING,
											},
											physicalDescription: {
												type: Type.STRING,
											},
											personality: {
												type: Type.STRING,
											},
											role: {
												type: Type.STRING,
											},
										},
										propertyOrdering: [
											"name",
											"physicalDescription",
											"personality",
											"role",
										],
									},
								},
								setting: {
									type: Type.OBJECT,
									properties: {
										timePeriod: {
											type: Type.STRING,
										},
										location: {
											type: Type.STRING,
										},
										mood: {
											type: Type.STRING,
										},
									},
									propertyOrdering: ["timePeriod", "location", "mood"],
								},
							},
							propertyOrdering: ["title", "characters", "setting"],
						},
					},
				});

				result = await Promise.race([apiCallPromise, timeoutPromise]);

				storyAnalysisLogger.info(
					{
						attempt,
						success: true,
						response_length: result?.text?.length || 0,
						duration_ms: Date.now() - startTime
					},
					`✅ Gemini API call succeeded on attempt ${attempt}`
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
					// 等待一段时间后重试，使用指数退避
					const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
					storyAnalysisLogger.info(
						{ delay },
						`Waiting ${delay}ms before retry`
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
