import { supportedComicRatio } from "@/lib/comicLayout";
import {
	createNeoWoWApi,
	parseJsonReply,
	validateAnalysis,
} from "../src/lib/neowowGeneration";
export { parseJsonReply, validateAnalysis };

import CryptoJS from "crypto-js/core";
import MD5 from "crypto-js/md5";
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
// Verified against the live NeoWoW image catalog. Language never selects a model.
export const PREFERRED_IMAGE_MODELS = [
	"gpt-image-2.5-flare",
	"gpt-image-2.5-sunburst",
] as const;
export function selectImageModel(models: ImageModel[], preference = "auto") {
	if (preference && !["auto", "nanobanana", "volcengine"].includes(preference))
		return models.find((model) => model.model_name === preference);
	return (
		PREFERRED_IMAGE_MODELS.map((id) =>
			models.find((model) => model.model_name === id),
		).find(Boolean) ||
		models.find((model) => model.is_default_design_model) ||
		models[0]
	);
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
// References must be public URLs. Signed upload URLs stay in memory only.
const uploaded = new Map<string, string>();
interface HostedReference {
	md5: string;
	url: string;
	until: number;
}
function reusableReferenceUrl(source: string) {
	try {
		const url = new URL(source);
		return (
			url.protocol === "https:" && !url.search && !url.username && !url.password
		);
	} catch {
		return false;
	}
}
async function referenceFingerprint(blob: Blob) {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const words: number[] = [];
	for (let i = 0; i < bytes.length; i++)
		words[i >>> 2] = (words[i >>> 2] || 0) | (bytes[i]! << (24 - (i % 4) * 8));
	// Match NeoWoW's content-deduplication key; MD5 is not used for authentication.
	return MD5(CryptoJS.lib.WordArray.create(words, bytes.length)).toString();
}
async function hostedReferences(token: string) {
	const key = `manga-neo-reference-${await accountTaskOwner(token)}`;
	let entries: HostedReference[] = [];
	try {
		const stored: unknown = JSON.parse(localStorage.getItem(key) || "[]");
		if (Array.isArray(stored))
			entries = stored
				.filter(
					(item): item is HostedReference =>
						item &&
						typeof item.md5 === "string" &&
						typeof item.url === "string" &&
						typeof item.until === "number" &&
						item.until > Date.now() &&
						reusableReferenceUrl(item.url),
				)
				.slice(-100);
	} catch {
		/* Cache access must not block an otherwise usable image. */
	}
	return { key, entries };
}
async function rememberReference(
	md5: string,
	source: string,
	url: string,
	token: string,
) {
	if (!reusableReferenceUrl(url)) return;
	assertWebToken(token);
	uploaded.set(`${token}\n${source}`, url);
	const { key, entries } = await hostedReferences(token);
	try {
		localStorage.setItem(
			key,
			JSON.stringify([
				...entries.filter((item) => item.md5 !== md5).slice(-99),
				{ md5, url, until: Date.now() + 7 * 24 * 60 * 60 * 1000 },
			]),
		);
	} catch {
		/* In-memory reuse still works if browser storage is full. */
	}
}
// Allow a slow uplink (~32 KiB/s) plus setup time, while keeping a finite cap.
function referenceUploadTimeout(bytes: number) {
	return Math.min(
		300_000,
		Math.max(120_000, 45_000 + Math.ceil(bytes / 32_768) * 1000),
	);
}
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
	let stage = "读取参考图";
	let size = "";
	try {
		const blob = await fetch(source, signal ? { signal } : {}).then((r) =>
			r.blob(),
		);
		size = `${(blob.size / 1024 / 1024).toFixed(1)} MB`;
		const extension = (
			{
				"image/png": "png",
				"image/jpeg": "jpg",
				"image/webp": "webp",
				"image/gif": "gif",
			} as Record<string, string>
		)[blob.type];
		if (!extension) throw new Error("参考图仅支持 PNG、JPEG、WebP 或 GIF。");
		const imageMd5 = await referenceFingerprint(blob);
		const known = (await hostedReferences(token)).entries.find(
			(item) => item.md5 === imageMd5,
		);
		assertWebToken(token);
		if (known) {
			uploaded.set(cacheKey, known.url);
			return known.url;
		}
		stage = "查询已有参考图";
		const existing = await mediaJson<{ imageUrl?: string } | null>(
			`/agent/image-record/query?imageMd5=${imageMd5}`,
			undefined,
			signal,
			token,
		);
		if (existing?.imageUrl?.startsWith("https://")) {
			await rememberReference(imageMd5, source, existing.imageUrl, token);
			return existing.imageUrl;
		}
		stage = "获取上传地址";
		const upload = await mediaJson<{
			uploadUrl: string;
			fileUrl: string;
			method?: string;
			requiredHeaders?: Record<string, string>;
		}>(
			"/agent/oss/upload-url",
			{ fileName: `${imageMd5}.${extension}`, bizType: "uploads" },
			signal,
			token,
		);
		const target = new URL(upload.uploadUrl);
		if (
			target.protocol !== "https:" ||
			!upload.fileUrl?.startsWith("https://") ||
			(upload.method && upload.method !== "PUT")
		)
			throw new Error("平台返回的上传地址无效。");
		// Match the official CLI's normalization for duplicated OSS bucket prefixes.
		const parts = target.hostname.split(".");
		if (
			parts[0] === parts[1] &&
			parts[2]?.startsWith("oss-") &&
			target.hostname.endsWith(".aliyuncs.com")
		) {
			parts.shift();
			target.hostname = parts.join(".");
		}
		assertWebToken(token);
		signal?.throwIfAborted();
		stage = "传输参考图";
		const uploadDeadline = AbortSignal.timeout(
			referenceUploadTimeout(blob.size),
		);
		const response = await fetch(target.href, {
			method: "PUT",
			body: blob,
			headers: { "Content-Type": blob.type, ...upload.requiredHeaders },
			signal: signal
				? AbortSignal.any([signal, uploadDeadline])
				: uploadDeadline,
		});
		if (!response.ok)
			throw new Error(`文件传输失败（HTTP ${response.status}）。`);
		stage = "登记参考图";
		await mediaJson(
			"/agent/image-record/save",
			{ imageMd5, imageUrl: upload.fileUrl },
			signal,
			token,
		);
		await rememberReference(imageMd5, source, upload.fileUrl, token);
		return upload.fileUrl;
	} catch (error) {
		if (signal?.aborted) throw error;
		if (
			error instanceof Error &&
			(error.name === "TimeoutError" ||
				/超时|timed?\s*out/i.test(error.message))
		)
			throw new Error(
				`参考图${stage === "传输参考图" ? "传输" : stage.replace("参考图", "")}超时${size ? `（${size}）` : ""}。本次尚未提交新的图片生成请求；已完成的画面已保留，请稍后继续。`,
			);
		throw new Error(
			`参考图上传失败（${stage}）：${error instanceof Error ? error.message : "请稍后重试"}`,
		);
	}
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
	const model = selectImageModel(models, modelName);
	if (!model) throw new Error("所选模型不可用，请在故事设置中重新选择。");
	ratio = supportedComicRatio(ratio, model.supported_aspect_ratios);
	if (refs.length && (model.max_reference_images || 0) < refs.length)
		throw new Error(
			`此模型最多支持 ${model.max_reference_images || 0} 张参考图；请选择支持更多参考图的模型或减少参考图。`,
		);
	// Send references one at a time so large files do not compete for the uplink.
	const imageUrls: string[] = [];
	for (const ref of refs)
		imageUrls.push(await referenceUrl(ref, signal, token));
	const body = {
		modelName: model.model_name,
		prompt,
		numImages: "1",
		aspectRatio: ratio,
		imageUrls,
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
				// Keep the platform URL for subsequent references instead of uploading
				// the freshly downloaded image back to the same platform.
				if (reusableReferenceUrl(url))
					await rememberReference(
						await referenceFingerprint(blob),
						image,
						url,
						token,
					);
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
