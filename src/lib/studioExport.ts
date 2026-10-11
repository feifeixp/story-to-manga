import JSZip from "jszip";
import type { ProjectData } from "@/types/project";
import { comicPageCount, renderComicPage } from "./comicPageRenderer";
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
/** Render and export the exact same pages shown in the composer. */
export async function exportComicPages(project: ProjectData) {
	const count = comicPageCount(project);
	if (!count || !project.generatedPanels.length)
		throw new Error("请先生成图片 / Generate images before exporting");
	const zip = new JSZip();
	for (let page = 0; page < count; page++) {
		const { canvas } = await renderComicPage(project, page);
		const blob = await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob(
				(value) =>
					value
						? resolve(value)
						: reject(new Error("PNG 导出失败 / PNG export failed")),
				"image/png",
			),
		);
		if (count === 1) {
			downloadBlob(blob, `${filename(project.metadata.name)}.png`);
			return;
		}
		zip.file(`page-${String(page + 1).padStart(3, "0")}.png`, blob);
	}
	downloadBlob(
		await zip.generateAsync({ type: "blob" }),
		`${filename(project.metadata.name)}-pages.zip`,
	);
}
