"use client";

import { useEffect, useState } from "react";
import {
	COMIC_LAYOUTS,
	type ComicLayout,
	comicGeometry,
	comicLayout,
} from "@/lib/comicLayout";
import {
	comicPageCount,
	type RenderedComicPage,
	renderComicPage,
} from "@/lib/comicPageRenderer";
import type { ProjectData } from "@/types/project";

export function ComicLayoutChoices({
	value,
	onChange,
	zh,
	disabled = false,
}: {
	value: ComicLayout;
	onChange: (layout: ComicLayout) => void;
	zh: boolean;
	disabled?: boolean;
}) {
	return (
		<fieldset
			className="comic-layout-choices"
			aria-label={zh ? "漫画排版" : "Comic layout"}
		>
			{COMIC_LAYOUTS.map((item) => {
				const geometry = comicGeometry(item.id, 4);
				return (
					<button
						type="button"
						key={item.id}
						aria-pressed={value === item.id}
						disabled={disabled}
						onClick={() => onChange(item.id)}
					>
						<svg
							viewBox={`-32 -32 ${geometry.width + 64} ${geometry.height + 64}`}
							aria-hidden="true"
						>
							{geometry.frames.map((frame) => (
								<rect
									key={`${frame.x}-${frame.y}`}
									x={frame.x}
									y={frame.y}
									width={frame.width}
									height={frame.height}
								/>
							))}
						</svg>
						<span>
							<strong>{zh ? item.zh : item.en}</strong>
							<small>{zh ? item.detail : item.english}</small>
						</span>
					</button>
				);
			})}
		</fieldset>
	);
}
export function ComicPageComposer({
	project,
	zh,
	disabled = false,
	onLayout,
	onCaptions,
	onSelect,
}: {
	project: ProjectData;
	zh: boolean;
	disabled?: boolean;
	onLayout: (layout: ComicLayout) => void;
	onCaptions: (show: boolean) => void;
	onSelect?: (panel: number) => void;
}) {
	const [page, setPage] = useState(0);
	const [preview, setPreview] = useState<{
		url: string;
		frames: RenderedComicPage["frames"];
		width: number;
		height: number;
	} | null>(null);
	const [error, setError] = useState("");
	const [rendering, setRendering] = useState(false);
	const count = comicPageCount(project),
		current = Math.min(page, Math.max(0, count - 1));
	useEffect(() => {
		let active = true,
			url = "";
		setRendering(true);
		setError("");
		setPreview(null);
		const timer = setTimeout(() => {
			if (!count) {
				setRendering(false);
				return;
			}
			void renderComicPage(project, current)
				.then(async ({ canvas, frames }) => {
					const blob = await new Promise<Blob>((resolve, reject) =>
						canvas.toBlob(
							(value) =>
								value
									? resolve(value)
									: reject(new Error("无法预览 / Preview unavailable")),
							"image/png",
						),
					);
					if (!active) return;
					url = URL.createObjectURL(blob);
					setPreview({
						url,
						frames,
						width: canvas.width,
						height: canvas.height,
					});
				})
				.catch((cause) => {
					if (active)
						setError(
							cause instanceof Error
								? cause.message
								: "预览失败 / Preview failed",
						);
				})
				.finally(() => {
					if (active) setRendering(false);
				});
		}, 100);
		return () => {
			active = false;
			clearTimeout(timer);
			if (url) URL.revokeObjectURL(url);
		};
	}, [project, current, count]);
	return (
		<section
			className="comic-composer"
			aria-label={zh ? "漫画页面预览" : "Comic page preview"}
		>
			<div className="comic-composer-heading">
				<div>
					<h3>{zh ? "让画面有自己的节奏" : "Give your story a rhythm"}</h3>
					<p>
						{zh
							? "画框、图片比例与分页随版式自动安排。已有图片可直接重新排版。"
							: "Frames, image ratios and page breaks follow the layout automatically."}
					</p>
				</div>
				<span>{zh ? "无需重新生成" : "No regeneration needed"}</span>
			</div>
			<ComicLayoutChoices
				value={comicLayout(project)}
				onChange={onLayout}
				zh={zh}
				disabled={disabled}
			/>
			<div className="comic-page-toolbar">
				<label>
					<input
						type="checkbox"
						checked={project.studio?.comicCaptions === true}
						disabled={disabled}
						onChange={(event) => onCaptions(event.target.checked)}
					/>
					{zh ? "补充对白与旁白" : "Add dialogue & narration"}
				</label>
				<span>
					{zh
						? "图片已有气泡时保持关闭，避免文字重复。"
						: "Leave off when the image already includes lettering."}
				</span>
			</div>
			<div className="comic-proof" aria-busy={rendering}>
				{error ? (
					<p role="alert">{error}</p>
				) : preview ? (
					<div
						className="comic-proof-page"
						style={{ aspectRatio: `${preview.width}/${preview.height}` }}
					>
						<img
							src={preview.url}
							alt={
								zh
									? `第 ${current + 1} 页漫画排版预览`
									: `Comic layout preview, page ${current + 1}`
							}
						/>
						{onSelect &&
							preview.frames.map((frame) => (
								<button
									type="button"
									key={frame.panelNumber}
									disabled={disabled}
									aria-label={
										zh
											? `编辑第 ${frame.panelNumber} 格`
											: `Edit panel ${frame.panelNumber}`
									}
									onClick={() => onSelect(frame.panelNumber)}
									style={{
										left: `${(100 * frame.x) / preview.width}%`,
										top: `${(100 * frame.y) / preview.height}%`,
										width: `${(100 * frame.width) / preview.width}%`,
										height: `${(100 * frame.height) / preview.height}%`,
									}}
								>
									<span>{String(frame.panelNumber).padStart(2, "0")}</span>
								</button>
							))}
					</div>
				) : (
					<output>
						{rendering
							? zh
								? "正在排版…"
								: "Composing…"
							: zh
								? "生成图片后，这里会显示漫画页。"
								: "Your comic pages will appear here."}
					</output>
				)}
			</div>
			{count > 0 && (
				<div className="comic-page-navigation">
					<button
						type="button"
						disabled={current === 0 || disabled}
						onClick={() => setPage(current - 1)}
					>
						{zh ? "上一页" : "Previous"}
					</button>
					<span>
						{current + 1} / {count} ·{" "}
						{zh ? "预览与 PNG 导出一致" : "Matches PNG export"}
					</span>
					<button
						type="button"
						disabled={current >= count - 1 || disabled}
						onClick={() => setPage(current + 1)}
					>
						{zh ? "下一页" : "Next"}
					</button>
				</div>
			)}
		</section>
	);
}
