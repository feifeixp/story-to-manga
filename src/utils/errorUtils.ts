/**
 * Simple rate limit error handler
 */
export const handleApiError = async (
	response: Response,
	defaultMessage: string,
): Promise<string> => {
	if (response.status === 429) {
		try {
			const data = await response.json();
			const retryAfter = data.retryAfter || 60;
			return `Rate limit exceeded. Please wait ${retryAfter} seconds and try again.`;
		} catch {
			return "Rate limit exceeded. Please wait a minute and try again.";
		}
	}

	if (response.status === 400) {
		try {
			const data = await response.json();
			if (data.errorType === "PROHIBITED_CONTENT") {
				return data.error || `⚠️ Content Safety Issue: The content contains elements that cannot be processed by the AI safety system.\n\nTip: Try modifying your story to remove potentially inappropriate content, violence, or mature themes.`;
			}
			return data.error || defaultMessage;
		} catch {
			return defaultMessage;
		}
	}

	if (response.status === 503) {
		try {
			const data = await response.json();
			if (data.fallback) {
				return `🚫 故事分析失败：${data.error || '服务暂时不可用'}\n\n${data.details || ''}\n\n请检查以下问题：\n• 网络连接是否正常\n• 故事内容是否完整清晰\n• 是否包含过多特殊字符或格式\n\n建议：\n• 简化故事内容后重试\n• 检查网络连接\n• 稍后再试`;
			}
			return data.error || defaultMessage;
		} catch {
			return "服务暂时不可用，请稍后重试";
		}
	}

	return defaultMessage;
};

/**
 * Get word count from text
 */
export const getWordCount = (text: string): number => {
	return text
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0).length;
};
