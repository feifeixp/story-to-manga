// VolcEngine API Configuration
interface VolcEngineConfig {
	apiKey: string;
}

// VolcEngine API Response Types
interface VolcEngineResponse {
	success: boolean;
	data?: any;
	error?: string;
	code?: string;
}

interface GenerateImageRequest {
	prompt: string;
	image?: string[];
	sequential_image_generation?: "auto" | "manual";
	sequential_image_generation_options?: {
		max_images?: number;
	};
	response_format?: "url" | "b64_json";
	size?: "1K" | "2K" | "4K";
	stream?: boolean;
	watermark?: boolean;
}

interface GeneratedImage {
	url: string;
	base64?: string;
	width: number;
	height: number;
}

class VolcEngineClient {
	private config: VolcEngineConfig;
	private baseUrl = "https://ark.cn-beijing.volces.com";

	constructor(config: VolcEngineConfig) {
		this.config = config;
	}



	/**
	 * Make authenticated request to VolcEngine API
	 */
	private async makeRequest(
		endpoint: string,
		data: any,
		stream: boolean = false,
	): Promise<VolcEngineResponse> {
		try {
			const url = `${this.baseUrl}${endpoint}`;
			const method = "POST";
			const body = JSON.stringify(data);

			console.log("VolcEngine API Request:", {
				url,
				method,
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${this.config.apiKey.substring(0, 8)}...`,
				},
				bodySize: body.length,
			});

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${this.config.apiKey}`,
			};

			const response = await fetch(url, {
				method,
				headers,
				body,
			});

			console.log("VolcEngine API Response Status:", response.status, response.statusText);

			if (!response.ok) {
				const errorText = await response.text();
				console.error("VolcEngine API Error Response:", {
					status: response.status,
					statusText: response.statusText,
					errorText,
					headers: Object.fromEntries(response.headers.entries()),
				});
				throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
			}

			if (stream) {
				// Handle streaming response
				return {
					success: true,
					data: { stream: response.body },
				};
			} else {
				const result = await response.json();
				console.log("VolcEngine API Success Response:", JSON.stringify(result, null, 2));
				return {
					success: true,
					data: result,
				};
			}
		} catch (error) {
			console.error("VolcEngine API Error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				code: "API_ERROR",
			};
		}
	}

	/**
	 * Generate manga-style image using VolcEngine Seedream 4.0
	 */
	async generateMangaPanel(
		request: GenerateImageRequest,
	): Promise<VolcEngineResponse> {
		const payload: any = {
			model: "doubao-seedream-4-0-250828",
			prompt: request.prompt,
			response_format: request.response_format || "url",
			size: request.size || "2K",
			stream: request.stream || false,
			watermark: request.watermark !== false, // Default to true
		};

		// Add optional parameters
		if (request.image && request.image.length > 0) {
			payload.image = request.image;
		}

		if (request.sequential_image_generation) {
			payload.sequential_image_generation = request.sequential_image_generation;
		}

		if (request.sequential_image_generation_options) {
			payload.sequential_image_generation_options = request.sequential_image_generation_options;
		}

		return await this.makeRequest("/api/v3/images/generations", payload, request.stream);
	}

	/**
	 * Test API connection
	 */
	async testConnection(): Promise<boolean> {
		try {
			const testRequest: GenerateImageRequest = {
				prompt: "test connection",
				size: "1K",
				stream: false,
			};

			const response = await this.generateMangaPanel(testRequest);
			return response.success;
		} catch (error) {
			console.error("VolcEngine connection test failed:", error);
			return false;
		}
	}
}

// Create and export VolcEngine client instance
let volcEngineClient: VolcEngineClient | null = null;

export function getVolcEngineClient(): VolcEngineClient | null {
	if (!volcEngineClient) {
		const config = {
			apiKey: process.env["VOLCENGINE_API_KEY"] || "",
		};

		// Validate configuration
		if (!config.apiKey) {
			console.error(
				"VolcEngine API key not found. Please check VOLCENGINE_API_KEY environment variable.",
			);
			return null;
		}

		// Check if API key is a placeholder
		if (config.apiKey.includes("your_") || config.apiKey === "your_volcengine_api_key_here") {
			console.error(
				"VolcEngine API key appears to be a placeholder. Please set a valid VOLCENGINE_API_KEY.",
			);
			return null;
		}

		console.log("VolcEngine client initialized with API key:", config.apiKey.substring(0, 8) + "...");
		volcEngineClient = new VolcEngineClient(config);
	}

	return volcEngineClient;
}

export type { GenerateImageRequest, GeneratedImage, VolcEngineResponse };
export { VolcEngineClient };
