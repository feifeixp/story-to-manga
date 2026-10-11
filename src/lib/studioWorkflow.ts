import type { GeneratedPanel, StoryBreakdown } from "@/types";
export type StudioStep = 1 | 2 | 3 | 4;
export type ApiClient = <T>(
	path: string,
	body: unknown,
	signal?: AbortSignal,
) => Promise<T>;

let services: {
	api: ApiClient;
	imageSource: (source: string) => string;
} | null = null;

/** Installed by the standalone Market entry point; the Next.js app keeps its APIs. */
export function configureStudioServices(value: typeof services) {
	services = value;
}

/** No retries here: an uncertain paid request must not silently be submitted twice. */
export const requestStudioApi: ApiClient = async <T>(
	path: string,
	body: unknown,
	signal?: AbortSignal,
): Promise<T> => {
	if (services) return services.api<T>(path, body, signal);
	const controller = new AbortController();
	const abort = () => controller.abort();
	signal?.addEventListener("abort", abort, {
		once: true,
	});
	if (signal?.aborted) controller.abort();
	const timeout = setTimeout(abort, 180_000);
	try {
		const response = await fetch(path, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		const result: unknown = await response.json();
		if (
			!response.ok ||
			(typeof result === "object" &&
				result !== null &&
				"success" in result &&
				result.success === false)
		) {
			const message =
				typeof result === "object" &&
				result !== null &&
				"error" in result &&
				typeof result.error === "string"
					? result.error
					: `Request failed (${response.status})`;
			throw new Error(message);
		}
		return result as T;
	} catch (error) {
		if (controller.signal.aborted)
			throw new Error(
				"请求已中断或超时。已完成的内容仍保留，请检查后再重试。 / Request interrupted or timed out; completed work is kept.",
			);
		throw error;
	} finally {
		clearTimeout(timeout);
		signal?.removeEventListener("abort", abort);
	}
};
export function upsertPanel(
	panels: GeneratedPanel[],
	panel: GeneratedPanel,
): GeneratedPanel[] {
	if (!Number.isInteger(panel.panelNumber) || !panel.image?.trim())
		throw new Error("模型未返回有效图片 / The model returned no image");
	return [
		...panels.filter((item) => item.panelNumber !== panel.panelNumber),
		panel,
	].sort((a, b) => a.panelNumber - b.panelNumber);
}
export function pendingPanels(
	breakdown: StoryBreakdown | null,
	generated: GeneratedPanel[],
	stale: number[] = [],
) {
	const completed = new Set(
		generated
			.filter((panel) => panel.image && !stale.includes(panel.panelNumber))
			.map((panel) => panel.panelNumber),
	);
	return (
		breakdown?.panels.filter((panel) => !completed.has(panel.panelNumber)) ?? []
	);
}
export function validateBreakdown(value: StoryBreakdown): StoryBreakdown {
	if (
		!Array.isArray(value?.panels) ||
		value.panels.length === 0 ||
		value.panels.length > 50
	)
		throw new Error("分镜应为 1–50 格 / Expected 1–50 panels");
	const numbers = new Set<number>();
	for (const panel of value.panels) {
		if (
			!Number.isInteger(panel.panelNumber) ||
			panel.panelNumber < 1 ||
			numbers.has(panel.panelNumber) ||
			!panel.sceneDescription?.trim() ||
			!Array.isArray(panel.characters) ||
			(panel.characterStates !== undefined &&
				(!Array.isArray(panel.characterStates) ||
					panel.characterStates.length !== panel.characters.length ||
					new Set(panel.characterStates.map((state) => state?.name)).size !==
						panel.characterStates.length ||
					panel.characterStates.some(
						(state) =>
							!state ||
							!panel.characters.includes(state.name) ||
							typeof state.appearance !== "string" ||
							!state.appearance.trim(),
					)))
		)
			throw new Error("分镜格式无效，请重新拆解 / Invalid storyboard response");
		numbers.add(panel.panelNumber);
	}
	return {
		panels: [...value.panels].sort((a, b) => a.panelNumber - b.panelNumber),
	};
}

/** Pause is cooperative: retain the current response, then stop before another paid request. */
export async function generatePendingPanels(options: {
	breakdown: StoryBreakdown;
	generated: GeneratedPanel[];
	stale?: number[];
	shouldPause: () => boolean;
	generate: (
		panel: StoryBreakdown["panels"][number],
	) => Promise<GeneratedPanel>;
	onPanel: (panel: GeneratedPanel) => void | Promise<void>;
	onFailure: (panelNumber: number, error: unknown) => void;
}) {
	for (const panel of pendingPanels(
		options.breakdown,
		options.generated,
		options.stale,
	)) {
		if (options.shouldPause()) break;
		try {
			const result = await options.generate(panel);
			if (result?.panelNumber !== panel.panelNumber || !result.image?.trim())
				throw new Error(
					"模型返回的分镜编号或图片无效 / Invalid panel response",
				);
			await options.onPanel(result);
		} catch (error) {
			options.onFailure(panel.panelNumber, error);
			// Stop on a failure. Retrying or proceeding is an explicit user choice.
			break;
		}
	}
}

/** Reuse the existing proxy URL returned by Volcengine rather than proxying it twice. */
export function studioImageSource(source: string): string {
	if (services) return services.imageSource(source);
	if (source.startsWith("data:image/") || source.startsWith("blob:"))
		return source;
	if (source.startsWith("/api/image-proxy?")) return source;
	if (/^https?:\/\//.test(source))
		return `/api/image-proxy?url=${encodeURIComponent(source)}`;
	throw new Error("图片地址无效 / Invalid image URL");
}
