export const PLANNING_LIMITS = {
	connect: 75_000,
	idle: 95_000,
	total: 300_000,
};

/** Consume Coding Plan SSE without a fixed 60-second full-answer deadline. */
export async function planningJson(
	url: string,
	options: RequestInit,
	limits = PLANNING_LIMITS,
): Promise<{ response: Response; data: unknown }> {
	const controller = new AbortController();
	const external = options.signal;
	const cancel = () => controller.abort(external?.reason);
	external?.addEventListener("abort", cancel, { once: true });
	if (external?.aborted) cancel();
	let reason = "";
	const expire = (message: string) => {
		reason = message;
		controller.abort();
	};
	const total = setTimeout(
		() => expire("故事规划超过 5 分钟，请减少分镜数量后重试；尚未生成图片。"),
		limits.total,
	);
	let activity = setTimeout(
		() =>
			expire(
				"文本模型连接超时，请稍后重试或在账户面板切换模型；尚未生成图片。",
			),
		limits.connect,
	);
	const resetIdle = () => {
		clearTimeout(activity);
		activity = setTimeout(
			() =>
				expire(
					"文本模型长时间没有返回新内容，请稍后重试或切换模型；尚未生成图片。",
				),
			limits.idle,
		);
	};
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});
		resetIdle();
		if (
			!response.ok ||
			!response.headers.get("content-type")?.includes("text/event-stream")
		)
			return { response, data: await response.json() };
		if (!response.body) throw new Error("文本模型没有返回内容，请重试。");
		reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "",
			event = "",
			content = "",
			finish = "",
			done = false,
			bytes = 0;
		const dispatch = () => {
			if (!event) return;
			const data = event.trim();
			event = "";
			if (data === "[DONE]") {
				done = true;
				return;
			}
			const frame = JSON.parse(data);
			if (frame.error)
				throw new Error(
					frame.message ||
						(typeof frame.error === "string"
							? frame.error
							: frame.error.message) ||
						"文本模型返回错误。",
				);
			const choice = frame.choices?.find(
				(item: { index?: number }) => !item.index,
			);
			if (frame.id?.startsWith("chatcmpl-gate-") && choice?.delta?.content)
				throw new Error(String(choice.delta.content).slice(0, 600));
			if (typeof choice?.delta?.content === "string")
				content += choice.delta.content;
			if (choice?.finish_reason) finish = choice.finish_reason;
			if (content.trimStart().startsWith("⚠️"))
				throw new Error(content.slice(0, 600));
		};
		const consume = (text: string) => {
			buffer += text;
			let end = buffer.indexOf("\n");
			while (end >= 0 && !done) {
				const line = buffer.slice(0, end).replace(/\r$/, "");
				buffer = buffer.slice(end + 1);
				if (!line) dispatch();
				else if (line.startsWith("data:"))
					event += `${line.slice(5).trimStart()}\n`;
				end = buffer.indexOf("\n");
			}
		};
		while (!done) {
			const chunk = await reader.read();
			if (chunk.done) {
				consume(`${decoder.decode()}\n\n`);
				break;
			}
			resetIdle();
			bytes += chunk.value.byteLength;
			if (bytes > 2_000_000)
				throw new Error("故事规划输出过长，请减少分镜数量。");
			consume(decoder.decode(chunk.value, { stream: true }));
		}
		if (finish === "length")
			throw new Error("故事规划达到输出长度上限，请减少分镜数量后重试。");
		if (finish && finish !== "stop")
			throw new Error(`故事规划未正常完成（${finish}），请调整故事后重试。`);
		if (!done && finish !== "stop")
			throw new Error("故事规划连接中断，未收到完整结果；请检查后重试。");
		if (!content.trim()) throw new Error("文本模型未返回故事规划内容。");
		return { response, data: { choices: [{ message: { content } }] } };
	} catch (error) {
		if (external?.aborted) throw new Error("故事规划已取消，原有作品仍保留。");
		if (reason) throw new Error(reason);
		throw error;
	} finally {
		clearTimeout(total);
		clearTimeout(activity);
		external?.removeEventListener("abort", cancel);
		await reader?.cancel().catch(() => {});
	}
}
