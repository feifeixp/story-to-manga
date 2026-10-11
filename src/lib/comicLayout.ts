import type { ImageSizeConfig, ProjectData } from "@/types/project";

export type ComicLayout = "manga" | "cinema" | "classic" | "webtoon";
export const COMIC_LAYOUTS = [
	{
		id: "manga",
		zh: "叙事分镜",
		en: "Story manga",
		detail: "大景开场 · 错落分格",
		english: "Wide openings, varied frames",
	},
	{
		id: "cinema",
		zh: "电影宽幅",
		en: "Cinematic",
		detail: "宽屏镜头 · 连贯叙事",
		english: "Wide shots, cinematic pacing",
	},
	{
		id: "classic",
		zh: "经典分格",
		en: "Classic",
		detail: "清晰分格 · 稳定阅读",
		english: "Balanced, clear reading order",
	},
	{
		id: "webtoon",
		zh: "纵向条漫",
		en: "Webtoon",
		detail: "纵向展开 · 留白停顿",
		english: "Vertical flow, room to pause",
	},
] as const;
export function comicLayout(project: ProjectData): ComicLayout {
	const value = project.studio?.comicLayout;
	return COMIC_LAYOUTS.some((item) => item.id === value) ? value! : "manga";
}
export function panelsPerPage(layout: ComicLayout) {
	return layout === "cinema" || layout === "webtoon" ? 4 : 6;
}
export function comicPanelNumbers(project: ProjectData): number[] {
	return [
		...new Set([
			...(project.storyBreakdown?.panels.map((p) => p.panelNumber) || []),
			...project.generatedPanels.map((p) => p.panelNumber),
		]),
	].sort((a, b) => a - b);
}
export interface ComicFrame {
	x: number;
	y: number;
	width: number;
	height: number;
}
export interface ComicGeometry {
	width: number;
	height: number;
	frames: ComicFrame[];
}
/** One geometry defines both generation aspect ratios and final page composition. */
export function comicGeometry(
	layout: ComicLayout,
	count: number,
): ComicGeometry {
	if (!Number.isInteger(count) || count < 1 || count > panelsPerPage(layout))
		throw new Error("Invalid comic page size");
	const width = 1104,
		gap = layout === "webtoon" ? 82 : 16;
	let rows: { weights: number[]; height: number }[];
	if (layout === "manga") {
		const templates: Record<number, { weights: number[]; height: number }[]> = {
			1: [{ weights: [1], height: 0.72 }],
			2: [
				{ weights: [1], height: 0.48 },
				{ weights: [1], height: 0.66 },
			],
			3: [
				{ weights: [1], height: 0.46 },
				{ weights: [0.6, 0.4], height: 0.66 },
			],
			4: [
				{ weights: [1], height: 0.43 },
				{ weights: [0.6, 0.4], height: 0.55 },
				{ weights: [1], height: 0.5 },
			],
			5: [
				{ weights: [0.6, 0.4], height: 0.52 },
				{ weights: [1], height: 0.46 },
				{ weights: [0.42, 0.58], height: 0.52 },
			],
			6: [
				{ weights: [1], height: 0.38 },
				{ weights: [0.6, 0.4], height: 0.45 },
				{ weights: [0.42, 0.58], height: 0.45 },
				{ weights: [1], height: 0.43 },
			],
		};
		rows = templates[count]!;
	} else if (layout === "classic") {
		rows = Array.from({ length: Math.ceil(count / 2) }, (_, row) => ({
			weights: row * 2 + 1 < count ? [0.5, 0.5] : [1],
			height: 0.49,
		}));
	} else {
		rows = Array.from({ length: count }, (_, i) => ({
			weights: [1],
			height:
				layout === "webtoon"
					? i === count - 1
						? 0.82
						: 0.67
					: i === count - 1
						? 0.56
						: 0.43,
		}));
	}
	let y = 0;
	const frames: ComicFrame[] = [];
	for (const row of rows) {
		let x = 0;
		const height = Math.round(width * row.height);
		for (const weight of row.weights) {
			const frameWidth = (width - gap * (row.weights.length - 1)) * weight;
			frames.push({ x, y, width: frameWidth, height });
			x += frameWidth + gap;
		}
		y += height + gap;
	}
	return { width, height: y - gap, frames };
}
export function panelImageSize(
	project: ProjectData,
	panelNumber: number,
): ImageSizeConfig {
	const layout = comicLayout(project),
		capacity = panelsPerPage(layout);
	let numbers = comicPanelNumbers(project);
	if (!numbers.length)
		numbers = Array.from(
			{ length: project.studio?.requestedPanelCount || 4 },
			(_, i) => i + 1,
		);
	const index = Math.max(0, numbers.indexOf(panelNumber)),
		offset = Math.floor(index / capacity) * capacity;
	const frame = comicGeometry(
		layout,
		Math.min(capacity, numbers.length - offset),
	).frames[index % capacity]!;
	const target = frame.width / frame.height;
	const ratios = [
		[21, 9],
		[16, 9],
		[4, 3],
		[1, 1],
		[3, 4],
		[9, 16],
	] as const;
	const [w, h] = ratios.reduce((best, next) =>
		Math.abs(Math.log(next[0] / next[1] / target)) <
		Math.abs(Math.log(best[0] / best[1] / target))
			? next
			: best,
	);
	const scale = 1920 / Math.max(w, h);
	return {
		width: Math.round(w * scale),
		height: Math.round(h * scale),
		aspectRatio: `${w}:${h}`,
		volcEngineSize: "2K",
	};
}
/** Center-fill without distortion; a modest top bias protects faces in older wide frames. */
export function comicCrop(
	imageWidth: number,
	imageHeight: number,
	width: number,
	height: number,
) {
	const scale = Math.max(width / imageWidth, height / imageHeight);
	const sw = width / scale,
		sh = height / scale;
	return {
		x: (imageWidth - sw) / 2,
		y: (imageHeight - sh) * 0.35,
		width: sw,
		height: sh,
	};
}
/** Select the closest model-supported ratio; the page layout stays authoritative. */
export function supportedComicRatio(target: string, supported?: string[]) {
	if (!supported?.length || supported.includes(target)) return target;
	const numeric = (ratio: string) => {
		const [w, h] = ratio.split(":").map(Number);
		return w && h && w > 0 && h > 0 ? w / h : NaN;
	};
	const wanted = numeric(target),
		valid = supported.filter((value) => Number.isFinite(numeric(value)));
	if (!Number.isFinite(wanted) || !valid.length)
		throw new Error("模型没有可用的画幅比例 / No supported image ratio");
	return valid.reduce((best, next) =>
		Math.abs(Math.log(numeric(next) / wanted)) <
		Math.abs(Math.log(numeric(best) / wanted))
			? next
			: best,
	);
}
