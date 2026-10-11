import {
	createNeoWoWApi,
	parseJsonReply,
	validateAnalysis,
} from "../src/lib/neowowGeneration";
export { parseJsonReply, validateAnalysis };

import { PLANNING_SYSTEM } from "../src/lib/mangaPrompts";
import type { ApiClient } from "../src/lib/studioWorkflow";
import { assertWebToken, PLATFORM, requireWebToken } from "./auth";
import { planningJson } from "./planning";

export interface ImageModel {
	model_name: string;
	model_display_name?: string;
	max_reference_images?: number;
	supported_aspect_ratios?: string[];
	is_default_design_model?: boolean;
	points_cost_per_image?: number;
}
interface GatewayResponse {
	success?: boolean;
	error?: string | { message?: string };
	message?: string;
	errMessage?: string;
	errCode?: string;
	data?: unknown;
}
function message(data: GatewayResponse, status: number) {
	const error =
		typeof data.error === "string" ? data.error : data.error?.message;
	return (
		data.errMessage || data.message || error || `NeoWoW 请求失败 (${status})`
	);
}
export const CODING_PLAN_PATH = "/api/me/chat/completions";
// Exact IDs verified against the NeoWoW Coding Plan catalog on 2026-10-11.
export const PLANNING_MODELS = [
	{ id: "doubao-seed-2-1-pro-260915", name: "豆包 2.1 Pro" },
	{ id: "kimi-k3", name: "Kimi K3" },
] as const;
export const PLANNING_MODEL = PLANNING_MODELS[0].id;
const PLANNING_MODEL_KEY = "manga-neo-planning-model";
export function getPlanningModel(): string {
	try {
		const selected = localStorage.getItem(PLANNING_MODEL_KEY);
		return (
			PLANNING_MODELS.find((model) => model.id === selected)?.id ||
			PLANNING_MODEL
		);
	} catch {
		return PLANNING_MODEL;
	}
}
export function setPlanningModel(model: string) {
	if (!PLANNING_MODELS.some((option) => option.id === model))
		throw new Error("请选择豆包 2.1 Pro 或 Kimi K3。");
	localStorage.setItem(PLANNING_MODEL_KEY, model);
}
// Method 2: the platform's existing CORS gateway forwards these paths to
// https://neowow.cn/agent. No application backend, ECS or CLI credentials.
export const MEDIA_GATEWAY = `${PLATFORM}/neo-api`;
export const IMAGE_POLL_INTERVAL = 3000;
export const IMAGE_POLL_TIMEOUT = 180_000;
class NeoApiError extends Error {
	constructor(
		message: string,
		readonly rejected: boolean,
	) {
		super(message);
	}
}
export async function platformJson<T>(
	path: string,
	body?: unknown,
	signal?: AbortSignal,
	token = requireWebToken(),
): Promise<T> {
	assertWebToken(token);
	if (path !== CODING_PLAN_PATH && !path.startsWith("/neo-api/agent/"))
		throw new Error("不支持的 NeoWoW 接口。");
	const headers: Record<string, string> = path.startsWith("/api/")
		? { Authorization: `Bearer ${token}` }
		: { accessToken: token };
	if (body !== undefined) headers["Content-Type"] = "application/json";
	const timeout =
		path === CODING_PLAN_PATH
			? undefined
			: AbortSignal.timeout(body === undefined ? 15_000 : 60_000);
	const combined = timeout
		? signal
			? AbortSignal.any([signal, timeout])
			: timeout
		: signal;
	let response: Response;
	let payload: unknown;
	try {
		const options = {
			method: body === undefined ? "GET" : "POST",
			headers,
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		};
		if (path === CODING_PLAN_PATH) {
			const result = await planningJson(`${PLATFORM}${path}`, {
				...options,
				signal: signal ?? null,
			});
			response = result.response;
			payload = result.data;
		} else {
			response = await fetch(`${PLATFORM}${path}`, {
				...options,
				signal: combined ?? null,
			});
			payload = await response.json();
		}
	} catch (error) {
		if (timeout?.aborted && !signal?.aborted)
			throw new NeoApiError(
				"NeoWoW 响应超时。已有任务已保留，请稍后继续查询。",
				false,
			);
		throw error;
	}
	const data = payload as GatewayResponse;
	assertWebToken(token);
	if (!data || typeof data !== "object")
		throw new NeoApiError("NeoWoW 返回格式异常，请查看平台任务记录。", false);
	if (!response.ok || data.success === false) {
		const detail = message(data, response.status);
		const auth =
			response.status === 401 ||
			["2001", "2002", "2003"].includes(String(data.errCode));
		const upstreamBalance =
			path === CODING_PLAN_PATH &&
			/insufficient[\s_]+(?:user[\s_]+)?balance/i.test(detail);
		throw new NeoApiError(
			auth
				? "NeoWoW 登录已过期，请重新关联账户。"
				: upstreamBalance
					? `文本模型服务返回余额不足，图片积分与 Coding Plan 额度分别计费。请联系 NeoWoW 检查上游模型账户。详情：${detail}`
					: detail,
			data.success === false ||
				[400, 401, 403, 422, 429].includes(response.status),
		);
	}
	return data as T;
}
export function unwrapMedia<T>(value: T | { data: T }): T {
	return value && typeof value === "object" && "data" in value
		? value.data
		: (value as T);
}
export async function mediaJson<T>(
	path: string,
	body?: unknown,
	signal?: AbortSignal,
	token = requireWebToken(),
): Promise<T> {
	return unwrapMedia(
		await platformJson<T | { data: T }>(`/neo-api${path}`, body, signal, token),
	);
}
const modelCache = new Map<string, { until: number; models: ImageModel[] }>();
export function clearModelCache() {
	modelCache.clear();
}
export async function listModels(
	signal?: AbortSignal,
	token = requireWebToken(),
): Promise<ImageModel[]> {
	assertWebToken(token);
	const cached = modelCache.get(token);
	if (cached && cached.until > Date.now()) return cached.models;
	const result = await mediaJson<ImageModel[]>(
		"/agent/ai-image-generation/models/by-scenario?scenarioType=1",
		undefined,
		signal,
		token,
	);
	if (!Array.isArray(result))
		throw new Error("未能获取 NeoWoW 图像模型列表，请重新关联后刷新。");
	const models = result.filter((m) => m && typeof m.model_name === "string");
	modelCache.clear();
	modelCache.set(token, { until: Date.now() + 60_000, models });
	return models;
}
export async function getBalance(signal?: AbortSignal) {
	const data = await mediaJson<{ totalAvailablePoints?: number | string }>(
		"/agent/user/points/info",
		undefined,
		signal,
	);
	const balance = Number(data?.totalAvailablePoints);
	if (data?.totalAvailablePoints == null || !Number.isFinite(balance))
		throw new Error("平台暂未返回可用积分。");
	return balance;
}
async function plan<T>(
	instruction: string,
	body: unknown,
	signal?: AbortSignal,
	token = requireWebToken(),
	model = getPlanningModel(),
): Promise<T> {
	const result = await platformJson<{
		choices?: { message?: { content?: string } }[];
		content?: { text?: string }[];
	}>(
		CODING_PLAN_PATH,
		{
			model,
			stream: true,
			messages: [
				{
					role: "system",
					content: PLANNING_SYSTEM,
				},
				{
					role: "user",
					content: `${instruction}\nInput JSON:\n${JSON.stringify(body)}`,
				},
			],
			max_tokens: 8192,
		},
		signal,
		token,
	);
	return parseJsonReply<T>(
		result.choices?.[0]?.message?.content || result.content?.[0]?.text || "",
	);
}
export function imageSource(source: string) {
	if (source.startsWith("data:image/") || source.startsWith("blob:"))
		return source;
	const url = new URL(source);
	if (url.protocol !== "https:") throw new Error("图片链接必须使用 HTTPS。");
	if (url.hostname === "neowow.oss-cn-hangzhou.aliyuncs.com")
		return `${PLATFORM}/oss${url.pathname}${url.search}`;
	return url.href;
}
// References must be public URLs; STS stays in memory and is never backed up.
const uploaded = new Map<string, string>();
export async function referenceUrl(
	source: string,
	signal?: AbortSignal,
	token = requireWebToken(),
): Promise<string> {
	assertWebToken(token);
	if (source.startsWith("https://")) return source;
	if (!source.startsWith("data:image/")) throw new Error("无效的参考图片。");
	const cacheKey = `${token}\n${source}`;
	const cached = uploaded.get(cacheKey);
	if (cached) return cached;
	const blob = await fetch(source, signal ? { signal } : {}).then((r) =>
		r.blob(),
	);
	const result = await platformJson<{
		data: {
			accessKeyId: string;
			accessKeySecret: string;
			securityToken: string;
			bucketName: string;
		};
	}>("/neo-api/agent/sts/oss/token", undefined, signal, token);
	const { default: OSS } = await import("ali-oss/dist/aliyun-oss-sdk.min.js");
	signal?.throwIfAborted();
	const data = result.data;
	const client = new OSS({
		region: "oss-cn-shanghai",
		bucket: data.bucketName,
		accessKeyId: data.accessKeyId,
		accessKeySecret: data.accessKeySecret,
		stsToken: data.securityToken,
		secure: true,
	});
	const extension = blob.type.includes("jpeg")
		? "jpg"
		: blob.type.includes("webp")
			? "webp"
			: "png";
	const upload = await client.put(
		`story-to-manga/${crypto.randomUUID()}.${extension}`,
		blob,
	);
	const url = upload.url.replace(/^http:/, "https:");
	uploaded.set(cacheKey, url);
	return url;
}
export interface PendingTask {
	taskCode?: string;
	model: string;
	owner: string;
	created: number;
	uncertain?: boolean;
}
export async function accountTaskOwner(token = requireWebToken()) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	return Array.from(new Uint8Array(digest), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");
}
export async function uncertainTasks() {
	const owner = await accountTaskOwner();
	const result: { key: string; model: string }[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (!key?.startsWith("manga-neo-task-")) continue;
		try {
			const task = JSON.parse(localStorage.getItem(key) || "null");
			if (task?.owner === owner && task.uncertain)
				result.push({ key, model: task.model });
		} catch {
			/* Ignore malformed entries. */
		}
	}
	return result;
}
export async function releaseUncertainTask(key: string) {
	if (!(await uncertainTasks()).some((task) => task.key === key))
		throw new Error("任务不属于当前账户。");
	localStorage.removeItem(key);
}

export function taskStoreKey(
	userToken: string,
	request: unknown,
): Promise<string> {
	return crypto.subtle
		.digest(
			"SHA-256",
			new TextEncoder().encode(JSON.stringify([userToken, request])),
		)
		.then(
			(buffer) =>
				`manga-neo-task-${Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("")}`,
		);
}
async function sleep(ms: number, signal: AbortSignal) {
	await new Promise<void>((resolve, reject) => {
		const abort = () => {
			clearTimeout(timer);
			reject(new Error("已停止等待；再次生成会先查询已有任务。"));
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", abort);
			resolve();
		}, ms);
		signal.addEventListener("abort", abort, { once: true });
		if (signal.aborted) abort();
	});
}
export async function generateImage(
	prompt: string,
	modelName: string,
	ratio: string,
	refs: string[],
	signal: AbortSignal,
	token = requireWebToken(),
): Promise<string> {
	assertWebToken(token);
	const models = await listModels(signal, token);
	const model =
		!modelName || ["auto", "nanobanana", "volcengine"].includes(modelName)
			? models.find((m) => m.is_default_design_model) || models[0]
			: models.find((m) => m.model_name === modelName);
	if (!model) throw new Error("所选模型不可用，请在故事设置中重新选择。");
	if (
		model.supported_aspect_ratios?.length &&
		!model.supported_aspect_ratios.includes(ratio)
	)
		throw new Error(`所选模型不支持 ${ratio}，请更换画幅或模型。`);
	if (refs.length && (model.max_reference_images || 0) < refs.length)
		throw new Error(
			`此模型最多支持 ${model.max_reference_images || 0} 张参考图；请选择支持更多参考图的模型或减少参考图。`,
		);
	const body = {
		modelName: model.model_name,
		prompt,
		numImages: "1",
		aspectRatio: ratio,
		imageUrls: await Promise.all(
			refs.map((ref) => referenceUrl(ref, signal, token)),
		),
	};
	const key = await taskStoreKey(token, body);
	let pending: PendingTask | null = JSON.parse(
		localStorage.getItem(key) || "null",
	) as PendingTask | null;
	if (pending?.uncertain)
		throw new Error(
			"上次提交结果不确定，已阻止重复扣费。请在关联面板查看 NeoWoW 记录，核对后再允许新任务。",
		);
	if (!pending?.taskCode) {
		pending = {
			model: model.model_name,
			owner: await accountTaskOwner(token),
			created: Date.now(),
			uncertain: true,
		};
		// Record intent BEFORE a paid request; never automatically resubmit an uncertain response.
		localStorage.setItem(key, JSON.stringify(pending));
		try {
			const submitted = await mediaJson<{
				task_code?: string;
				taskCode?: string;
			}>("/agent/ai-image-generation/generate", body, signal, token);
			const taskCode = submitted.task_code || submitted.taskCode;
			if (!taskCode)
				throw new Error("提交结果缺少任务编号，请先查看 NeoWoW 任务记录。");
			pending = { ...pending, taskCode, uncertain: false };
			localStorage.setItem(key, JSON.stringify(pending));
		} catch (error) {
			if (error instanceof NeoApiError && error.rejected)
				localStorage.removeItem(key);
			throw error;
		}
	}
	const deadline = Date.now() + IMAGE_POLL_TIMEOUT;
	while (Date.now() < deadline) {
		signal.throwIfAborted();
		const result = await mediaJson<{
			status?: string;
			image_urls?: string[];
			urls?: string[];
			failure_reason?: string;
		}>(
			`/agent/ai-image-generation/result/${encodeURIComponent(pending.taskCode!)}`,
			undefined,
			signal,
			token,
		);
		const status = result.status?.toUpperCase();
		if (status === "SUCCESS" || status === "FINISHED") {
			const url = result.image_urls?.[0] || result.urls?.[0];
			if (!url)
				throw new Error("任务完成但没有返回图片，请检查 NeoWoW 任务记录。");
			// Keep successful task ID until the image is cached; refresh resumes without paying twice.
			try {
				const response = await fetch(imageSource(url), {
					signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
				});
				if (!response.ok) throw new Error("图片保存失败");
				const blob = await response.blob();
				if (!blob.type.startsWith("image/"))
					throw new Error("返回的文件不是图片");
				const image = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => resolve(String(reader.result));
					reader.onerror = () => reject(new Error("图片保存失败"));
					reader.readAsDataURL(blob);
				});
				localStorage.removeItem(key);
				return image;
			} catch (error) {
				if (signal.aborted) throw error;
				// Preserve original result even if the source doesn't allow CORS downloads.
				// The export action will show the source's download error; never resubmit here.
				localStorage.removeItem(key);
				return url;
			}
		}
		if (status === "FAILED") {
			localStorage.removeItem(key);
			throw new Error(result.failure_reason || "NeoWoW 图片生成失败。");
		}
		if (!["PENDING", "RUNNING", "PROCESSING", "QUEUED"].includes(status || ""))
			throw new Error(
				"平台未返回有效任务状态。任务编号已保留，请稍后继续查询。",
			);
		await sleep(IMAGE_POLL_INTERVAL, signal);
	}
	throw new Error(
		"已等待 3 分钟，任务仍在排队或处理中。再次点击会继续查询原任务，不会自动重复提交。",
	);
}
export const requestMarketApi: ApiClient = async <T>(
	path: string,
	body: unknown,
	signal?: AbortSignal,
): Promise<T> => {
	const token = requireWebToken();
	const model = getPlanningModel();
	return createNeoWoWApi({
		plan: <R>(instruction: string, raw: unknown, abort?: AbortSignal) =>
			plan<R>(instruction, raw, abort, token, model),
		image: (prompt, model, ratio, refs, abort) =>
			generateImage(prompt, model, ratio, refs, abort, token),
	})<T>(path, body, signal);
};
