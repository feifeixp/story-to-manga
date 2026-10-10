import JSZip from "jszip";
import type { ProjectData } from "@/types/project";
import { studioImageSource } from "./studioWorkflow";

function filename(name: string) {
	return (name || "manga").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}
export function downloadBlob(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function downloadProject(project: ProjectData) {
	downloadBlob(
		new Blob(
			[
				JSON.stringify(
					{
						format: "story-to-manga",
						version: 1,
						project,
					},
					null,
					2,
				),
			],
			{
				type: "application/json",
			},
		),
		`${filename(project.metadata.name)}-project.json`,
	);
}
async function imageBlob(source: string): Promise<Blob> {
	const response = await fetch(studioImageSource(source), {
		signal: AbortSignal.timeout(60_000),
	});
	if (!response.ok)
		throw new Error(
			`图片下载失败 / Image download failed (${response.status})`,
		);
	const blob = await response.blob();
	if (!blob.type.startsWith("image/"))
		throw new Error("返回的文件不是图片 / Invalid image file");
	return blob;
}
export async function downloadImage(source: string, name: string) {
	const blob = await imageBlob(source);
	const extension = blob.type.includes("jpeg")
		? "jpg"
		: blob.type.includes("webp")
			? "webp"
			: "png";
	downloadBlob(blob, `${filename(name)}.${extension}`);
}
export async function exportPanels(project: ProjectData) {
	const zip = new JSZip();
	for (const panel of project.generatedPanels) {
		const blob = await imageBlob(panel.image);
		const extension = blob.type.includes("jpeg")
			? "jpg"
			: blob.type.includes("webp")
				? "webp"
				: "png";
		zip.file(
			`panels/panel-${String(panel.panelNumber).padStart(3, "0")}.${extension}`,
			blob,
		);
	}
	for (const character of project.characterReferences) {
		const blob = await imageBlob(character.image);
		zip.file(
			`characters/${filename(character.name)}.${blob.type.includes("jpeg") ? "jpg" : blob.type.includes("webp") ? "webp" : "png"}`,
			blob,
		);
	}
	zip.file(
		"project.json",
		JSON.stringify(
			{
				format: "story-to-manga",
				version: 1,
				project,
			},
			null,
			2,
		),
	);
	downloadBlob(
		await zip.generateAsync({
			type: "blob",
		}),
		`${filename(project.metadata.name)}.zip`,
	);
}
async function loadImage(source: string): Promise<HTMLImageElement> {
	const blob = await imageBlob(source);
	const url = URL.createObjectURL(blob);
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
}
function wrap(context: CanvasRenderingContext2D, value: string, width: number) {
	const lines: string[] = [];
	let line = "";
	for (const char of Array.from(value)) {
		if (char === "\n" || context.measureText(line + char).width > width) {
			lines.push(line);
			line = char === "\n" ? "" : char;
		} else line += char;
	}
	if (line) lines.push(line);
	return lines;
}
/** Bounded pages avoid browser canvas limits and export every panel, including >20-panel projects. */
export async function exportComicPages(project: ProjectData) {
	const zip = new JSZip();
	const panels = [...project.generatedPanels].sort(
		(a, b) => a.panelNumber - b.panelNumber,
	);
	for (let offset = 0; offset < panels.length; offset += 6) {
		const pagePanels = panels.slice(offset, offset + 6);
		const canvas = document.createElement("canvas");
		canvas.width = 1200;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("浏览器不支持图片导出 / Canvas unavailable");
		context.font = "600 28px sans-serif";
		const titles = wrap(context, project.metadata.name, 1080);
		const titleHeight = titles.length * 34 + 80;
		context.font = "22px sans-serif";
		const captions = pagePanels.map((panel) =>
			wrap(
				context,
				project.storyBreakdown?.panels.find(
					(item) => item.panelNumber === panel.panelNumber,
				)?.dialogue || "",
				510,
			),
		);
		const rowHeights: number[] = [];
		for (let i = 0; i < pagePanels.length; i += 2)
			rowHeights.push(
				455 +
					Math.max(captions[i]?.length || 0, captions[i + 1]?.length || 0) * 30,
			);
		canvas.height =
			titleHeight + rowHeights.reduce((sum, height) => sum + height, 0) + 60;
		context.fillStyle = "#fffdf7";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = "#233237";
		context.font = "600 28px sans-serif";
		titles.forEach((line, index) => {
			context.fillText(line, 45, 48 + index * 34);
		});
		let y = titleHeight;
		for (let i = 0; i < pagePanels.length; i++) {
			const panel = pagePanels[i];
			if (!panel) continue;
			const image = await loadImage(panel.image);
			const x = 45 + (i % 2) * 565;
			const scale = Math.min(535 / image.width, 400 / image.height);
			context.fillStyle = "#edf0eb";
			context.fillRect(x, y, 535, 400);
			context.drawImage(
				image,
				x + (535 - image.width * scale) / 2,
				y + (400 - image.height * scale) / 2,
				image.width * scale,
				image.height * scale,
			);
			context.fillStyle = "#233237";
			context.font = "22px sans-serif";
			captions[i]?.forEach((line, index) => {
				context.fillText(line, x + 12, y + 435 + index * 30);
			});
			if (i % 2 === 1) y += rowHeights[Math.floor(i / 2)] || 455;
		}
		context.font = "14px sans-serif";
		context.fillText(
			`STORY TO MANGA · ${Math.floor(offset / 6) + 1} / ${Math.ceil(panels.length / 6)}`,
			45,
			canvas.height - 24,
		);
		const blob = await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob(
				(value) =>
					value
						? resolve(value)
						: reject(new Error("PNG 导出失败 / PNG export failed")),
				"image/png",
			),
		);
		if (panels.length <= 6) {
			downloadBlob(blob, `${filename(project.metadata.name)}.png`);
			return;
		}
		zip.file(
			`page-${String(Math.floor(offset / 6) + 1).padStart(3, "0")}.png`,
			blob,
		);
	}
	downloadBlob(
		await zip.generateAsync({
			type: "blob",
		}),
		`${filename(project.metadata.name)}-pages.zip`,
	);
}
