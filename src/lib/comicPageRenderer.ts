import type { ProjectData } from "@/types/project";
import {
	type ComicFrame,
	comicCrop,
	comicGeometry,
	comicLayout,
	comicPanelNumbers,
	panelsPerPage,
} from "./comicLayout";
import { studioImageSource } from "./studioWorkflow";

const images = new Map<string, Promise<HTMLImageElement>>();
async function loadImage(source: string) {
	let pending = images.get(source);
	if (!pending) {
		pending = (async () => {
			const response = await fetch(studioImageSource(source), {
				signal: AbortSignal.timeout(60_000),
			});
			if (!response.ok)
				throw new Error(
					`图片读取失败 / Image download failed (${response.status})`,
				);
			const blob = await response.blob(),
				url = URL.createObjectURL(blob);
			try {
				const image = new Image();
				await new Promise<void>((resolve, reject) => {
					image.onload = () => resolve();
					image.onerror = () =>
						reject(new Error("无法读取图片 / Could not decode image"));
					image.src = url;
				});
				return image;
			} finally {
				URL.revokeObjectURL(url);
			}
		})();
		images.set(source, pending);
		if (images.size > 12) images.delete(images.keys().next().value!);
		pending.catch(() => {
			if (images.get(source) === pending) images.delete(source);
		});
	}
	return pending;
}
export function comicTextLines(
	context: Pick<CanvasRenderingContext2D, "measureText">,
	value: string,
	width: number,
) {
	const lines: string[] = [];
	let line = "";
	for (const char of Array.from(value)) {
		if (
			char === "\n" ||
			(line && context.measureText(line + char).width > width)
		) {
			lines.push(line);
			line = char === "\n" ? "" : char;
		} else line += char;
	}
	if (line) lines.push(line);
	return lines;
}
export function comicPageCount(project: ProjectData) {
	return Math.ceil(
		comicPanelNumbers(project).length / panelsPerPage(comicLayout(project)),
	);
}
export interface RenderedComicPage {
	canvas: HTMLCanvasElement;
	frames: (ComicFrame & { panelNumber: number })[];
}
/** Preview and PNG export call this same renderer, including lettering and crops. */
export async function renderComicPage(
	project: ProjectData,
	page: number,
): Promise<RenderedComicPage> {
	const layout = comicLayout(project),
		capacity = panelsPerPage(layout);
	const numbers = comicPanelNumbers(project).slice(
		page * capacity,
		(page + 1) * capacity,
	);
	const geometry = comicGeometry(layout, numbers.length);
	const artwork = await Promise.all(
		numbers.map((n) => {
			const source = project.generatedPanels.find(
				(p) => p.panelNumber === n,
			)?.image;
			return source ? loadImage(source) : Promise.resolve(null);
		}),
	);
	await document.fonts?.ready;
	const canvas = document.createElement("canvas"),
		ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("浏览器不支持图片导出 / Canvas unavailable");
	canvas.width = 1200;
	ctx.font = '700 38px "Songti SC", "Noto Serif CJK SC", serif';
	const title = comicTextLines(ctx, project.metadata.name, 1104);
	const top = 86 + title.length * 48;
	ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
	const captions = numbers.map((n, i) =>
		project.studio?.comicCaptions
			? comicTextLines(
					ctx,
					project.storyBreakdown?.panels.find((p) => p.panelNumber === n)
						?.dialogue || "",
					geometry.frames[i]!.width - 32,
				)
			: [],
	);
	// Adapt older wide images to their row, instead of severely cropping them into tall cells.
	// New images already match the geometry's aspect ratios and need no large adjustment.
	const frames: (ComicFrame & { panelNumber: number })[] = [];
	let y = top;
	for (const rowY of [...new Set(geometry.frames.map((frame) => frame.y))]) {
		const row = geometry.frames
			.map((frame, i) => ({ frame, i }))
			.filter((item) => item.frame.y === rowY);
		const originalHeight = row[0]!.frame.height;
		const safeHeight = Math.min(
			originalHeight,
			...row.map(({ frame, i }) =>
				artwork[i]
					? frame.width / (artwork[i]!.width / artwork[i]!.height) / 0.8
					: originalHeight,
			),
		);
		const imageHeight = Math.max(
			Math.min(200, originalHeight),
			Math.round(safeHeight),
		);
		const captionHeight = Math.max(
			...row.map(({ i }) =>
				captions[i]!.length ? captions[i]!.length * 32 + 28 : 0,
			),
		);
		for (const { frame, i } of row)
			frames.push({
				...frame,
				x: frame.x + 48,
				y,
				width: frame.width,
				height: imageHeight + captionHeight,
				panelNumber: numbers[i]!,
			});
		y += imageHeight + captionHeight + (layout === "webtoon" ? 82 : 16);
	}
	if (y > 12_000)
		throw new Error(
			"这一页的对白过长，请精简后导出 / Too much dialogue on one page",
		);
	canvas.height = y + (layout === "webtoon" ? -82 : -16) + 68;
	ctx.fillStyle = "#fffdf8";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "#7b7b70";
	ctx.font = "500 16px sans-serif";
	ctx.fillText("STORY TO MANGA", 48, 36);
	ctx.fillStyle = "#202722";
	ctx.font = '700 38px "Songti SC", "Noto Serif CJK SC", serif';
	title.forEach((line, i) => {
		ctx.fillText(line, 48, 82 + i * 48);
	});
	for (let i = 0; i < frames.length; i++) {
		const frame = frames[i]!,
			image = artwork[i];
		const lines = captions[i]!;
		const imageHeight =
			frame.height - (lines.length ? lines.length * 32 + 28 : 0);
		ctx.fillStyle = "#fff";
		ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
		if (image) {
			const crop = comicCrop(
				image.width,
				image.height,
				frame.width,
				imageHeight,
			);
			ctx.drawImage(
				image,
				crop.x,
				crop.y,
				crop.width,
				crop.height,
				frame.x,
				frame.y,
				frame.width,
				imageHeight,
			);
		} else {
			ctx.fillStyle = "#f0f0e9";
			ctx.fillRect(frame.x, frame.y, frame.width, imageHeight);
			ctx.fillStyle = "#73796f";
			ctx.font = "24px sans-serif";
			ctx.fillText(
				`第 ${frame.panelNumber} 格 · 尚未生成 / Not generated`,
				frame.x + 20,
				frame.y + 50,
				frame.width - 40,
			);
		}
		ctx.strokeStyle = "#202722";
		ctx.lineWidth = 3;
		ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);
		if (lines.length) {
			ctx.fillStyle = "#202722";
			ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
			lines.forEach((line, j) => {
				ctx.fillText(line, frame.x + 16, frame.y + imageHeight + 34 + j * 32);
			});
		}
	}
	ctx.fillStyle = "#686e65";
	ctx.font = "18px sans-serif";
	ctx.textAlign = "right";
	ctx.fillText(
		`${String(page + 1).padStart(2, "0")} / ${String(comicPageCount(project)).padStart(2, "0")}`,
		1152,
		canvas.height - 24,
	);
	return { canvas, frames };
}
