import { type NextRequest, NextResponse } from "next/server";
import { getAIModelRouter } from "@/lib/aiModelRouter";
import {
	logApiRequest,
	logApiResponse,
	logError,
	panelLogger,
} from "@/lib/logger";

export async function POST(request: NextRequest) {
	const startTime = Date.now();
	const endpoint = "/api/modify-image";
	let imageType: string = "";
	let imageId: string = "";

	logApiRequest(panelLogger, endpoint);

	try {
		const requestData = await request.json();
		const {
			imageType: requestImageType, // 'panel' or 'character'
			imageId: requestImageId, // panel number or character name
			originalImage, // base64 image data to use as reference
			modificationPrompt, // what changes to make
			originalPrompt, // original generation prompt for context
			referenceImages = [],
			language = "en",
			aiModel = "auto",
			imageSize, // 图片尺寸配置
			style = "manga", // 漫画风格，默认为manga
		} = requestData;

		imageType = requestImageType;
		imageId = requestImageId;

		panelLogger.debug(
			{
				image_type: imageType,
				image_id: imageId,
				has_original_image: !!originalImage,
				modification_prompt_length: modificationPrompt?.length || 0,
				original_prompt_length: originalPrompt?.length || 0,
				reference_images_count: referenceImages?.length || 0,
				ai_model: aiModel,
				language,
			},
			"Received image modification request",
		);

		if (!imageType || !imageId || !originalImage || !modificationPrompt) {
			return NextResponse.json(
				{ error: "Missing required parameters: imageType, imageId, originalImage, or modificationPrompt" },
				{ status: 400 },
			);
		}

		// Create a combined prompt that includes the original context and modification instructions
		const combinedPrompt = originalPrompt 
			? `${originalPrompt}\n\nModification instructions: ${modificationPrompt}`
			: `Modify the provided reference image with the following changes: ${modificationPrompt}`;

		// Add the original image as a reference
		const allReferenceImages = [originalImage, ...referenceImages];

		panelLogger.info(
			{
				image_type: imageType,
				image_id: imageId,
				combined_prompt_length: combinedPrompt.length,
				total_reference_images: allReferenceImages.length,
				language: language,
			},
			"Calling AI Model Router for image modification",
		);

		// Use AI model router to modify the image
		const aiRouter = getAIModelRouter();
		let result;

		if (imageType === 'panel') {
			result = await aiRouter.generateComicPanel(
				combinedPrompt,
				allReferenceImages,
				language as "en" | "zh",
				aiModel as any,
				imageSize,
			);
		} else if (imageType === 'character') {
			result = await aiRouter.generateMangaPanel(
				combinedPrompt,
				language as "en" | "zh",
				aiModel as any,
				allReferenceImages,
				[],
				style as any,
			);
		} else {
			throw new Error(`Unsupported image type: ${imageType}`);
		}

		if (!result.success || !result.imageData) {
			throw new Error(result.error || "Failed to modify image");
		}

		// Validate imageData format
		const imageData = result.imageData;

		panelLogger.debug({
			image_type: imageType,
			image_id: imageId,
			imageData_type: typeof imageData,
			imageData_preview: typeof imageData === 'string' ? imageData.substring(0, 100) + '...' : imageData,
			imageData_length: typeof imageData === 'string' ? imageData.length : 'N/A'
		}, "Validating modified image data format");

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
			"Successfully modified image",
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
		logError(panelLogger, error, "image modification", {
			image_type: imageType,
			image_id: imageId,
			duration_ms: Date.now() - startTime,
		});
		logApiResponse(panelLogger, endpoint, false, Date.now() - startTime, {
			error: "Image modification failed",
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
			{ error: `Failed to modify ${imageType} ${imageId || "unknown"}` },
			{ status: 500 },
		);
	}
}
