"use client";

import html2canvas from "html2canvas";
import JSZip from "jszip";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useTranslation } from "react-i18next";
import ImageUpload from "@/components/ImageUpload";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
	trackDownload,
	trackError,
	trackEvent,
	trackMangaGeneration,
	trackPerformance,
} from "@/lib/analytics";
import {
	clearAllData,
	getStorageInfo,
	loadState,
	saveState,
} from "@/lib/storage";
import {
	getCurrentProjectId,
	setCurrentProject,
	saveProjectData,
	loadProjectData,
	createProject,
} from "@/lib/projectStorage";
import ProjectManager from "@/components/ProjectManager";
import { ImageEditModal } from "@/components/ImageEditModal";
import type {
	CharacterReference,
	ComicStyle,
	GeneratedPanel,
	StoryAnalysis,
	StoryBreakdown,
	UploadedCharacterReference,
	UploadedSettingReference,
} from "@/types";
import type {
	ImageSizeConfig,
} from "@/types/project";
import { DEFAULT_IMAGE_SIZE } from "@/types/project";
import { imageOptimizer, OPTIMIZATION_PRESETS } from "@/lib/imageOptimizer";
import { cacheManager } from "@/lib/cacheManager";

type FailedStep = "analysis" | "characters" | "layout" | "panels" | null;
type FailedPanel = { step: "panel"; panelNumber: number } | null;

interface RerunButtonProps {
	onClick: () => void;
	isLoading: boolean;
	disabled?: boolean;
	label?: string;
	loadingText?: string;
}

function RerunButton({
	onClick,
	isLoading,
	disabled = false,
	label = "Re-run",
	loadingText = "Re-running...",
}: RerunButtonProps) {
	return (
		<button
			type="button"
			className="btn-manga-secondary"
			onClick={onClick}
			disabled={isLoading || disabled}
		>
			{isLoading ? (
				<>
					<LoadingSpinner size="small" />
					{loadingText}
				</>
			) : (
				`🔄 ${label}`
			)}
		</button>
	);
}

interface LoadingSpinnerProps {
	size?: "small" | "medium";
	color?: "white" | "current";
	className?: string;
}

function LoadingSpinner({
	size = "medium",
	color = "current",
	className = "",
}: LoadingSpinnerProps) {
	const sizeClasses = {
		small: "h-3 w-3",
		medium: "h-4 w-4",
	};

	const borderColorClasses = {
		white: "border-b-2 border-white",
		current: "border-b-2 border-current",
	};

	return (
		<span
			className={`inline-block animate-spin rounded-full ${sizeClasses[size]} ${borderColorClasses[color]} mr-2 ${className}`}
			aria-hidden="true"
		></span>
	);
}

interface DownloadButtonProps {
	onClick: () => void;
	isLoading: boolean;
	disabled?: boolean;
	label: string;
	loadingText: string;
	variant?: "primary" | "outline";
}

function DownloadButton({
	onClick,
	isLoading,
	disabled = false,
	label,
	loadingText,
	variant = "primary",
}: DownloadButtonProps) {
	const baseClass =
		variant === "primary" ? "btn-manga-primary" : "btn-manga-outline text-sm";

	return (
		<button
			type="button"
			className={baseClass}
			onClick={onClick}
			disabled={isLoading || disabled}
		>
			{isLoading ? (
				<>
					<LoadingSpinner
						size="small"
						color={variant === "primary" ? "white" : "current"}
					/>
					{loadingText}
				</>
			) : (
				label
			)}
		</button>
	);
}

interface StatusBadgeProps {
	status: "pending" | "completed" | "in-progress";
}

function StatusBadge({ status }: StatusBadgeProps) {
	const statusConfig = {
		pending: { class: "badge-manga-warning", text: "pending" },
		completed: { class: "badge-manga-success", text: "completed" },
		"in-progress": { class: "badge-manga-info", text: "in-progress" },
	};

	const config = statusConfig[status];

	return <span className={`${config.class} ml-auto mr-3`}>{config.text}</span>;
}

interface AccordionSectionProps {
	id: string;
	title: string;
	stepNumber: number;
	isCompleted: boolean;
	isInProgress?: boolean;
	isOpen: boolean;
	onToggle: () => void;
	children: React.ReactNode;
	showStatus?: boolean;
}

function AccordionSection({
	id,
	title,
	stepNumber,
	isCompleted,
	isInProgress = false,
	isOpen,
	onToggle,
	children,
	showStatus = true,
}: AccordionSectionProps) {
	const getStatusIcon = () => {
		if (!showStatus) return "";
		if (isCompleted) return "✅";
		if (isInProgress) return "🔄";
		return "⏳";
	};

	const getStatusBadge = () => {
		if (!showStatus) return null;
		if (isCompleted) return "completed";
		if (isInProgress) return "in-progress";
		return "pending";
	};

	return (
		<div className="accordion-item">
			<h2 className="accordion-header" id={id}>
				<button className="accordion-button" type="button" onClick={onToggle}>
					{getStatusIcon() && <span className="mr-2">{getStatusIcon()}</span>}
					Step {stepNumber}: {title}
					{getStatusBadge() && <StatusBadge status={getStatusBadge()!} />}
				</button>
			</h2>
			<div className={`accordion-body ${isOpen ? "" : "hidden"}`}>
				{children}
			</div>
		</div>
	);
}

interface CollapsibleSectionProps {
	title: string;
	isExpanded: boolean;
	onToggle: () => void;
	children: React.ReactNode;
	badge?: string | undefined;
}

function CollapsibleSection({
	title,
	isExpanded,
	onToggle,
	children,
	badge,
}: CollapsibleSectionProps) {
	return (
		<div className="border border-manga-medium-gray/30 rounded-lg">
			<button
				type="button"
				className="w-full flex items-center justify-between p-3 text-left hover:bg-manga-medium-gray/10 transition-colors rounded-t-lg"
				onClick={onToggle}
			>
				<div className="flex items-center gap-2">
					<span className="font-medium text-manga-black">{title}</span>
					{badge && (
						<span className="inline-block bg-manga-info text-white px-2 py-1 rounded text-xs">
							{badge}
						</span>
					)}
				</div>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					className={`transform transition-transform duration-200 ${
						isExpanded ? "rotate-180" : ""
					}`}
				>
					<title>Toggle section</title>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
			{isExpanded && (
				<div className="border-t border-manga-medium-gray/30 p-3">
					{children}
				</div>
			)}
		</div>
	);
}

interface CharacterCardProps {
	character: {
		name: string;
		physicalDescription?: string;
		role?: string;
		image?: string;
		description?: string;
	};
	showImage?: boolean;
	onImageClick?: (imageUrl: string, name: string) => void;
	onDownload?: () => void;
	onEdit?: () => void;
}

function CharacterCard({
	character,
	showImage = false,
	onImageClick,
	onDownload,
	onEdit,
}: CharacterCardProps) {
	const { t } = useTranslation();
	return (
		<div className={showImage ? "text-center" : "card-manga"}>
			{showImage && character.image ? (
				<>
					<img
						src={character.image && typeof character.image === 'string' && character.image.trim() ? character.image : '/placeholder-character.svg'}
						alt={character.name}
						className="w-full h-48 object-cover rounded mb-2 border-2 border-manga-black shadow-comic transition-transform hover:scale-105 cursor-pointer"
						onClick={() => character.image && typeof character.image === 'string' && character.image.trim() && onImageClick?.(character.image, character.name)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								if (character.image && typeof character.image === 'string' && character.image.trim()) {
									onImageClick?.(character.image, character.name);
								}
							}
						}}
						onError={(e) => {
									const target = e.target as HTMLImageElement;
									console.warn(`Failed to load character image: ${character.image}`);
									target.src = '/placeholder-character.svg';
								}}
					/>
					<h6 className="font-semibold">{character.name}</h6>
					<p className="text-sm text-manga-medium-gray mb-2">
						{character.description}
					</p>
					<div className="flex gap-2 mt-2">
						{onDownload && (
							<DownloadButton
								onClick={onDownload}
								isLoading={false}
								label="Download Character"
								loadingText=""
								variant="outline"
							/>
						)}
						{onEdit && (
							<button
								onClick={onEdit}
								className="btn-manga-outline text-sm px-3 py-1"
								title={t("editImageButton")}
							>
								✏️ {t("editImageButton")}
							</button>
						)}
					</div>
				</>
			) : (
				<div className="card-body">
					<h6 className="card-title">{character.name}</h6>
					<p className="card-text text-sm">{character.physicalDescription}</p>
					<p className="card-text">
						<em>{character.role}</em>
					</p>
				</div>
			)}
		</div>
	);
}

interface PanelCardProps {
	panel: {
		panelNumber: number;
		sceneId?: string;
		sceneDescription?: string;
		dialogue?: string;
		characters?: string[];
		cameraAngle?: string;
		visualMood?: string;
		image?: string;
	};
	showImage?: boolean;
	onImageClick?: (imageUrl: string, altText: string) => void;
	onDownload?: () => void;
	onEdit?: () => void;
	scenes?: Array<{
		id: string;
		name: string;
		description: string;
		location: string;
		timeOfDay?: string;
		mood: string;
		visualElements: string[];
	}>;
}

function PanelCard({
	panel,
	showImage = false,
	onImageClick,
	onDownload,
	onEdit,
	scenes = [],
}: PanelCardProps) {
	const { t } = useTranslation();

	// 查找面板对应的场景信息
	const panelScene = panel.sceneId ? scenes.find(scene => scene.id === panel.sceneId) : null;

	return (
		<div className={showImage ? "text-center" : "card-manga"}>
			{showImage && panel.image ? (
				<>
					<img
						src={panel.image && typeof panel.image === 'string' && panel.image.trim() ? panel.image : '/placeholder-panel.svg'}
						alt={`Comic Panel ${panel.panelNumber}`}
						className="w-full rounded mb-2 comic-panel cursor-pointer transition-transform hover:scale-[1.02]"
						onClick={() => {
							if (panel.image && typeof panel.image === 'string' && panel.image.trim()) {
								onImageClick?.(panel.image, `Comic Panel ${panel.panelNumber}`);
							}
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								if (panel.image && typeof panel.image === 'string' && panel.image.trim()) {
									onImageClick?.(panel.image, `Comic Panel ${panel.panelNumber}`);
								}
							}
						}}
						onError={(e) => {
							const target = e.target as HTMLImageElement;
							console.warn(`Failed to load panel image: ${panel.image}`);
							target.src = '/placeholder-panel.svg';
							// Show error message to user
							alert(`Failed to load panel ${panel.panelNumber} image. Please try regenerating this panel.`);
						}}
					/>
					<h6 className="font-semibold">Panel {panel.panelNumber}</h6>
					<div className="flex gap-2 mt-2">
						{onDownload && (
							<DownloadButton
								onClick={onDownload}
								isLoading={false}
								label="Download Panel"
								loadingText=""
								variant="outline"
							/>
						)}
						{onEdit && (
							<button
								onClick={onEdit}
								className="btn-manga-outline text-sm px-3 py-1"
								title={t("editImageButton")}
							>
								✏️ {t("editImageButton")}
							</button>
						)}
					</div>
				</>
			) : (
				<div className="card-body">
					<h6 className="card-title">Panel {panel.panelNumber}</h6>
					<p className="card-text text-sm">{panel.sceneDescription}</p>
					{panel.dialogue && (
						<p className="card-text speech-bubble text-sm">
							"{panel.dialogue}"
						</p>
					)}
					{/* 显示场景信息 */}
					{panelScene && (
						<div className="bg-manga-light-gray/20 p-2 rounded text-xs mb-2">
							<div><strong>场景:</strong> {panelScene.name}</div>
							<div><strong>位置:</strong> {panelScene.location}</div>
							{panelScene.timeOfDay && <div><strong>时间:</strong> {panelScene.timeOfDay}</div>}
						</div>
					)}
					<div className="text-sm text-manga-medium-gray">
						{panel.characters && (
							<div>
								<strong>Characters:</strong> {panel.characters.join(", ")}
							</div>
						)}
						{panel.cameraAngle && (
							<div>
								<strong>Camera:</strong> {panel.cameraAngle}
							</div>
						)}
						{panel.visualMood && (
							<div>
								<strong>Mood:</strong> {panel.visualMood}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

interface ShareableComicLayoutProps {
	storyAnalysis: StoryAnalysis | null;
	generatedPanels: GeneratedPanel[];
	characterReferences: CharacterReference[];
	style: ComicStyle;
	isPreview?: boolean;
	compositorRef?: React.RefObject<HTMLDivElement | null>;
	getProxyImageUrl?: (url: string) => string;
	isLazyLoadingEnabled?: boolean;
	visiblePanelRange?: { start: number; end: number };
}

function ShareableComicLayout({
	storyAnalysis,
	generatedPanels,
	characterReferences,
	style,
	isPreview = false,
	compositorRef,
	getProxyImageUrl,
	isLazyLoadingEnabled = false,
	visiblePanelRange = { start: 0, end: 10 },
}: ShareableComicLayoutProps) {
	const title =
		storyAnalysis?.title || `${style === "manga" ? "Manga" : "Comic"} Story`;

	if (isPreview) {
		const panelsToShow = generatedPanels.slice(0, 4);
		const charactersToShow = characterReferences.slice(0, 3);
		const remainingPanels = Math.max(0, generatedPanels.length - 4);
		const remainingCharacters = Math.max(0, characterReferences.length - 3);

		// Simplified preview version
		return (
			<div className="max-w-sm mx-auto bg-white p-3 rounded shadow-sm">
				<div className="aspect-square bg-gray-100 rounded flex flex-col">
					<div className="text-center p-3 border-b">
						<div className="text-sm font-semibold truncate">{title}</div>
					</div>
					<div className="flex-1 flex">
						<div className="flex-1 grid grid-cols-2 gap-2 p-3 relative">
							{panelsToShow.map((panel) => (
								<div
									key={`preview-panel-${panel.panelNumber}`}
									className="bg-gray-200 rounded aspect-square"
								>
									<img
										src={panel.image && typeof panel.image === 'string' && panel.image.trim() ? (getProxyImageUrl ? getProxyImageUrl(panel.image) : panel.image) : '/placeholder-panel.svg'}
										alt={`Panel ${panel.panelNumber}`}
										className="w-full h-full object-cover rounded"
										onError={(e) => {
									const target = e.target as HTMLImageElement;
									console.warn(`Failed to load composite panel image: ${panel.image}`);
									target.src = '/placeholder-panel.svg';
								}}
									/>
								</div>
							))}
							{remainingPanels > 0 && (
								<div
									className="absolute bottom-2 right-2 text-[12px] px-2 py-1 rounded shadow-lg border"
									style={{
										backgroundColor: "rgba(255, 255, 255, 0.95)",
										color: "#000000",
									}}
								>
									+{remainingPanels} more
								</div>
							)}
						</div>
						<div className="w-16 p-2 relative">
							{charactersToShow.map((char) => (
								<div
									key={`preview-char-${char.name}`}
									className="bg-gray-200 rounded mb-1 aspect-square"
								>
									<img
									src={char.image && typeof char.image === 'string' && char.image.trim() ? (getProxyImageUrl ? getProxyImageUrl(char.image) : char.image) : '/placeholder-character.svg'}
									alt={char.name}
									className="w-full h-full object-cover rounded"
									onError={(e) => {
										const target = e.target as HTMLImageElement;
										target.src = '/placeholder-character.svg';
									}}
								/>
								</div>
							))}
							{remainingCharacters > 0 && (
								<div
									className="absolute bottom-2 right-2 text-[12px] px-2 py-1 rounded shadow-lg border"
									style={{
										backgroundColor: "rgba(255, 255, 255, 0.95)",
										color: "#000000",
									}}
								>
									+{remainingCharacters}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Full download version
	return (
		<div
			ref={compositorRef}
			style={{
				position: "fixed",
				left: "-9999px",
				top: "0",
				width: "1200px",
				minHeight: "1200px", // Changed to minHeight to allow content to expand
				backgroundColor: "#ffffff",
				padding: "32px",
				fontFamily:
					style === "manga"
						? '"M PLUS 1", "Sawarabi Gothic", sans-serif'
						: '"Comfortaa", sans-serif',
			}}
		>
			{/* Header with title and branding */}
			<div style={{ textAlign: "center", marginBottom: "24px" }}>
				<h1
					style={{
						fontSize: "30px",
						fontWeight: "bold",
						color: "#1f2937",
						marginBottom: "8px",
						margin: "0 0 8px 0",
					}}
				>
					{title}
				</h1>
				<div
					style={{
						fontSize: "14px",
						color: "#6b7280",
						margin: "0",
					}}
				>
					Generated with Story to {style === "manga" ? "Manga" : "Comic"}{" "}
					Generator at storytomanga.com
				</div>
			</div>

			{/* 分页信息提示 */}
			{isLazyLoadingEnabled && (
				<div
					style={{
						background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
						border: "1px solid #f59e0b",
						borderRadius: "8px",
						padding: "12px",
						marginBottom: "16px",
						display: "flex",
						alignItems: "center",
						gap: "8px",
					}}
				>
					<span style={{ fontSize: "16px" }}>📄</span>
					<div>
						<div style={{ fontWeight: "600", color: "#92400e" }}>
							分页显示已启用
						</div>
						<div style={{ fontSize: "14px", color: "#b45309" }}>
							检测到 {generatedPanels.length} 个面板，分为 {Math.ceil(generatedPanels.length / 20)} 页显示。
							当前显示：第 {Math.floor(visiblePanelRange.start / 20) + 1} 页 ({visiblePanelRange.start + 1}-{Math.min(visiblePanelRange.end, generatedPanels.length)} / {generatedPanels.length})
						</div>
					</div>
				</div>
			)}

			{/* Main content area */}
			<div style={{ display: "flex", height: "970px" }}>
				{/* Panels section - 75% width */}
				<div style={{ width: "75%", paddingRight: "16px" }}>
					<div
						style={{
							display: "grid",
							gap: "12px",
							height: "100%",
							gridTemplateColumns:
								generatedPanels.length <= 2
									? "1fr"
									: generatedPanels.length <= 4
										? "1fr 1fr"
										: generatedPanels.length <= 6
											? "1fr 1fr"
											: "1fr 1fr 1fr",
							gridTemplateRows:
								generatedPanels.length <= 2
									? "1fr 1fr"
									: generatedPanels.length <= 4
										? "1fr 1fr"
										: generatedPanels.length <= 6
											? "1fr 1fr 1fr"
											: "1fr 1fr",
						}}
					>
						{(isLazyLoadingEnabled
							? generatedPanels.slice(visiblePanelRange.start, visiblePanelRange.end)
							: generatedPanels
						).map((panel) => (
							<div
								key={`composite-panel-${panel.panelNumber}`}
								style={{
									position: "relative",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									backgroundColor: "#f9fafb",
								}}
							>
								<img
									src={panel.image && typeof panel.image === 'string' && panel.image.trim() ? (getProxyImageUrl ? getProxyImageUrl(panel.image) : panel.image) : '/placeholder-panel.svg'}
									alt={`Panel ${panel.panelNumber}`}
									style={{
										maxWidth: "100%",
										maxHeight: "100%",
										width: "auto",
										height: "auto",
										objectFit: "contain",
										borderRadius: "8px",
										border: "2px solid #d1d5db",
									}}
									crossOrigin="anonymous"
									loading={isLazyLoadingEnabled ? "lazy" : "eager"}
									onError={(e) => {
										const target = e.target as HTMLImageElement;
										target.src = '/placeholder-panel.svg';
									}}
								/>
							</div>
						))}
					</div>
				</div>

				{/* Character showcase - 25% width */}
				<div
					style={{
						width: "25%",
						paddingLeft: "16px",
						borderLeft: "2px solid #e5e7eb",
					}}
				>
					<h3
						style={{
							fontSize: "18px",
							fontWeight: "600",
							color: "#1f2937",
							marginBottom: "16px",
							textAlign: "center",
							margin: "0 0 16px 0",
						}}
					>
						Characters
					</h3>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "16px",
						}}
					>
						{characterReferences.slice(0, 3).map((char) => (
							<div
								key={`composite-char-${char.name}`}
								style={{ textAlign: "center" }}
							>
								<div
									style={{
										width: "200px",
										height: "200px",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										backgroundColor: "#f9fafb",
										borderRadius: "6px",
										border: "1px solid #d1d5db",
										marginBottom: "8px",
										margin: "0 auto 8px auto",
									}}
								>
									<img
										src={char.image && typeof char.image === 'string' && char.image.trim() ? char.image : '/placeholder-character.svg'}
										alt={char.name}
										style={{
											maxWidth: "100%",
											maxHeight: "100%",
											width: "auto",
											height: "auto",
											objectFit: "contain",
											borderRadius: "4px",
										}}
										crossOrigin="anonymous"
										onError={(e) => {
											const target = e.target as HTMLImageElement;
											target.src = '/placeholder-character.svg';
										}}
									/>
								</div>
								<div
									style={{
										fontSize: "11px",
										fontWeight: "500",
										color: "#374151",
										wordWrap: "break-word",
									}}
								>
									{char.name}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

// This should be a compelling story under 500 words that showcases the app's capabilities
const SAMPLE_STORY_TEXT = `One Hour Left

Victor eyed the timer: 01:00:00. “Plenty of time.”
Kingston sighed. “That sentence always ages badly. We need to move.”

They stared at the whiteboard. “Video, demo, write-up,” Kingston said.
“So… everything,” Victor said. “All of it,” Kingston said. “Fast.”

They opened the app. Victor pasted this story. “Going meta. Hitting Generate.”
“Good. If it works on us, it works on anything,” Kingston said.

Character refs appeared: Victor in a hoodie, Kingston with glasses.
“Hey, that’s actually us,” Victor said. “Lock these on every panel,” Kingston said. “No face drift.”

“Style pick?” Victor asked.
“Manga,” Kingston said. “Decide once, stay consistent.”

Layout spun up. Panel plan and bubbles drafted.
“Readable,” Victor said. “Let it run.”

Panels started streaming.
“Faces hold. Hair behaves,” Victor said. “Finally,” Kingston said.

One panel stalled.
“Panel six hiccup. Rerun it,” Kingston said. “On it,” Victor said. “Clean now.”

“Download All,” Victor said. “And the poster?”
“Create Shareable Image,” Kingston clicked. Tiles snapped into a neat grid.

The timer flipped to 00:01:00.
“Plenty of time,” Victor said.
“Submit before you jinx it,” Kingston said.`;

export default function Home() {
	// Initialize i18n hooks
	const { t, i18n } = useI18n();

	// Generate unique IDs for form elements
	const mangaRadioId = useId();
	const comicRadioId = useId();
	const storyTextareaId = useId();
	const analysisHeadingId = useId();
	const charactersHeadingId = useId();
	const layoutHeadingId = useId();
	const panelsHeadingId = useId();
	const compositorHeadingId = useId();

	// Ref for the compositor canvas
	const compositorRef = useRef<HTMLDivElement>(null);

	// Simple rate limit error handler
	const handleApiError = async (
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
					return `⚠️ Content Safety Issue: ${data.error}\n\nTip: Try modifying your story to remove potentially inappropriate content, violence, or mature themes.`;
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

	// Main state
	const [story, setStory] = useState("");
	const [style, setStyle] = useState<ComicStyle>("manga");
	const [imageSize, setImageSize] = useState<ImageSizeConfig>(DEFAULT_IMAGE_SIZE); // 图片尺寸配置
	const [aiModel, setAiModel] = useState<string>("auto"); // AI模型选择状态
	const [isGenerating, setIsGenerating] = useState(false);
	const [currentStepText, setCurrentStepText] = useState("");

	// Uploaded reference images state
	const [uploadedCharacterReferences, setUploadedCharacterReferences] =
		useState<UploadedCharacterReference[]>([]);
	const [uploadedSettingReferences, setUploadedSettingReferences] = useState<
		UploadedSettingReference[]
	>([]);

	// Collapsible sections state
	const [isCharacterRefsExpanded, setIsCharacterRefsExpanded] = useState(false);
	const [isSettingRefsExpanded, setIsSettingRefsExpanded] = useState(false);

	// Modal state
	const [modalImage, setModalImage] = useState<string | null>(null);
	const [modalAlt, setModalAlt] = useState<string>("");
	const [showConfirmClearModal, setShowConfirmClearModal] =
		useState<boolean>(false);
	const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
	const [errorModalMessage, setErrorModalMessage] = useState<string>("");

	// Download state
	const [isDownloadingCharacters, setIsDownloadingCharacters] = useState(false);
	const [isDownloadingPanels, setIsDownloadingPanels] = useState(false);
	const [isGeneratingComposite, setIsGeneratingComposite] = useState(false);

	// Individual section re-run loading states
	const [isRerunningAnalysis, setIsRerunningAnalysis] = useState(false);
	const [isRerunningCharacters, setIsRerunningCharacters] = useState(false);
	const [isRerunningLayout, setIsRerunningLayout] = useState(false);
	const [isRerunningPanels, setIsRerunningPanels] = useState(false);

	// Generated content state
	const [storyAnalysis, setStoryAnalysis] = useState<StoryAnalysis | null>(
		null,
	);
	const [characterReferences, setCharacterReferences] = useState<
		CharacterReference[]
	>([]);
	const [storyBreakdown, setStoryBreakdown] = useState<StoryBreakdown | null>(
		null,
	);
	const [generatedPanels, setGeneratedPanels] = useState<GeneratedPanel[]>([]);
	const [failedPanels, setFailedPanels] = useState<Set<number>>(new Set()); // 跟踪失败的面板
	const [error, setError] = useState<string | null>(null);
	const [failedStep, setFailedStep] = useState<FailedStep>(null);
	const [failedPanel, setFailedPanel] = useState<FailedPanel>(null);

	// Edit mode states
	const [editingStoryAnalysis, setEditingStoryAnalysis] = useState(false);
	const [editingStoryBreakdown, setEditingStoryBreakdown] = useState(false);


	// Temporary edit data
	const [tempStoryAnalysis, setTempStoryAnalysis] = useState<StoryAnalysis | null>(null);
	const [tempStoryBreakdown, setTempStoryBreakdown] = useState<StoryBreakdown | null>(null);

	// Storage state
	const [isLoadingState, setIsLoadingState] = useState(true);
	const [isSavingState, setIsSavingState] = useState(false);

	// Project management state
	const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
	const [showProjectManager, setShowProjectManager] = useState(false);

	// Image editing state
	const [showImageEditModal, setShowImageEditModal] = useState(false);
	const [editingImage, setEditingImage] = useState<{
		type: 'panel' | 'character';
		id: string | number;
		image: string;
		originalPrompt: string;
		autoSelectedReferences?: Array<{id: string; name: string; image: string; source: 'upload' | 'character'}>;
	} | null>(null);
	const [isImageProcessing, setIsImageProcessing] = useState(false);

	// 生成状态管理
	const [generationState, setGenerationState] = useState<{
		isGenerating: boolean;
		isPaused: boolean;
		currentPanel: number;
		totalPanels: number;
		completedPanels: number;
		failedPanels: number[];
		batchInfo?: {
			currentBatch: number;
			totalBatches: number;
			batchSize: number;
		};
	}>({
		isGenerating: false,
		isPaused: false,
		currentPanel: 0,
		totalPanels: 0,
		completedPanels: 0,
		failedPanels: [],
	});

	// 图像优化统计
	const [optimizationStats, setOptimizationStats] = useState({
		totalOriginalSize: 0,
		totalOptimizedSize: 0,
		totalSavings: 0,
		optimizedCount: 0,
	});

	// 分页显示状态 - 处理大量面板，统一为20个面板一页
	const PANELS_PER_PAGE = 20;
	const totalPages = Math.ceil(generatedPanels.length / PANELS_PER_PAGE);
	const [currentPage, setCurrentPage] = useState(1);

	// 计算当前页面显示的面板范围
	const startIndex = (currentPage - 1) * PANELS_PER_PAGE;
	const endIndex = Math.min(startIndex + PANELS_PER_PAGE, generatedPanels.length);
	const currentPagePanels = generatedPanels.slice(startIndex, endIndex);

	const isLazyLoadingEnabled = generatedPanels.length > 20;

	// 检测大量面板并启用分页优化
	useEffect(() => {
		if (generatedPanels.length > 20) {
			console.log(`🚀 启用分页优化：检测到 ${generatedPanels.length} 个面板，共 ${totalPages} 页`);

			// 监控内存使用情况
			if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
				const memory = (window.performance as any).memory;
				console.log(`📊 内存使用情况：`, {
					used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
					total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
					limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`
				});
			}
		}
	}, [generatedPanels.length, totalPages]);

	// 页面切换时滚动到面板区域顶部
	useEffect(() => {
		if (isLazyLoadingEnabled && currentPage > 1) {
			const panelsSection = document.querySelector('[data-section="panels"]');
			if (panelsSection) {
				panelsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}
	}, [currentPage, isLazyLoadingEnabled]);

	// 清除缓存的辅助函数（用于调试）
	const clearCache = () => {
		cacheManager.clear();
		console.log('🗑️ 缓存已清除');
	};

	// 🎯 Debug: Monitor character references state changes
	useEffect(() => {
		if (characterReferences.length > 0) {
			console.log('🎉 Character references updated in state:', {
				count: characterReferences.length,
				characters: characterReferences.map(ref => ({
					name: ref.name,
					hasImage: !!ref.image,
					imagePreview: ref.image?.substring(0, 80) + '...'
				}))
			});
		}
	}, [characterReferences]);

	// Accordion state
	const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

	// Helper functions for accordion management
	const toggleAccordionSection = (section: string) => {
		setOpenAccordions((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(section)) {
				newSet.delete(section);
				trackEvent({
					action: "collapse_section",
					category: "user_interaction",
					label: section,
				});
			} else {
				newSet.add(section);
				trackEvent({
					action: "expand_section",
					category: "user_interaction",
					label: section,
				});
			}
			return newSet;
		});
	};

	const expandAllAccordions = () => {
		setOpenAccordions(
			new Set(["analysis", "characters", "layout", "panels", "compositor"]),
		);
	};

	const collapseAllAccordions = () => {
		setOpenAccordions(new Set());
	};

	// 生成单个面板的辅助函数（优化版）
	const generateSinglePanel = async (panel: any, retryCount = 0) => {
		const maxRetries = 2;
		let controller: AbortController | null = null;
		let timeoutId: NodeJS.Timeout | null = null;

		try {
			// 添加请求超时控制
			controller = new AbortController();
			timeoutId = setTimeout(() => {
				if (controller && !controller.signal.aborted) {
					controller.abort();
				}
			}, 120000); // 120秒超时

			const response = await fetch('/api/generate-panel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					panel: {
						description: panel.description || panel.sceneDescription,
						panelDescription: panel.panelDescription || panel.sceneDescription,
						sceneDescription: panel.sceneDescription,
						panelNumber: panel.panelNumber,
						characters: panel.characters || [],
						dialogue: panel.dialogue,
						cameraAngle: panel.cameraAngle,
						visualMood: panel.visualMood,
					},
					characterReferences: characterReferences,
					setting: storyAnalysis?.setting || '',
					style: style,
					uploadedSettingReferences: uploadedSettingReferences || [],
					language: i18n?.language || 'en',
					aiModel: aiModel,
					imageSize: imageSize,
				}),
				signal: controller.signal,
			});

			// 清理超时控制
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			if (result.success && result.generatedPanel?.image) {
				// 优化图像
				let optimizedImage = result.generatedPanel.image;
				try {
					const optimization = await imageOptimizer.optimizeImage(
						result.generatedPanel.image,
						OPTIMIZATION_PRESETS.STANDARD
					);

					optimizedImage = optimization.data;

					// 更新优化统计
					setOptimizationStats(prev => ({
						totalOriginalSize: prev.totalOriginalSize + optimization.originalSize,
						totalOptimizedSize: prev.totalOptimizedSize + optimization.optimizedSize,
						totalSavings: prev.totalSavings + (optimization.originalSize - optimization.optimizedSize),
						optimizedCount: prev.optimizedCount + 1,
					}));

					console.log(`Panel ${panel.panelNumber} optimized: ${(optimization.originalSize / 1024 / 1024).toFixed(2)}MB → ${(optimization.optimizedSize / 1024 / 1024).toFixed(2)}MB (${(optimization.compressionRatio * 100).toFixed(1)}% compression)`);
				} catch (error) {
					console.warn(`Failed to optimize panel ${panel.panelNumber}:`, error);
				}

				const newPanel = {
					panelNumber: panel.panelNumber,
					description: panel.description,
					image: optimizedImage,
				};

				setGeneratedPanels(prev => {
					const updated = [...prev];
					const existingIndex = updated.findIndex(p => p.panelNumber === panel.panelNumber);
					if (existingIndex >= 0) {
						updated[existingIndex] = newPanel;
					} else {
						updated.push(newPanel);
						updated.sort((a, b) => a.panelNumber - b.panelNumber);
					}
					return updated;
				});

				// 异步保存到项目（不阻塞生成流程）
				if (currentProjectId) {
					saveProjectData(
						currentProjectId,
						story,
						style,
						storyAnalysis,
						storyBreakdown,
						characterReferences,
						[...generatedPanels, newPanel],
						uploadedCharacterReferences,
						uploadedSettingReferences,
						imageSize,
						generationState
					).catch(error => {
						console.error('Failed to save project data:', error);
					});
				}

				return newPanel;
			}
			return null;
		} catch (error) {
			// 清理超时控制
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}

			// 特殊处理AbortError
			if (error instanceof Error && error.name === 'AbortError') {
				console.warn(`Panel ${panel.panelNumber} generation was aborted (attempt ${retryCount + 1})`);

				// 如果是超时导致的abort，可以重试
				if (retryCount < maxRetries && !generationState.isPaused) {
					console.log(`Retrying panel ${panel.panelNumber} after timeout in 3 seconds...`);
					await new Promise(resolve => setTimeout(resolve, 3000));
					return generateSinglePanel(panel, retryCount + 1);
				}

				throw new Error(`Panel ${panel.panelNumber} generation timed out after ${retryCount + 1} attempts`);
			}

			console.error(`Error generating panel ${panel.panelNumber} (attempt ${retryCount + 1}):`, error);

			// 自动重试机制（非AbortError）
			if (retryCount < maxRetries && !generationState.isPaused) {
				console.log(`Retrying panel ${panel.panelNumber} in 2 seconds...`);
				await new Promise(resolve => setTimeout(resolve, 2000));
				return generateSinglePanel(panel, retryCount + 1);
			}

			throw error;
		}
	};

	// 继续生成功能
	const continueGeneration = async () => {
		if (!storyBreakdown || generationState.isGenerating) return;

		const remainingPanels = storyBreakdown.panels.filter(
			panel => !generatedPanels.some(generated => generated.panelNumber === panel.panelNumber)
		);

		if (remainingPanels.length === 0) {
			alert("所有面板都已生成完成！");
			return;
		}

		setGenerationState(prev => ({
			...prev,
			isGenerating: true,
			isPaused: false,
			totalPanels: storyBreakdown.panels.length,
			completedPanels: generatedPanels.length,
			currentPanel: remainingPanels && remainingPanels.length > 0 ? remainingPanels[0]?.panelNumber || 0 : 0,
		}));

		try {
			// 检查是否有剩余面板需要生成
			if (!remainingPanels || remainingPanels.length === 0) {
				console.log('No remaining panels to generate');
				setGenerationState(prev => ({
					...prev,
					isGenerating: false,
				}));
				return;
			}

			// 动态批次大小：根据剩余面板数量和模型类型调整，针对大量面板优化
			const getDynamicBatchSize = () => {
				const totalPanels = remainingPanels.length;
				const isVolcEngine = aiModel === 'volcengine';

				// 如果面板数量很多，减少批次大小以避免前端性能问题
				if (totalPanels > 30) {
					return isVolcEngine ? 2 : 3; // 大量面板时使用更小的批次
				}
				if (totalPanels <= 3) return totalPanels;
				if (isVolcEngine) return Math.min(3, totalPanels); // VolcEngine限制更严格
				return Math.min(5, totalPanels); // Gemini可以更多并行
			};

			const batchSize = getDynamicBatchSize();
			const batches = [];
			for (let i = 0; i < remainingPanels.length; i += batchSize) {
				batches.push(remainingPanels.slice(i, i + batchSize));
			}

			setGenerationState(prev => ({
				...prev,
				batchInfo: {
					currentBatch: 1,
					totalBatches: batches.length,
					batchSize,
				},
			}));

			// 性能监控
			let totalGenerationTime = 0;

			for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
				if (generationState.isPaused) break;

				const batch = batches[batchIndex];
				const batchStart = Date.now();

				setGenerationState(prev => ({
					...prev,
					batchInfo: {
						...prev.batchInfo!,
						currentBatch: batchIndex + 1,
					},
				}));

				// 并行生成当前批次的面板，带有进度更新
				const batchPromises = (batch || []).map(async (panel, index) => {
					if (generationState.isPaused) return null;

					// 错开请求时间，避免同时发送
					if (index > 0) {
						await new Promise(resolve => setTimeout(resolve, index * 200));
					}

					setGenerationState(prev => ({
						...prev,
						currentPanel: panel.panelNumber,
					}));

					try {
						const result = await generateSinglePanel(panel);
						if (result) {
							setGenerationState(prev => ({
								...prev,
								completedPanels: prev.completedPanels + 1,
							}));
						}
						return result;
					} catch (error) {
						console.error(`Failed to generate panel ${panel.panelNumber}:`, error);
						setGenerationState(prev => ({
							...prev,
							failedPanels: [...prev.failedPanels, panel.panelNumber],
						}));
						return null;
					}
				});

				const batchResults = await Promise.allSettled(batchPromises);
				const batchTime = Date.now() - batchStart;
				totalGenerationTime += batchTime;

				// 记录批次性能
				const successCount = batchResults.filter(r => r.status === 'fulfilled' && r.value).length;
				const batchLength = batch?.length || 0;
				console.log(`Batch ${batchIndex + 1}/${batches.length}: ${successCount}/${batchLength} panels generated in ${batchTime}ms`);

				// 动态调整批次间延迟
				if (batchIndex < batches.length - 1 && batchLength > 0) {
					const avgTimePerPanel = batchTime / batchLength;
					const delay = avgTimePerPanel > 10000 ? 2000 : 1000; // 如果生成慢，延迟更长
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}

			// 性能报告
			const avgTimePerPanel = totalGenerationTime / remainingPanels.length;
			console.log(`Generation completed: ${remainingPanels.length} panels in ${totalGenerationTime}ms (avg: ${avgTimePerPanel.toFixed(0)}ms/panel)`);


			setGenerationState(prev => ({
				...prev,
				isGenerating: false,
				currentPanel: 0,
			}));

			alert("继续生成完成！");
		} catch (error) {
			console.error("Continue generation error:", error);
			setGenerationState(prev => ({
				...prev,
				isGenerating: false,
				currentPanel: 0,
			}));
			alert("继续生成失败，请重试");
		}
	};

	// 暂停生成
	const pauseGeneration = () => {
		setGenerationState(prev => ({
			...prev,
			isPaused: true,
		}));
	};

	// 恢复生成
	const resumeGeneration = () => {
		setGenerationState(prev => ({
			...prev,
			isPaused: false,
		}));
		continueGeneration();
	};

	// Helper functions for image editing
	const openImageEditModal = (
		type: 'panel' | 'character',
		id: string | number,
		image: string,
		originalPrompt: string
	) => {
		setEditingImage({ type, id, image, originalPrompt });

		// 🎯 自动为面板重绘预选正确的角色参考图片
		if (type === 'panel' && storyBreakdown) {
			const panelNumber = typeof id === 'number' ? id : parseInt(id.toString());
			const panel = storyBreakdown.panels.find(p => p.panelNumber === panelNumber);

			if (panel && panel.characters && panel.characters.length > 0) {
				// 根据面板涉及的角色自动选择对应的参考图片
				const autoSelectedRefs: Array<{id: string; name: string; image: string; source: 'upload' | 'character'}> = [];

				panel.characters.forEach((charName: string) => {
					const matchingCharRef = characterReferences.find(ref => ref.name === charName);
					if (matchingCharRef && autoSelectedRefs.length < 4) {
						autoSelectedRefs.push({
							id: `auto-${charName}-${Date.now()}`,
							name: charName,
							image: matchingCharRef.image,
							source: 'character'
						});
					}
				});

				console.log(`🎯 Auto-selected ${autoSelectedRefs.length} character references for panel ${panelNumber}:`,
					autoSelectedRefs.map(ref => ref.name));

				// 将自动选择的参考图片传递给模态框
				// 注意：这里我们需要修改ImageEditModal来接收初始参考图片
				setEditingImage({
					type,
					id,
					image,
					originalPrompt,
					autoSelectedReferences: autoSelectedRefs
				});
			}
		}

		setShowImageEditModal(true);
	};

	const closeImageEditModal = () => {
		if (!isImageProcessing) {
			setShowImageEditModal(false);
			setEditingImage(null);
		}
	};

	const handleImageRedraw = async (newPrompt?: string, referenceImages?: Array<{id: string; name: string; image: string; source: 'upload' | 'character'}>) => {
		if (!editingImage) return;

		setIsImageProcessing(true);
		try {
			// 转换参考图片格式：从对象数组转换为字符串数组
			const referenceImageUrls = referenceImages ? referenceImages.map(ref => ref.image) : [];

			// 创建带超时的fetch请求 (120秒超时)
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 120000);

			let response: Response;
			try {
				response = await fetch("/api/redraw-image", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						imageType: editingImage.type,
						imageId: editingImage.id,
						originalPrompt: editingImage.originalPrompt,
						newPrompt: newPrompt,
						language: i18n?.language || "en",
						aiModel: aiModel,
						imageSize: imageSize,
						style: style, // 添加项目风格参数
						referenceImages: referenceImageUrls,
					}),
					signal: controller.signal,
				});
				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorMessage = await handleApiError(response, "Failed to redraw image");
					throw new Error(errorMessage);
				}
			} catch (fetchError) {
				clearTimeout(timeoutId);
				if (fetchError instanceof Error && fetchError.name === 'AbortError') {
					throw new Error('重绘请求超时，请稍后重试。如果问题持续，请尝试简化提示词或减少参考图片数量。');
				}
				throw fetchError;
			}

			const result = await response.json();
			if (!result.success || !result.imageData) {
				throw new Error(result.error || "Failed to redraw image");
			}

			// Update the image in the appropriate state
			if (editingImage.type === 'panel') {
				// Convert editingImage.id to number for panel comparison
				const panelId = typeof editingImage.id === 'string' ? parseInt(editingImage.id) : editingImage.id;
				setGeneratedPanels(prev => prev.map(panel =>
					panel.panelNumber === panelId
						? { ...panel, image: result.imageData }
						: panel
				));
			} else if (editingImage.type === 'character') {
				setCharacterReferences(prev => prev.map(char =>
					char.name === editingImage.id
						? { ...char, image: result.imageData }
						: char
				));
			}

			// Save to project storage if we have a current project
			if (currentProjectId) {
				await saveProjectData(
					currentProjectId,
					story,
					style,
					storyAnalysis,
					storyBreakdown,
					characterReferences,
					generatedPanels,
					uploadedCharacterReferences,
					uploadedSettingReferences,
					imageSize,
					generationState
				);
			}

			closeImageEditModal();
		} catch (error) {
			console.error("Error redrawing image:", error);
			setErrorModalMessage(`Failed to redraw image: ${error instanceof Error ? error.message : 'Unknown error'}`);
			setShowErrorModal(true);
		} finally {
			setIsImageProcessing(false);
		}
	};

	const handleImageModify = async (modificationPrompt: string) => {
		if (!editingImage) return;

		setIsImageProcessing(true);
		try {
			// 创建带超时的fetch请求 (120秒超时)
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 120000);

			let response: Response;
			try {
				response = await fetch("/api/modify-image", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						imageType: editingImage.type,
						imageId: editingImage.id,
						originalImage: editingImage.image,
						modificationPrompt: modificationPrompt,
						originalPrompt: editingImage.originalPrompt,
						language: i18n?.language || "en",
						aiModel: aiModel,
						imageSize: imageSize,
					}),
					signal: controller.signal,
				});
				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorMessage = await handleApiError(response, "Failed to modify image");
					throw new Error(errorMessage);
				}
			} catch (fetchError) {
				clearTimeout(timeoutId);
				if (fetchError instanceof Error && fetchError.name === 'AbortError') {
					throw new Error('图像修改请求超时，请稍后重试。如果问题持续，请尝试简化修改要求。');
				}
				throw fetchError;
			}

			const result = await response.json();
			if (!result.success || !result.imageData) {
				throw new Error(result.error || "Failed to modify image");
			}

			// Update the image in the appropriate state
			if (editingImage.type === 'panel') {
				setGeneratedPanels(prev => prev.map(panel =>
					panel.panelNumber === editingImage.id
						? { ...panel, image: result.imageData }
						: panel
				));
			} else if (editingImage.type === 'character') {
				setCharacterReferences(prev => prev.map(char =>
					char.name === editingImage.id
						? { ...char, image: result.imageData }
						: char
				));
			}

			// Save to project storage if we have a current project
			if (currentProjectId) {
				await saveProjectData(
					currentProjectId,
					story,
					style,
					storyAnalysis,
					storyBreakdown,
					characterReferences,
					generatedPanels,
					uploadedCharacterReferences,
					uploadedSettingReferences,
					imageSize,
					generationState
				);
			}

			closeImageEditModal();
		} catch (error) {
			console.error("Error modifying image:", error);
			setErrorModalMessage(`Failed to modify image: ${error instanceof Error ? error.message : 'Unknown error'}`);
			setShowErrorModal(true);
		} finally {
			setIsImageProcessing(false);
		}
	};

	// Helper functions for panel status logic
	const getPanelStatus = () => {
		const expectedCount = storyBreakdown?.panels.length || 0;
		const currentCount = generatedPanels.length;

		if (currentCount === 0) return { isCompleted: false, isInProgress: false };
		if (currentCount === expectedCount && expectedCount > 0)
			return { isCompleted: true, isInProgress: false };
		return { isCompleted: false, isInProgress: true };
	};

	const wordCount = story
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0).length;

	// Handler to populate story with sample text
	const loadSampleText = () => {
		setStory(SAMPLE_STORY_TEXT);
		trackEvent({
			action: "load_sample_story",
			category: "user_interaction",
		});
	};

	const generateComic = async () => {
		if (!story.trim()) {
			showError("Please enter a story");
			return;
		}

		if (wordCount > 500) {
			showError("Story must be 500 words or less");
			return;
		}

		// 如果没有当前项目，创建新项目
		let projectId = currentProjectId;
		if (!projectId) {
			const projectName = story.slice(0, 50) + (story.length > 50 ? "..." : "");
			const metadata = createProject({
				name: projectName,
				description: `Created from story: ${story.slice(0, 100)}${story.length > 100 ? "..." : ""}`,
				style: style,
			});
			projectId = metadata.id;
			setCurrentProjectId(projectId);
		}

		// Track generation start
		const generationStartTime = Date.now();
		trackEvent({
			action: "start_generation",
			category: "manga_generation",
			label: style,
			value: wordCount,
		});

		// Only reset error and set generating state - keep existing content visible
		setIsGenerating(true);
		setCurrentStepText("Analyzing your story...");
		setError(null);

		try {
			// Step 1: Analyze story (with timeout control)
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒超时

			let analysisResponse;
			try {
				analysisResponse = await fetch("/api/analyze-story", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						story,
						style,
						language: i18n?.language || 'en'
					}),
					signal: controller.signal,
				});
				clearTimeout(timeoutId);
			} catch (fetchError) {
				clearTimeout(timeoutId);
				if (fetchError instanceof Error && fetchError.name === 'AbortError') {
					throw new Error('故事分析请求超时。这可能是因为：\n\n• 故事内容过长或复杂\n• 网络连接不稳定\n• 服务器负载较高\n\n建议：\n• 尝试简化故事内容\n• 检查网络连接\n• 稍后重试');
				}
				throw fetchError;
			}

			if (!analysisResponse.ok) {
				throw new Error(
					await handleApiError(analysisResponse, "Failed to analyze story"),
				);
			}

			const responseData = await analysisResponse.json();
			const { analysis } = responseData;

			setStoryAnalysis(analysis);
			setOpenAccordions(new Set(["analysis"])); // Auto-expand analysis section

			// Step 2: Generate character references (with timeout control)
			setCurrentStepText("Creating character designs...");
			const charController = new AbortController();
			const charTimeoutId = setTimeout(() => charController.abort(), 180000); // 180秒超时，角色生成可能需要更长时间

			let charRefResponse;
			try {
				charRefResponse = await fetch("/api/generate-character-refs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						characters: analysis.characters,
						setting: analysis.setting,
						style,
						uploadedCharacterReferences,
						language: i18n?.language || 'en',
						aiModel,
					}),
					signal: charController.signal,
				});
				clearTimeout(charTimeoutId);
			} catch (charError) {
				clearTimeout(charTimeoutId);
				if (charError instanceof Error && charError.name === 'AbortError') {
					throw new Error('角色生成超时，请检查网络连接后重试，或尝试简化角色描述');
				}
				throw charError;
			}

			if (!charRefResponse.ok) {
				throw new Error(
					await handleApiError(
						charRefResponse,
						"Failed to generate character references",
					),
				);
			}

			const charResult = await charRefResponse.json();
			console.log('🎯 Character generation response received:', {
				success: !!charResult.characterReferences,
				count: charResult.characterReferences?.length || 0,
				characters: charResult.characterReferences?.map((ref: any) => ref.name) || []
			});

			const { characterReferences } = charResult;
			setCharacterReferences(characterReferences);
			setOpenAccordions(new Set(["characters"])); // Auto-expand characters section

			console.log('🎯 Character references set in state:', characterReferences?.length || 0);

			// Step 3: Break down story into panels
			setCurrentStepText("Planning comic layout...");
			const storyBreakdownResponse = await fetch("/api/chunk-story", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					story,
					characters: analysis.characters,
					setting: analysis.setting,
					scenes: analysis.scenes,
					style,
					language: i18n?.language || 'en',
				}),
			});

			if (!storyBreakdownResponse.ok) {
				throw new Error(
					await handleApiError(
						storyBreakdownResponse,
						"Failed to break down story",
					),
				);
			}

			const { storyBreakdown: breakdown } = await storyBreakdownResponse.json();
			setStoryBreakdown(breakdown);
			setOpenAccordions(new Set(["layout"])); // Auto-expand layout section

			// Step 4: Generate comic panels using batch API for better efficiency
			const panels: GeneratedPanel[] = [];

			// 确定批次大小：根据面板数量和AI模型调整
			const getBatchSize = () => {
				const totalPanels = breakdown.panels.length;
				const isVolcEngine = aiModel === 'volcengine';

				if (totalPanels <= 3) return totalPanels;
				if (isVolcEngine) return Math.min(3, totalPanels); // VolcEngine限制更严格
				return Math.min(5, totalPanels); // Gemini可以更多并行
			};

			const batchSize = getBatchSize();
			const totalBatches = Math.ceil(breakdown.panels.length / batchSize);

			for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
				const startIndex = batchIndex * batchSize;
				const endIndex = Math.min(startIndex + batchSize, breakdown.panels.length);
				const batchPanels = breakdown.panels.slice(startIndex, endIndex);

				setCurrentStepText(
					`Generating panels ${startIndex + 1}-${endIndex}/${breakdown.panels.length}... (Batch ${batchIndex + 1}/${totalBatches})`,
				);

				try {
					const batchResponse = await fetch("/api/generate-panels-batch", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							panels: batchPanels,
							characterReferences,
							setting: analysis.setting,
							style,
							uploadedSettingReferences,
							language: i18n?.language || "en",
							aiModel,
							imageSize,
							batchSize: batchPanels.length,
						}),
					});

					if (!batchResponse.ok) {
						const errorMessage = await handleApiError(
							batchResponse,
							`Failed to generate panels batch ${batchIndex + 1}`,
						);
						trackError(
							"batch_panel_generation_failed",
							`Batch ${batchIndex + 1}: ${errorMessage}`,
						);

						// 回退到单个面板生成
						console.warn(`Batch ${batchIndex + 1} failed, falling back to individual panel generation`);
						for (const panel of batchPanels) {
							try {
								const panelResponse = await fetch("/api/generate-panel", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										panel,
										characterReferences,
										setting: analysis.setting,
										style,
										uploadedSettingReferences,
										language: i18n?.language || "en",
										aiModel,
										imageSize,
									}),
								});

								if (panelResponse.ok) {
									const { generatedPanel } = await panelResponse.json();
									panels.push(generatedPanel);
									setGeneratedPanels([...panels]);
								} else {
									setFailedPanels(prev => new Set([...prev, panel.panelNumber]));
								}
							} catch (error) {
								console.error(`Failed to generate panel ${panel.panelNumber}:`, error);
								setFailedPanels(prev => new Set([...prev, panel.panelNumber]));
							}
						}
						continue;
					}

					const batchResult = await batchResponse.json();

					// 处理批次结果
					if (batchResult.success && batchResult.results) {
						// 按面板编号排序确保顺序正确
						const sortedResults = batchResult.results.sort((a: any, b: any) => a.panelNumber - b.panelNumber);

						sortedResults.forEach((result: any) => {
							const generatedPanel = {
								panelNumber: result.panelNumber,
								image: result.image,
								modelUsed: result.modelUsed,
							};
							panels.push(generatedPanel);
						});

						// 更新UI显示
						setGeneratedPanels([...panels]);

						// Auto-expand panels section after first panel is generated
						if (panels.length === 1) {
							setOpenAccordions(new Set(["panels"]));
							// Track time to first panel
							const timeToFirstPanel = Date.now() - generationStartTime;
							trackPerformance("time_to_first_panel", timeToFirstPanel);
						}
					}

					// 处理批次中的错误
					if (batchResult.errors && batchResult.errors.length > 0) {
						console.warn(`Batch ${batchIndex + 1} had ${batchResult.errors.length} errors:`, batchResult.errors);
						batchResult.errors.forEach((error: any) => {
							setFailedPanels(prev => new Set([...prev, error.panelNumber]));
						});
					}

				} catch (error) {
					console.error(`Batch ${batchIndex + 1} failed:`, error);
					trackError(
						"batch_panel_generation_error",
						`Batch ${batchIndex + 1}: ${error instanceof Error ? error.message : String(error)}`,
					);

					// 标记整个批次的面板为失败
					batchPanels.forEach((panel: any) => {
						setFailedPanels(prev => new Set([...prev, panel.panelNumber]));
					});
				}

				// 批次间延迟
				if (batchIndex < totalBatches - 1) {
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			setCurrentStepText("Complete! 🎉");
			setIsGenerating(false);

			// Track successful generation
			const generationTime = Date.now() - generationStartTime;
			trackMangaGeneration(wordCount, panels.length);
			trackPerformance("total_generation_time", generationTime);
		} catch (error) {
			console.error("Generation error:", error);
			console.log('🚨 Generation failed at step:', currentStepText);
			console.log('🚨 Current state when error occurred:', {
				hasStoryAnalysis: !!storyAnalysis,
				hasCharacterReferences: characterReferences.length,
				hasStoryBreakdown: !!storyBreakdown,
				generatedPanels: generatedPanels.length,
				isGenerating,
				currentStepText
			});

			const errorMessage =
				error instanceof Error ? error.message : "Generation failed";
			showError(errorMessage);
			setIsGenerating(false);

			// Track error
			trackError("generation_failed", errorMessage);

			// Determine which step failed based on current progress
			if (!storyAnalysis) {
				setFailedStep("analysis");
			} else if (characterReferences.length === 0) {
				setFailedStep("characters");
			} else if (!storyBreakdown) {
				setFailedStep("layout");
			} else {
				setFailedStep("panels");
				// Note: failedPanel is already set in the panel generation loop
			}
		}
	};

	const downloadImage = (imageUrl: string, filename: string) => {
		const link = document.createElement("a");
		link.href = imageUrl;
		link.download = filename;
		link.click();
		trackDownload("png");
	};

	// Uploaded reference image handlers
	const handleCharacterReferenceAdd = (image: UploadedCharacterReference) => {
		setUploadedCharacterReferences((prev) => [...prev, image]);
		trackEvent({
			action: "upload_character_reference",
			category: "user_interaction",
		});
	};

	const handleCharacterReferenceRemove = (id: string) => {
		setUploadedCharacterReferences((prev) =>
			prev.filter((img) => img.id !== id),
		);
	};

	const handleCharacterReferenceNameChange = (id: string, name: string) => {
		setUploadedCharacterReferences((prev) =>
			prev.map((img) => (img.id === id ? { ...img, name } : img)),
		);
	};

	const handleSettingReferenceAdd = (image: UploadedSettingReference) => {
		setUploadedSettingReferences((prev) => [...prev, image]);
		trackEvent({
			action: "upload_setting_reference",
			category: "user_interaction",
		});
	};

	const handleSettingReferenceRemove = (id: string) => {
		setUploadedSettingReferences((prev) => prev.filter((img) => img.id !== id));
	};

	const handleSettingReferenceNameChange = (id: string, name: string) => {
		setUploadedSettingReferences((prev) =>
			prev.map((img) => (img.id === id ? { ...img, name } : img)),
		);
	};

	const downloadImagesAsZip = async (
		images: { url: string; filename: string }[],
		zipFilename: string,
	) => {
		const zip = new JSZip();

		// Fetch all images and add to zip
		const promises = images.map(async ({ url, filename }) => {
			try {
				const response = await fetch(url);
				const blob = await response.blob();
				zip.file(filename, blob);
			} catch (error) {
				console.error(`Failed to fetch image: ${filename}`, error);
			}
		});

		await Promise.all(promises);

		// Generate zip file and download
		const zipBlob = await zip.generateAsync({ type: "blob" });
		const zipUrl = URL.createObjectURL(zipBlob);

		const link = document.createElement("a");
		link.href = zipUrl;
		link.download = zipFilename;
		link.click();

		// Clean up
		setTimeout(() => URL.revokeObjectURL(zipUrl), 100);
	};

	const downloadAllPanels = async () => {
		setIsDownloadingPanels(true);
		try {
			const images = generatedPanels.map((panel) => ({
				url: panel.image,
				filename: `comic-panel-${panel.panelNumber}.jpg`,
			}));
			await downloadImagesAsZip(images, "comic-panels.zip");
			trackDownload("zip");
			trackEvent({
				action: "download_all_panels",
				category: "user_interaction",
				value: generatedPanels.length,
			});
		} finally {
			setIsDownloadingPanels(false);
		}
	};

	const downloadPanel = (panel: GeneratedPanel) => {
		downloadImage(panel.image, `comic-panel-${panel.panelNumber}.jpg`);
	};

	const downloadCharacter = (character: CharacterReference) => {
		downloadImage(
			character.image,
			`character-${character.name.toLowerCase().replace(/\s+/g, "-")}.jpg`,
		);
	};

	const downloadAllCharacters = async () => {
		setIsDownloadingCharacters(true);
		try {
			const images = characterReferences.map((char) => ({
				url: char.image,
				filename: `character-${char.name.toLowerCase().replace(/\s+/g, "-")}.jpg`,
			}));
			await downloadImagesAsZip(images, "character-designs.zip");
			trackDownload("zip");
			trackEvent({
				action: "download_all_characters",
				category: "user_interaction",
				value: characterReferences.length,
			});
		} finally {
			setIsDownloadingCharacters(false);
		}
	};

	const openImageModal = useCallback((imageUrl: string, altText: string) => {
		setModalImage(imageUrl);
		setModalAlt(altText);
		trackEvent({
			action: "open_image_modal",
			category: "user_interaction",
			label: altText,
		});
	}, []);

	const closeImageModal = useCallback(() => {
		setModalImage(null);
		setModalAlt("");
	}, []);

	// Cancel clearing data
	const cancelClearData = useCallback(() => {
		setShowConfirmClearModal(false);
	}, []);

	// Handle error modal
	const closeErrorModal = useCallback(() => {
		setShowErrorModal(false);
		setErrorModalMessage("");
	}, []);

	const showError = useCallback((message: string) => {
		setError(message);
		setErrorModalMessage(message);
		setShowErrorModal(true);
	}, []);

	// Handle escape key for modals
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (showErrorModal) {
					closeErrorModal();
				} else if (showConfirmClearModal) {
					cancelClearData();
				} else if (modalImage) {
					closeImageModal();
				}
			}
		};

		if (modalImage || showConfirmClearModal || showErrorModal) {
			document.addEventListener("keydown", handleEscape);
			return () => document.removeEventListener("keydown", handleEscape);
		}
	}, [
		modalImage,
		showConfirmClearModal,
		showErrorModal,
		closeImageModal,
		cancelClearData,
		closeErrorModal,
	]);

	const clearResults = () => {
		setStoryAnalysis(null);
		setCharacterReferences([]);
		setStoryBreakdown(null);
		setGeneratedPanels([]);
		setFailedPanels(new Set());
		setError(null);
		setFailedStep(null);
		setFailedPanel(null);
		setUploadedCharacterReferences([]);
		setUploadedSettingReferences([]);
		// Clear edit states
		setEditingStoryAnalysis(false);
		setEditingStoryBreakdown(false);
		setTempStoryAnalysis(null);
		setTempStoryBreakdown(null);
		// Clear generation state
		setGenerationState({
			isGenerating: false,
			isPaused: false,
			currentPanel: 0,
			totalPanels: 0,
			completedPanels: 0,
			failedPanels: [],
		});
	};

	// 项目管理函数
	const handleProjectSelect = async (projectId: string) => {
		try {
			setIsLoadingState(true);

			// 加载项目数据
			const projectData = await loadProjectData(projectId);
			if (projectData) {
				// 清除当前数据
				clearResults();

				// 设置新的项目数据
				setStory(projectData.story);
				setStyle(projectData.style);
				setImageSize(projectData.imageSize || DEFAULT_IMAGE_SIZE);
				setStoryAnalysis(projectData.storyAnalysis);
				setCharacterReferences(projectData.characterReferences);
				setStoryBreakdown(projectData.storyBreakdown);
				setGeneratedPanels(projectData.generatedPanels);
				setUploadedCharacterReferences(projectData.uploadedCharacterReferences);
				setUploadedSettingReferences(projectData.uploadedSettingReferences);

				// 设置当前项目
				setCurrentProject(projectId);
				setCurrentProjectId(projectId);

				// Auto-expand sections with content
				const sectionsToExpand: string[] = [];
				if (projectData.storyAnalysis) sectionsToExpand.push("analysis");
				if (projectData.characterReferences.length > 0) sectionsToExpand.push("characters");
				if (projectData.storyBreakdown) sectionsToExpand.push("layout");
				if (projectData.generatedPanels.length > 0) sectionsToExpand.push("panels");
				if (projectData.generatedPanels.length > 0 && projectData.characterReferences.length > 0) {
					sectionsToExpand.push("compositor");
				}
				setOpenAccordions(new Set(sectionsToExpand));
			}
		} catch (error) {
			console.error("Failed to load project:", error);
		} finally {
			setIsLoadingState(false);
		}
	};

	const handleNewProject = () => {
		// 清除所有数据，开始新项目
		clearResults();
		setStory("");
		setStyle("manga");
		setCurrentProjectId(null);
		setOpenAccordions(new Set());

		// 清除当前项目设置
		localStorage.removeItem("manga-current-project");
	};

	// Edit functions
	const startEditingStoryAnalysis = () => {
		setTempStoryAnalysis(storyAnalysis);
		setEditingStoryAnalysis(true);
	};

	const saveStoryAnalysisEdit = () => {
		if (tempStoryAnalysis) {
			setStoryAnalysis(tempStoryAnalysis);
			setEditingStoryAnalysis(false);
			setTempStoryAnalysis(null);
			// Clear subsequent data that depends on story analysis
			setCharacterReferences([]);
			setStoryBreakdown(null);
			setGeneratedPanels([]);
			setFailedPanels(new Set());
		}
	};

	const cancelStoryAnalysisEdit = () => {
		setEditingStoryAnalysis(false);
		setTempStoryAnalysis(null);
	};

	const startEditingStoryBreakdown = () => {
		setTempStoryBreakdown(storyBreakdown);
		setEditingStoryBreakdown(true);
	};

	const saveStoryBreakdownEdit = () => {
		if (tempStoryBreakdown) {
			setStoryBreakdown(tempStoryBreakdown);
			setEditingStoryBreakdown(false);
			setTempStoryBreakdown(null);
			// Clear panels that depend on story breakdown
			setGeneratedPanels([]);
			setFailedPanels(new Set());
		}
	};

	const cancelStoryBreakdownEdit = () => {
		setEditingStoryBreakdown(false);
		setTempStoryBreakdown(null);
	};

	// Regenerate functions from edited content
	const regenerateFromStoryAnalysis = async () => {
		if (!storyAnalysis) return;

		setIsGenerating(true);
		setCurrentStepText(t("generatingCharacters"));

		try {
			// Clear dependent data
			setCharacterReferences([]);
			setStoryBreakdown(null);
			setGeneratedPanels([]);
			setFailedPanels(new Set());

			// Generate characters from edited story analysis
			const charRefResponse = await fetch("/api/generate-character-refs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					characters: storyAnalysis.characters,
					setting: storyAnalysis.setting,
					style,
					uploadedCharacterReferences,
					language: i18n?.language || 'en',
					aiModel,
				}),
			});

			if (!charRefResponse.ok) {
				const errorMessage = await handleApiError(charRefResponse, "Failed to generate character references");
				throw new Error(errorMessage);
			}

			const { characterReferences } = await charRefResponse.json();
			setCharacterReferences(characterReferences);
			setCurrentStepText(t("charactersGenerated"));
		} catch (error) {
			console.error("Error regenerating from story analysis:", error);
			setError(error instanceof Error ? error.message : "Failed to regenerate from story analysis");
		} finally {
			setIsGenerating(false);
		}
	};

	const regenerateFromStoryBreakdown = async () => {
		if (!storyBreakdown) return;

		setIsGenerating(true);
		setCurrentStepText(t("generatingPanels"));

		try {
			// Clear dependent data
			setGeneratedPanels([]);
			setFailedPanels(new Set());

			// Generate panels from edited story breakdown
			const panels: GeneratedPanel[] = [];

			for (let i = 0; i < storyBreakdown.panels.length; i++) {
				const panel = storyBreakdown.panels[i];
				setCurrentStepText(`${t("generatingPanel", { number: i + 1 })}/${storyBreakdown.panels.length}...`);

				const panelResponse = await fetch("/api/generate-panel", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						panel,
						characterReferences,
						setting: storyAnalysis?.setting,
						scenes: storyAnalysis?.scenes,
						uploadedCharacterReferences,
						uploadedSettingReferences,
						style,
						language: i18n?.language || 'en',
						aiModel,
						imageSize,
					}),
				});

				if (!panelResponse.ok) {
					await handleApiError(panelResponse, `Failed to generate panel ${i + 1}`);
					setFailedPanels(prev => new Set([...prev, i + 1]));
					console.warn(`Panel ${i + 1} failed, continuing with next panels`);
					continue;
				}

				const { generatedPanel } = await panelResponse.json();
				panels.push(generatedPanel);
				setGeneratedPanels([...panels]);
			}

			setCurrentStepText(t("panelsGenerated"));
		} catch (error) {
			console.error("Error regenerating from story breakdown:", error);
			setError(error instanceof Error ? error.message : "Failed to regenerate from story breakdown");
		} finally {
			setIsGenerating(false);
		}
	};

	// Retry functions for individual steps
	const retryFromStep = async (step: FailedStep) => {
		if (!step) return;

		trackEvent({
			action: "retry_from_step",
			category: "user_interaction",
			label: step,
		});

		setIsGenerating(true);
		setError(null);
		setFailedStep(null);
		setFailedPanel(null);

		try {
			switch (step) {
				case "analysis":
					await retryAnalysis();
					break;
				case "characters":
					if (storyAnalysis) await retryCharacters();
					break;
				case "layout":
					if (storyAnalysis && characterReferences.length > 0)
						await retryLayout();
					break;
				case "panels":
					if (storyAnalysis && characterReferences.length > 0 && storyBreakdown)
						await retryPanels();
					break;
			}

			setCurrentStepText("Complete! 🎉");
			setIsGenerating(false);
		} catch (error) {
			console.error("Retry error:", error);
			showError(error instanceof Error ? error.message : "Retry failed");
			setIsGenerating(false);
			setFailedStep(step);
		}
	};

	const retryAnalysis = async () => {
		setCurrentStepText("Retrying story analysis...");

		// 添加超时控制
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 120000);

		let response;
		try {
			response = await fetch("/api/analyze-story", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					story,
					style,
					language: i18n?.language || 'en'
				}),
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
		} catch (fetchError) {
			clearTimeout(timeoutId);
			if (fetchError instanceof Error && fetchError.name === 'AbortError') {
				throw new Error('故事分析重试超时。请尝试简化故事内容或稍后重试。');
			}
			throw fetchError;
		}

		if (!response.ok) {
			throw new Error(
				await handleApiError(response, "Failed to analyze story"),
			);
		}

		const responseData = await response.json();
		const { analysis } = responseData;

		setStoryAnalysis(analysis);
		setOpenAccordions(new Set(["analysis"])); // Auto-expand analysis section on retry
	};

	const retryCharacters = async () => {
		if (!storyAnalysis) throw new Error("Story analysis required");

		setCurrentStepText("Retrying character generation...");

		// 添加超时控制
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 180000);

		let response;
		try {
			response = await fetch("/api/generate-character-refs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					characters: storyAnalysis.characters,
					setting: storyAnalysis.setting,
					style,
					uploadedCharacterReferences,
					language: i18n?.language || 'en',
					aiModel,
				}),
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
		} catch (fetchError) {
			clearTimeout(timeoutId);
			if (fetchError instanceof Error && fetchError.name === 'AbortError') {
				throw new Error('角色生成重试超时，请检查网络连接后重试');
			}
			throw fetchError;
		}

		if (!response.ok) {
			throw new Error(
				await handleApiError(
					response,
					"Failed to generate character references",
				),
			);
		}

		const { characterReferences } = await response.json();
		setCharacterReferences(characterReferences);
		setOpenAccordions(new Set(["characters"])); // Auto-expand characters section on retry
	};

	const retryLayout = async () => {
		if (!storyAnalysis) throw new Error("Story analysis required");

		setCurrentStepText("Retrying comic layout...");
		const response = await fetch("/api/chunk-story", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				story,
				characters: storyAnalysis.characters,
				setting: storyAnalysis.setting,
				style,
			}),
		});

		if (!response.ok) {
			throw new Error(
				await handleApiError(response, "Failed to break down story"),
			);
		}

		const { storyBreakdown: breakdown } = await response.json();
		setStoryBreakdown(breakdown);
		setOpenAccordions(new Set(["layout"])); // Auto-expand layout section on retry
	};

	const retryPanels = async () => {
		if (!storyAnalysis || !storyBreakdown || characterReferences.length === 0) {
			throw new Error("Previous steps required");
		}

		const panels: GeneratedPanel[] = [];

		for (let i = 0; i < storyBreakdown.panels.length; i++) {
			const panel = storyBreakdown.panels[i];
			setCurrentStepText(
				`Retrying panel ${i + 1}/${storyBreakdown.panels.length}...`,
			);

			const response = await fetch("/api/generate-panel", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					panel,
					characterReferences,
					setting: storyAnalysis.setting,
					style,
					uploadedSettingReferences,
					language: i18n?.language || "en",
					aiModel, // 添加AI模型选择
				}),
			});

			if (!response.ok) {
				const errorMessage = await handleApiError(
					response,
					`Failed to generate panel ${i + 1}`,
				);
				setFailedPanel({ step: "panel", panelNumber: i + 1 });
				throw new Error(errorMessage);
			}

			const { generatedPanel } = await response.json();
			panels.push(generatedPanel);
			setGeneratedPanels([...panels]);

			// Auto-expand panels section after first panel is generated
			if (i === 0) {
				setOpenAccordions(new Set(["panels"]));
			}
		}
	};

	// Individual section re-run functions
	const rerunAnalysis = async () => {
		if (!story.trim()) return;

		trackEvent({
			action: "rerun_section",
			category: "user_interaction",
			label: "analysis",
		});

		setIsRerunningAnalysis(true);
		setError(null);

		try {
			setCurrentStepText("Re-analyzing your story...");

			// 添加超时控制
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 120000);

			let response;
			try {
				response = await fetch("/api/analyze-story", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						story,
						style,
						language: i18n?.language || 'en'
					}),
					signal: controller.signal,
				});
				clearTimeout(timeoutId);
			} catch (fetchError) {
				clearTimeout(timeoutId);
				if (fetchError instanceof Error && fetchError.name === 'AbortError') {
					throw new Error('故事重新分析超时。请尝试简化故事内容或稍后重试。');
				}
				throw fetchError;
			}

			if (!response.ok) {
				throw new Error(
					await handleApiError(response, "Failed to re-analyze story"),
				);
			}

			const responseData = await response.json();
			const { analysis } = responseData;

			setStoryAnalysis(analysis);
			setOpenAccordions(new Set(["analysis"]));
			setCurrentStepText("Analysis updated! 🎉");
		} catch (error) {
			console.error("Re-run analysis error:", error);
			showError(error instanceof Error ? error.message : "Re-analysis failed");
		} finally {
			setIsRerunningAnalysis(false);
		}
	};

	const rerunCharacterDesigns = async () => {
		if (!storyAnalysis) return;

		trackEvent({
			action: "rerun_section",
			category: "user_interaction",
			label: "characters",
		});

		setIsRerunningCharacters(true);
		setError(null);

		try {
			setCurrentStepText("Re-creating character designs...");

			// 添加超时控制
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 180000);

			let response;
			try {
				response = await fetch("/api/generate-character-refs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						characters: storyAnalysis.characters,
						setting: storyAnalysis.setting,
						style,
						uploadedCharacterReferences,
						language: i18n?.language || 'en',
						aiModel,
					}),
					signal: controller.signal,
				});
				clearTimeout(timeoutId);
			} catch (fetchError) {
				clearTimeout(timeoutId);
				if (fetchError instanceof Error && fetchError.name === 'AbortError') {
					throw new Error('角色重新生成超时，请检查网络连接后重试');
				}
				throw fetchError;
			}

			if (!response.ok) {
				throw new Error(
					await handleApiError(
						response,
						"Failed to regenerate character references",
					),
				);
			}

			const { characterReferences } = await response.json();
			setCharacterReferences(characterReferences);
			setOpenAccordions(new Set(["characters"]));
			setCurrentStepText("Character designs updated! 🎉");
		} catch (error) {
			console.error("Re-run characters error:", error);
			showError(
				error instanceof Error
					? error.message
					: "Character regeneration failed",
			);
		} finally {
			setIsRerunningCharacters(false);
		}
	};

	const rerunLayoutPlan = async () => {
		if (!storyAnalysis) return;

		trackEvent({
			action: "rerun_section",
			category: "user_interaction",
			label: "layout",
		});

		setIsRerunningLayout(true);
		setError(null);

		try {
			setCurrentStepText("Re-planning comic layout...");
			const response = await fetch("/api/chunk-story", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					story,
					characters: storyAnalysis.characters,
					setting: storyAnalysis.setting,
					scenes: storyAnalysis.scenes,
					style,
					language: i18n?.language || 'en',
				}),
			});

			if (!response.ok) {
				throw new Error(
					await handleApiError(
						response,
						"Failed to regenerate story breakdown",
					),
				);
			}

			const { storyBreakdown: breakdown } = await response.json();
			setStoryBreakdown(breakdown);
			setOpenAccordions(new Set(["layout"]));
			setCurrentStepText("Layout plan updated! 🎉");
		} catch (error) {
			console.error("Re-run layout error:", error);
			showError(
				error instanceof Error ? error.message : "Layout regeneration failed",
			);
		} finally {
			setIsRerunningLayout(false);
		}
	};

	const rerunPanels = async () => {
		console.log('🔄 Starting rerunPanels function');
		console.log('📊 Current state:', {
			storyAnalysis: !!storyAnalysis,
			storyBreakdown: !!storyBreakdown,
			characterReferencesCount: characterReferences.length,
			currentLanguage: i18n?.language
		});
		
		if (!storyAnalysis || !storyBreakdown || characterReferences.length === 0) {
			console.error('❌ Missing required data for rerunPanels:', {
				storyAnalysis: !!storyAnalysis,
				storyBreakdown: !!storyBreakdown,
				characterReferencesCount: characterReferences.length
			});
			return;
		}

		trackEvent({
			action: "rerun_section",
			category: "user_interaction",
			label: "panels",
		});

		setIsRerunningPanels(true);
		setError(null);
		setGeneratedPanels([]); // Clear existing panels
		setFailedPanels(new Set()); // Clear failed panels

		try {
			const panels: GeneratedPanel[] = [];
			console.log(`🎯 Processing ${storyBreakdown.panels.length} panels using batch generation`);

			// 确定批次大小：根据面板数量和AI模型调整
			const getBatchSize = () => {
				const totalPanels = storyBreakdown.panels.length;
				const isVolcEngine = aiModel === 'volcengine';

				if (totalPanels <= 3) return totalPanels;
				if (isVolcEngine) return Math.min(3, totalPanels); // VolcEngine限制更严格
				return Math.min(5, totalPanels); // Gemini可以更多并行
			};

			const batchSize = getBatchSize();
			const totalBatches = Math.ceil(storyBreakdown.panels.length / batchSize);
			console.log(`📦 Using batch size: ${batchSize}, total batches: ${totalBatches}`);

			for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
				const startIndex = batchIndex * batchSize;
				const endIndex = Math.min(startIndex + batchSize, storyBreakdown.panels.length);
				const batchPanels = storyBreakdown.panels.slice(startIndex, endIndex);

				console.log(`🎨 Processing batch ${batchIndex + 1}/${totalBatches}:`, batchPanels.map(p => p.panelNumber));

				setCurrentStepText(
					`Re-generating panels ${startIndex + 1}-${endIndex}/${storyBreakdown.panels.length}... (Batch ${batchIndex + 1}/${totalBatches})`,
				);

				const requestBody = {
					panels: batchPanels,
					characterReferences,
					setting: storyAnalysis.setting,
					scenes: storyAnalysis.scenes,
					style,
					uploadedSettingReferences,
					language: i18n?.language || "en",
					aiModel,
					imageSize,
					batchSize: batchPanels.length,
				};

				console.log(`📤 Batch API Request ${batchIndex + 1}:`, {
					url: '/api/generate-panels-batch',
					method: 'POST',
					panelsCount: batchPanels.length,
					language: requestBody.language,
					style: requestBody.style,
				});

				try {
					const response = await fetch("/api/generate-panels-batch", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(requestBody),
					});

					console.log(`📥 Batch API Response ${batchIndex + 1}:`, {
						status: response.status,
						statusText: response.statusText,
						ok: response.ok,
					});

					if (!response.ok) {
						console.error(`❌ Batch API Error ${batchIndex + 1}:`, {
							status: response.status,
							statusText: response.statusText
						});

						// 回退到单个面板生成
						console.warn(`Batch ${batchIndex + 1} failed, falling back to individual panel generation`);
						for (const panel of batchPanels) {
							try {
								const panelResponse = await fetch("/api/generate-panel", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										panel,
										characterReferences,
										setting: storyAnalysis.setting,
										style,
										uploadedSettingReferences,
										language: i18n?.language || "en",
										aiModel,
										imageSize,
									}),
								});

								if (panelResponse.ok) {
									const { generatedPanel } = await panelResponse.json();
									panels.push(generatedPanel);
									setGeneratedPanels([...panels]);
									console.log(`🎉 Successfully generated panel ${panel.panelNumber} via fallback`);
								} else {
									setFailedPanels(prev => new Set([...prev, panel.panelNumber]));
									console.warn(`Panel ${panel.panelNumber} failed in fallback`);
								}
							} catch (error) {
								console.error(`Failed to generate panel ${panel.panelNumber} in fallback:`, error);
								setFailedPanels(prev => new Set([...prev, panel.panelNumber]));
							}
						}
						continue;
					}

					const batchResult = await response.json();
					console.log(`✅ Batch result ${batchIndex + 1}:`, {
						success: batchResult.success,
						resultsCount: batchResult.results?.length || 0,
						errorsCount: batchResult.errors?.length || 0,
					});

					// 处理批次结果
					if (batchResult.success && batchResult.results) {
						// 按面板编号排序确保顺序正确
						const sortedResults = batchResult.results.sort((a: any, b: any) => a.panelNumber - b.panelNumber);

						sortedResults.forEach((result: any) => {
							const generatedPanel = {
								panelNumber: result.panelNumber,
								image: result.image,
								modelUsed: result.modelUsed,
							};
							panels.push(generatedPanel);
							console.log(`🎉 Successfully added panel ${result.panelNumber} from batch`);
						});

						// 更新UI显示
						setGeneratedPanels([...panels]);

						if (panels.length === 1) {
							setOpenAccordions(new Set(["panels"]));
						}
					}

					// 处理批次中的错误
					if (batchResult.errors && batchResult.errors.length > 0) {
						console.warn(`Batch ${batchIndex + 1} had ${batchResult.errors.length} errors:`, batchResult.errors);
						batchResult.errors.forEach((error: any) => {
							setFailedPanels(prev => new Set([...prev, error.panelNumber]));
						});
					}

				} catch (error) {
					console.error(`Batch ${batchIndex + 1} failed:`, error);

					// 标记整个批次的面板为失败
					batchPanels.forEach(panel => {
						setFailedPanels(prev => new Set([...prev, panel.panelNumber]));
					});
				}

				// 批次间延迟
				if (batchIndex < totalBatches - 1) {
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}



			console.log('🏁 All panels generated successfully:', panels.length);
			setCurrentStepText("Panels updated! 🎉");
		} catch (error) {
			console.error("💥 Re-run panels error:", {
				error: error,
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			});
			showError(
				error instanceof Error ? error.message : "Panel regeneration failed",
			);
		} finally {
			setIsRerunningPanels(false);
			console.log('🔚 rerunPanels function completed');
		}
	};

	// Retry a specific panel that failed
	const retryFailedPanel = async (panelNumber: number) => {
		if (!storyAnalysis || !storyBreakdown || characterReferences.length === 0) {
			return;
		}

		const panelIndex = panelNumber - 1;
		const panel = storyBreakdown.panels[panelIndex];
		if (!panel) return;

		trackEvent({
			action: "retry_failed_panel",
			category: "user_interaction",
			label: `panel_${panelNumber}`,
		});

		setIsGenerating(true);
		setError(null);
		setFailedPanel(null);
		setCurrentStepText(`Retrying panel ${panelNumber}...`);

		try {
			const response = await fetch("/api/generate-panel", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					panel,
					characterReferences,
					setting: storyAnalysis.setting,
					style,
					uploadedSettingReferences,
					language: i18n?.language || "en",
					aiModel, // 添加AI模型选择
					imageSize, // 添加图片尺寸配置
				}),
			});

			if (!response.ok) {
				const errorMessage = await handleApiError(
					response,
					`Failed to regenerate panel ${panelNumber}`,
				);
				setFailedPanel({ step: "panel", panelNumber });
				throw new Error(errorMessage);
			}

			const { generatedPanel } = await response.json();

			// Update the panels array with the new panel
			const updatedPanels = [...generatedPanels];
			// Check if panel already exists in the array
			const existingIndex = updatedPanels.findIndex(
				(p) => p.panelNumber === panelNumber,
			);
			if (existingIndex >= 0) {
				updatedPanels[existingIndex] = generatedPanel;
			} else {
				// Insert at correct position
				updatedPanels.splice(panelIndex, 0, generatedPanel);
				updatedPanels.sort((a, b) => a.panelNumber - b.panelNumber);
			}
			setGeneratedPanels(updatedPanels);

			// 从失败列表中移除成功生成的面板
			setFailedPanels(prev => {
				const newSet = new Set(prev);
				newSet.delete(panelNumber);
				return newSet;
			});

			// Continue generating remaining panels if any
			const expectedCount = storyBreakdown.panels.length;
			if (updatedPanels.length < expectedCount) {
				for (let i = updatedPanels.length; i < expectedCount; i++) {
					const nextPanel = storyBreakdown.panels[i];
					setCurrentStepText(`Generating panel ${i + 1}/${expectedCount}...`);

					const nextResponse = await fetch("/api/generate-panel", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							panel: nextPanel,
							characterReferences,
							setting: storyAnalysis.setting,
							style,
							uploadedSettingReferences,
							language: i18n?.language || "en",
							aiModel, // 添加AI模型选择
							imageSize, // 添加图片尺寸配置
						}),
					});

					if (!nextResponse.ok) {
						const errorMessage = await handleApiError(
							nextResponse,
							`Failed to generate panel ${i + 1}`,
						);
						setFailedPanel({ step: "panel", panelNumber: i + 1 });
						throw new Error(errorMessage);
					}

					const { generatedPanel: nextGeneratedPanel } =
						await nextResponse.json();
					updatedPanels.push(nextGeneratedPanel);
					setGeneratedPanels([...updatedPanels]);
				}
			}

			setCurrentStepText("Complete! 🎉");
			setIsGenerating(false);
		} catch (error) {
			console.error("Retry panel error:", error);
			showError(error instanceof Error ? error.message : "Panel retry failed");
			setIsGenerating(false);
		}
	};

	// Helper function to convert VolcEngine URLs to proxy URLs
	const getProxyImageUrl = (originalUrl: string): string => {
		if (!originalUrl || originalUrl.includes('placeholder') || originalUrl.startsWith('data:')) {
			return originalUrl;
		}

		// Check if it's a VolcEngine URL that needs proxying
		const volcEngineDomains = [
			'ark-content-generation-v2-cn-beijing.tos-cn-beijing.volces.com',
			'tos-cn-beijing.volces.com'
		];

		try {
			const urlObj = new URL(originalUrl);
			const needsProxy = volcEngineDomains.some(domain =>
				urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
			);

			if (needsProxy) {
				// Convert to proxy URL
				return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
			}
		} catch (error) {
			console.warn('Invalid URL:', originalUrl);
		}

		return originalUrl;
	};



	// Comic compositor functionality
	const preloadImages = async (imageUrls: string[]): Promise<void> => {
		return new Promise((resolve) => {
			let loadedCount = 0;
			const totalImages = imageUrls.length;
			
			if (totalImages === 0) {
				resolve();
				return;
			}

			const handleImageLoad = () => {
				loadedCount++;
				if (loadedCount === totalImages) {
					resolve();
				}
			};

			const handleImageError = (url: string) => {
				console.warn(`Failed to preload image: ${url}`);
				handleImageLoad(); // Continue even if some images fail
			};

			imageUrls.forEach((url) => {
				if (!url || url.includes('placeholder') || url.startsWith('data:image/svg')) {
					// Skip placeholder images
					handleImageLoad();
					return;
				}

				// Use proxy URL for VolcEngine images
				const proxyUrl = getProxyImageUrl(url);
				console.log(`Preloading image: ${url} -> ${proxyUrl}`);

				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.onload = handleImageLoad;
				img.onerror = () => handleImageError(proxyUrl);
				img.src = proxyUrl;
			});

			// Set a timeout to prevent hanging
			setTimeout(() => {
				if (loadedCount < totalImages) {
					console.warn(`Timeout: Only ${loadedCount}/${totalImages} images loaded`);
					resolve();
				}
			}, 10000); // 10 second timeout
		});
	};

	const generateComposite = async () => {
		if (!compositorRef.current || generatedPanels.length === 0) return;

		setIsGeneratingComposite(true);
		try {
			// Show initial loading message
			console.log('Starting composite generation...');
			
			// Debug: Log all panel data to understand what we're working with
			console.log('=== DEBUGGING COMPOSITE GENERATION ===');
			console.log('Total generatedPanels:', generatedPanels.length);
			generatedPanels.forEach((panel, index) => {
				console.log(`Panel ${index + 1}:`, {
					panelNumber: panel.panelNumber,
					image: panel.image,
					imageType: typeof panel.image,
					imageLength: panel.image?.length,
					isPlaceholder: panel.image?.includes('placeholder'),
					isDataUrl: panel.image?.startsWith('data:'),
					isHttpUrl: panel.image?.startsWith('http')
				});
			});
			
			// Extract all image URLs from generated panels
			const imageUrls = generatedPanels
				.map(panel => panel.image)
				.filter(url => url && typeof url === 'string' && !url.includes('placeholder'));

			console.log(`Found ${imageUrls.length} images to preload:`, imageUrls);
			console.log('Image URLs:', imageUrls);
			
			// Validate that we have actual images to work with
			if (imageUrls.length === 0) {
				throw new Error('No valid images found in generated panels. Please ensure panels are properly generated before creating composite.');
			}

			// Check if all panels have valid images
			const panelsWithoutImages = generatedPanels.filter(panel => 
				!panel.image || panel.image.includes('placeholder') || panel.image.startsWith('data:image/svg')
			);
			
			if (panelsWithoutImages.length > 0) {
				console.warn(`Found ${panelsWithoutImages.length} panels with placeholder images`);
				showError(`Warning: ${panelsWithoutImages.length} panels still have placeholder images. The composite may not include all panels.`);
			}
			
			// Preload all images before capturing
			try {
				await preloadImages(imageUrls);
				console.log('All images preloaded successfully');
			} catch (error) {
				console.error('Error preloading images:', error);
				throw new Error('Failed to preload images. Please check your internet connection and try again.');
			}
			
			// Wait a bit more to ensure DOM is updated
			await new Promise(resolve => setTimeout(resolve, 500));

			// Final validation: check if images are actually loaded in the DOM
			const domImages = compositorRef.current.querySelectorAll('img');
			const unloadedImages = Array.from(domImages).filter(img => 
				!img.complete || img.naturalWidth === 0
			);
			
			if (unloadedImages.length > 0) {
				console.warn(`Found ${unloadedImages.length} unloaded images in DOM`);
				// Try to wait a bit more for these images
				await new Promise(resolve => setTimeout(resolve, 1000));
			}

			// Debug: check the compositor element
			console.log("compositorRef.current:", compositorRef.current);
			console.log("Element dimensions:", {
				width: compositorRef.current?.offsetWidth,
				height: compositorRef.current?.offsetHeight,
				scrollWidth: compositorRef.current?.scrollWidth,
				scrollHeight: compositorRef.current?.scrollHeight,
			});

			const canvas = await html2canvas(compositorRef.current, {
				backgroundColor: "#ffffff",
				scale: 2, // Higher quality
				useCORS: true,
				allowTaint: false,
				logging: false, // Disable logging for production
				width: compositorRef.current.scrollWidth,
				height: compositorRef.current.scrollHeight,
				scrollX: 0,
				scrollY: 0,
				windowWidth: compositorRef.current.scrollWidth,
				windowHeight: compositorRef.current.scrollHeight, // Disable proxy to avoid CORS issues
				ignoreElements: (element) => {
					// Skip elements that might cause issues
					const classList = element.classList;
					return classList?.contains('loading-indicator') || 
						   classList?.contains('error-message') ||
						   element.tagName === 'SCRIPT' ||
						   element.tagName === 'NOSCRIPT' || false;
				},
				onclone: (clonedDoc) => {
					// Ensure all images in the cloned document are properly loaded
					const images = clonedDoc.querySelectorAll('img');
					images.forEach((img) => {
						if (img.src && !img.complete) {
							// Force image to load synchronously if possible
							img.loading = 'eager';
						}
						// Remove any error handlers that might interfere
						img.onerror = null;
					});
					return clonedDoc;
				},
			});

			// Convert to blob and download
			canvas.toBlob((blob) => {
				if (blob) {
					const url = URL.createObjectURL(blob);
					const link = document.createElement("a");
					link.href = url;
					link.download = `comic-page-${style}-${Date.now()}.png`;
					link.click();
					URL.revokeObjectURL(url);
				}
			}, "image/png");
			trackEvent({
				action: "generate_composite",
				category: "user_interaction",
				label: style,
			});
		} catch (error) {
			console.error("Failed to generate composite:", error);
			
			// Provide specific error messages based on the error type
			let errorMessage = "Failed to generate composite image";
			if (error instanceof Error) {
				if (error.message.includes('No valid images')) {
					errorMessage = "No valid images found. Please ensure all panels are properly generated before creating the composite.";
				} else if (error.message.includes('Failed to preload')) {
					errorMessage = "Failed to load panel images. Please check your internet connection and try again.";
				} else if (error.message.includes('html2canvas')) {
					errorMessage = "Failed to capture the comic layout. This might be due to image loading issues or browser limitations.";
				} else {
					errorMessage = `Composite generation failed: ${error.message}`;
				}
			}
			
			showError(errorMessage);
			trackError(
				"composite_generation_failed",
				error instanceof Error ? error.message : "Unknown error",
			);
		} finally {
			setIsGeneratingComposite(false);
			console.log('Composite generation process completed');
		}
	};

	// 自动下载所有页面的合成图片
	const generateAllPagesComposite = async () => {
		if (!compositorRef.current || generatedPanels.length === 0) return;

		setIsGeneratingComposite(true);
		try {
			console.log(`开始生成所有页面的合成图片，共 ${totalPages} 页`);

			// 保存当前页面
			const originalPage = currentPage;

			for (let page = 1; page <= totalPages; page++) {
				console.log(`正在生成第 ${page} 页 / 共 ${totalPages} 页`);

				// 切换到当前页面
				setCurrentPage(page);

				// 等待页面切换完成和DOM更新
				await new Promise(resolve => setTimeout(resolve, 1000));

				// 计算当前页面的面板范围
				const pageStartIndex = (page - 1) * PANELS_PER_PAGE;
				const pageEndIndex = Math.min(pageStartIndex + PANELS_PER_PAGE, generatedPanels.length);
				const pagePanels = generatedPanels.slice(pageStartIndex, pageEndIndex);

				// 提取当前页面的图片URL
				const imageUrls = pagePanels
					.map(panel => panel.image)
					.filter(url => url && typeof url === 'string' && !url.includes('placeholder'));

				if (imageUrls.length === 0) {
					console.warn(`第 ${page} 页没有有效的图片，跳过`);
					continue;
				}

				// 预加载当前页面的图片
				try {
					await preloadImages(imageUrls);
					console.log(`第 ${page} 页图片预加载完成`);
				} catch (error) {
					console.error(`第 ${page} 页图片预加载失败:`, error);
					continue;
				}

				// 等待DOM更新
				await new Promise(resolve => setTimeout(resolve, 500));

				// 生成当前页面的合成图片
				const canvas = await html2canvas(compositorRef.current, {
					backgroundColor: "#ffffff",
					scale: 2,
					useCORS: true,
					allowTaint: false,
					logging: false,
					width: compositorRef.current.scrollWidth,
					height: compositorRef.current.scrollHeight,
					scrollX: 0,
					scrollY: 0,
					windowWidth: compositorRef.current.scrollWidth,
					windowHeight: compositorRef.current.scrollHeight,
					ignoreElements: (element) => {
						const classList = element.classList;
						return classList?.contains('loading-indicator') ||
							   classList?.contains('error-message') ||
							   element.tagName === 'SCRIPT' ||
							   element.tagName === 'NOSCRIPT' || false;
					},
					onclone: (clonedDoc) => {
						const images = clonedDoc.querySelectorAll('img');
						images.forEach((img) => {
							if (img.src && !img.complete) {
								img.loading = 'eager';
							}
							img.onerror = null;
						});
						return clonedDoc;
					},
				});

				// 下载当前页面的图片
				await new Promise<void>((resolve) => {
					canvas.toBlob((blob) => {
						if (blob) {
							const url = URL.createObjectURL(blob);
							const link = document.createElement("a");
							link.href = url;
							link.download = `comic-page-${page}-of-${totalPages}-${style}-${Date.now()}.png`;
							link.click();
							URL.revokeObjectURL(url);
							console.log(`第 ${page} 页下载完成`);
						}
						resolve();
					}, "image/png");
				});

				// 页面间稍作延迟，避免浏览器阻止多个下载
				await new Promise(resolve => setTimeout(resolve, 1000));
			}

			// 恢复到原始页面
			setCurrentPage(originalPage);

			console.log(`所有 ${totalPages} 页合成图片生成完成`);
			trackEvent({
				action: "generate_all_pages_composite",
				category: "user_interaction",
				label: `${totalPages}_pages_${style}`,
			});

		} catch (error) {
			console.error("生成所有页面合成图片失败:", error);
			let errorMessage = "生成所有页面合成图片失败";
			if (error instanceof Error) {
				errorMessage = `生成失败: ${error.message}`;
			}
			showError(errorMessage);
			trackError(
				"all_pages_composite_generation_failed",
				error instanceof Error ? error.message : "Unknown error",
			);
		} finally {
			setIsGeneratingComposite(false);
		}
	};

	const downloadStoryAnalysis = () => {
		if (!storyAnalysis) return;

		const exportData = {
			metadata: {
				title: "Story Analysis Export",
				exportDate: new Date().toISOString(),
				style: style,
				generatedBy: "Story to Manga Machine",
			},
			storyAnalysis: {
				title: storyAnalysis.title,
				characters: storyAnalysis.characters,
				setting: storyAnalysis.setting,
			},
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `story-analysis-${Date.now()}.json`;
		link.click();
		URL.revokeObjectURL(url);
	};

	const downloadComicLayout = () => {
		if (!storyBreakdown || !storyAnalysis) return;

		const exportData = {
			metadata: {
				title: "Comic Layout Export",
				exportDate: new Date().toISOString(),
				style: style,
				generatedBy: "Story to Manga Machine",
			},
			storyTitle: storyAnalysis.title,
			panelCount: storyBreakdown.panels.length,
			panels: storyBreakdown.panels.map((panel) => ({
				panelNumber: panel.panelNumber,
				sceneDescription: panel.sceneDescription,
				dialogue: panel.dialogue,
				characters: panel.characters,
				cameraAngle: panel.cameraAngle,
				visualMood: panel.visualMood,
			})),
		};

		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `comic-layout-${Date.now()}.json`;
		link.click();
		URL.revokeObjectURL(url);
	};

	// Load state on component mount
	useEffect(() => {
		const initializeApp = async () => {
			try {
				// 首先检查是否有当前项目
				const projectId = getCurrentProjectId();
				setCurrentProjectId(projectId);

				if (projectId) {
					// 加载项目数据
					const projectData = await loadProjectData(projectId);
					if (projectData) {
						setStory(projectData.story);
						setStyle(projectData.style);
						setImageSize(projectData.imageSize || DEFAULT_IMAGE_SIZE);
						setStoryAnalysis(projectData.storyAnalysis);
						setCharacterReferences(projectData.characterReferences);
						setStoryBreakdown(projectData.storyBreakdown);
						setGeneratedPanels(projectData.generatedPanels);
						setUploadedCharacterReferences(projectData.uploadedCharacterReferences);
						setUploadedSettingReferences(projectData.uploadedSettingReferences);

						// 加载生成状态
						if (projectData.generationState) {
							setGenerationState(projectData.generationState);
						}
					} else {
						// 项目数据加载失败，尝试加载旧的存储格式
						const savedState = await loadState();
						if (savedState) {
							setStory(savedState.story);
							setStyle(savedState.style);
							setStoryAnalysis(savedState.storyAnalysis);
							setCharacterReferences(savedState.characterReferences);
							setStoryBreakdown(savedState.storyBreakdown);
							setGeneratedPanels(savedState.generatedPanels);
							setUploadedCharacterReferences(savedState.uploadedCharacterReferences);
							setUploadedSettingReferences(savedState.uploadedSettingReferences);
						}
					}
				} else {
					// 没有当前项目，尝试加载旧的存储格式
					const savedState = await loadState();
					if (savedState) {
						setStory(savedState.story);
						setStyle(savedState.style);
						setStoryAnalysis(savedState.storyAnalysis);
						setCharacterReferences(savedState.characterReferences);
						setStoryBreakdown(savedState.storyBreakdown);
						setGeneratedPanels(savedState.generatedPanels);
						setUploadedCharacterReferences(savedState.uploadedCharacterReferences);
						setUploadedSettingReferences(savedState.uploadedSettingReferences);

						// Auto-expand sections with content
						const sectionsToExpand: string[] = [];
						if (savedState.storyAnalysis) sectionsToExpand.push("analysis");
						if (savedState.characterReferences.length > 0)
							sectionsToExpand.push("characters");
						if (savedState.storyBreakdown) sectionsToExpand.push("layout");
						if (savedState.generatedPanels.length > 0)
							sectionsToExpand.push("panels");
						if (
							savedState.generatedPanels.length > 0 &&
							savedState.characterReferences.length > 0
						) {
							sectionsToExpand.push("compositor");
						}
						setOpenAccordions(new Set(sectionsToExpand));
					}
				}

				// Auto-expand sections with content (for both project and legacy data)
				const sectionsToExpand: string[] = [];
				if (storyAnalysis) sectionsToExpand.push("analysis");
				if (characterReferences.length > 0) sectionsToExpand.push("characters");
				if (storyBreakdown) sectionsToExpand.push("layout");
				if (generatedPanels.length > 0) sectionsToExpand.push("panels");
				if (generatedPanels.length > 0 && characterReferences.length > 0) {
					sectionsToExpand.push("compositor");
				}
				setOpenAccordions(new Set(sectionsToExpand));
			} catch (error) {
				console.error("Failed to load saved state:", error);
			} finally {
				setIsLoadingState(false);
			}
		};

		initializeApp();
	}, []);

	// Save state whenever important data changes
	useEffect(() => {
		if (isLoadingState) return; // Don't save while still loading

		const saveCurrentState = async () => {
			try {
				setIsSavingState(true);

				// 如果有当前项目，保存到项目存储
				if (currentProjectId) {
					await saveProjectData(
						currentProjectId,
						story,
						style,
						storyAnalysis,
						storyBreakdown,
						characterReferences,
						generatedPanels,
						uploadedCharacterReferences,
						uploadedSettingReferences,
						imageSize,
						generationState,
					);
				} else {
					// 否则使用旧的存储方式（向后兼容）
					await saveState(
						story,
						style,
						storyAnalysis,
						storyBreakdown,
						characterReferences,
						generatedPanels,
						uploadedCharacterReferences,
						uploadedSettingReferences,
					);
				}
			} catch (error) {
				console.error("Failed to save state:", error);
			} finally {
				setIsSavingState(false);
			}
		};

		// Only save if we have some meaningful content
		if (
			story.trim() ||
			storyAnalysis ||
			characterReferences.length > 0 ||
			generatedPanels.length > 0 ||
			uploadedCharacterReferences.length > 0 ||
			uploadedSettingReferences.length > 0
		) {
			saveCurrentState();
		}
	}, [
		story,
		style,
		storyAnalysis,
		storyBreakdown,
		characterReferences,
		generatedPanels,
		uploadedCharacterReferences,
		uploadedSettingReferences,
		isLoadingState,
	]);

	// Show confirmation modal for clearing data
	const handleClearAllData = () => {
		setShowConfirmClearModal(true);
	};

	// Actually clear all data after confirmation
	const confirmClearAllData = async () => {
		setShowConfirmClearModal(false);

		try {
			await clearAllData();
			setStory("");
			setStyle("manga");
			setStoryAnalysis(null);
			setCharacterReferences([]);
			setStoryBreakdown(null);
			setGeneratedPanels([]);
			setFailedPanels(new Set());
			setError(null);
			setFailedStep(null);
			setFailedPanel(null);
			setUploadedCharacterReferences([]);
			setUploadedSettingReferences([]);
			setOpenAccordions(new Set());
		} catch (error) {
			console.error("Failed to clear data:", error);
			showError("Failed to clear saved data");
		}
	};

	const hasCompositeContent =
		generatedPanels.length > 0 && characterReferences.length > 0;
	const hasAnyContent =
		story.trim() ||
		storyAnalysis ||
		characterReferences.length > 0 ||
		generatedPanels.length > 0 ||
		uploadedCharacterReferences.length > 0 ||
		uploadedSettingReferences.length > 0;
	const storageInfo = getStorageInfo();

	// Show loading screen while initializing
	if (isLoadingState) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-manga-off-white">
				<div className="text-center">
					<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-manga-black mb-4"></div>
					<p className="text-manga-medium-gray">
						Loading your saved content...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen py-4 px-4 style-comic">
			{/* Top navigation with logo and language switcher */}
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<a
						href="/"
						className="inline-flex items-center hover:opacity-80 transition-opacity"
						title="Story to Manga Machine - Home"
					>
						<img
							src="/logo.png"
							alt="Story to Manga Machine Logo"
							className="w-8 h-8 rounded"
						/>
					</a>
					<button
						onClick={() => setShowProjectManager(true)}
						className="btn-manga-outline text-sm px-3 py-1"
						title={t("projectManager")}
					>
						📁 {t("myProjects", "我的项目")}
					</button>
					<button
						onClick={clearCache}
						className="btn-manga-outline text-sm px-3 py-1"
						title={t("clearCache", "清除缓存（调试用）")}
					>
						🗑️ {t("clearCache", "清除缓存")}
					</button>
				</div>

				{/* Language switcher in top right */}
				<LanguageSwitcher />
			</div>
			<div className="flex flex-col lg:flex-row gap-4 h-full">
				{/* Left Panel - Input */}
				<div className="w-full lg:w-1/3 mb-4 lg:mb-0">
					<div className="comic-panel h-full">
						<div className="mb-2">
							<h1 className="text-2xl text-center text-gradient floating-effect">
								{t("title", {
									style: style === "manga" ? t("manga") : t("comic"),
								})}
							</h1>
						</div>
						<div className="text-center mb-4">
							<img
								src="/description-panel.jpeg"
								alt="Manga artist working at computer creating comic panels"
								className="w-full max-w-md mx-auto rounded-lg shadow-comic border-2 border-manga-black mb-3 floating-effect"
							/>
						</div>
						<p className="text-center text-manga-medium-gray mb-4">
							{t("description")}
						</p>

						{/* Style Selection/Display */}
						<div className="mb-4">
							<div className="text-manga-black font-medium mb-2">
								{t("comicStyle")}
							</div>
							{currentProjectId ? (
								// 项目已创建，只显示当前选择的风格，不允许修改
								<div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
									<div className="flex items-center justify-between">
										<span className="text-sm text-gray-600">
											{t("selectedStyle")}:
										</span>
										<span className="font-medium text-manga-black">
											{style === "manga" && t("japaneseManga")}
											{style === "comic" && t("americanComic")}
											{style === "wuxia" && t("wuxiaCultivation")}
											{style === "healing" && t("healingAnime")}
											{style === "manhwa" && t("koreanManhwa")}
											{style === "cinematic" && t("cinematicStyle")}
											{style === "shojo" && t("shojoManga")}
											{style === "seinen" && t("seinenManga")}
											{style === "chibi" && t("chibiComic")}
											{style === "fantasy" && t("fantasyEpic")}
										</span>
									</div>
									<p className="text-xs text-gray-500 mt-1">
										{t("styleLockedMessage")}
									</p>
								</div>
							) : (
								// 新项目创建，允许选择风格
								<div className="grid grid-cols-2 gap-2">
									{/* Japanese Manga */}
									<div>
										<input
											type="radio"
											className="sr-only"
											name="style"
											id={mangaRadioId}
											checked={style === "manga"}
											onChange={() => {
												setStyle("manga");
												trackEvent({
													action: "change_style",
													category: "user_interaction",
													label: "manga",
												});
											}}
										/>
										<label
											className="btn-manga-outline w-full text-center cursor-pointer rounded-lg block py-2 text-sm"
											htmlFor={mangaRadioId}
										>
											{t("japaneseManga")}
										</label>
									</div>

									{/* American Comic */}
									<div>
										<input
											type="radio"
											className="sr-only"
											name="style"
											id={comicRadioId}
											checked={style === "comic"}
											onChange={() => {
												setStyle("comic");
												trackEvent({
													action: "change_style",
													category: "user_interaction",
													label: "comic",
												});
											}}
										/>
										<label
											className="btn-manga-outline w-full text-center cursor-pointer rounded-lg block py-2 text-sm"
											htmlFor={comicRadioId}
										>
											{t("americanComic")}
										</label>
									</div>

									{/* Wuxia Cultivation */}
									<div>
										<input
											type="radio"
											className="sr-only"
											name="style"
											id="wuxia-radio"
											checked={style === "wuxia"}
											onChange={() => {
												setStyle("wuxia");
												trackEvent({
													action: "change_style",
													category: "user_interaction",
													label: "wuxia",
												});
											}}
										/>
										<label
											className="btn-manga-outline w-full text-center cursor-pointer rounded-lg block py-2 text-sm"
											htmlFor="wuxia-radio"
										>
											{t("wuxiaCultivation")}
										</label>
									</div>

									{/* Healing Anime */}
									<div>
										<input
											type="radio"
											className="sr-only"
											name="style"
											id="healing-radio"
											checked={style === "healing"}
											onChange={() => {
												setStyle("healing");
												trackEvent({
													action: "change_style",
													category: "user_interaction",
													label: "healing",
												});
											}}
										/>
										<label
											className="btn-manga-outline w-full text-center cursor-pointer rounded-lg block py-2 text-sm"
											htmlFor="healing-radio"
										>
											{t("healingAnime")}
										</label>
									</div>

									{/* Korean Manhwa */}
									<div>
										<input
											type="radio"
											className="sr-only"
											name="style"
											id="manhwa-radio"
											checked={style === "manhwa"}
											onChange={() => {
												setStyle("manhwa");
												trackEvent({
													action: "change_style",
													category: "user_interaction",
													label: "manhwa",
												});
											}}
										/>
										<label
											className="btn-manga-outline w-full text-center cursor-pointer rounded-lg block py-2 text-sm"
											htmlFor="manhwa-radio"
										>
											{t("koreanManhwa")}
										</label>
									</div>

									{/* Cinematic Style */}
									<div>
										<input
											type="radio"
											className="sr-only"
											name="style"
											id="cinematic-radio"
											checked={style === "cinematic"}
											onChange={() => {
												setStyle("cinematic");
												trackEvent({
													action: "change_style",
													category: "user_interaction",
													label: "cinematic",
												});
											}}
										/>
										<label
											className="btn-manga-outline w-full text-center cursor-pointer rounded-lg block py-2 text-sm"
											htmlFor="cinematic-radio"
										>
											{t("cinematicStyle")}
										</label>
									</div>

									{/* Shojo Manga */}
									<div>
										<input
											type="radio"
											className="sr-only"
											name="style"
											id="shojo-radio"
											checked={style === "shojo"}
											onChange={() => {
												setStyle("shojo");
												trackEvent({
													action: "change_style",
													category: "user_interaction",
													label: "shojo",
												});
											}}
										/>
										<label
											className="btn-manga-outline w-full text-center cursor-pointer rounded-lg block py-2 text-sm"
											htmlFor="shojo-radio"
										>
											{t("shojoManga")}
										</label>
									</div>

									{/* Seinen Manga */}
									<div>
										<input
											type="radio"
											className="sr-only"
											name="style"
											id="seinen-radio"
											checked={style === "seinen"}
											onChange={() => {
												setStyle("seinen");
												trackEvent({
													action: "change_style",
													category: "user_interaction",
													label: "seinen",
												});
											}}
										/>
										<label
											className="btn-manga-outline w-full text-center cursor-pointer rounded-lg block py-2 text-sm"
											htmlFor="seinen-radio"
										>
											{t("seinenManga")}
										</label>
									</div>

									{/* Chibi Comic */}
									<div>
										<input
											type="radio"
											className="sr-only"
											name="style"
											id="chibi-radio"
											checked={style === "chibi"}
											onChange={() => {
												setStyle("chibi");
												trackEvent({
													action: "change_style",
													category: "user_interaction",
													label: "chibi",
												});
											}}
										/>
										<label
											className="btn-manga-outline w-full text-center cursor-pointer rounded-lg block py-2 text-sm"
											htmlFor="chibi-radio"
										>
											{t("chibiComic")}
										</label>
									</div>

									{/* Fantasy Epic */}
									<div>
										<input
											type="radio"
											className="sr-only"
											name="style"
											id="fantasy-radio"
											checked={style === "fantasy"}
											onChange={() => {
												setStyle("fantasy");
												trackEvent({
													action: "change_style",
													category: "user_interaction",
													label: "fantasy",
												});
											}}
										/>
										<label
											className="btn-manga-outline w-full text-center cursor-pointer rounded-lg block py-2 text-sm"
											htmlFor="fantasy-radio"
										>
											{t("fantasyEpic")}
										</label>
									</div>
								</div>
							)}
						</div>

						{/* AI Model Selection */}
						<div className="mb-4">
							<div className="text-manga-black font-medium mb-2">
								{t("settings.aiModel")}
							</div>
							<select
								className="form-control-manga w-full"
								value={aiModel}
								onChange={(e) => {
									setAiModel(e.target.value);
									trackEvent({
										action: "change_ai_model",
										category: "user_interaction",
										label: e.target.value,
									});
								}}
							>
								<option value="auto">{t("aiModels.auto")}</option>
								<option value="nanobanana">{t("aiModels.nanobanana")}</option>
								<option value="volcengine">{t("aiModels.volcengine")}</option>
							</select>
							<p className="text-xs text-manga-medium-gray mt-1">
								{aiModel === "auto" && t("aiModels.description.auto")}
								{aiModel === "nanobanana" && t("aiModels.description.nanobanana")}
								{aiModel === "volcengine" && t("aiModels.description.volcengine")}
							</p>
						</div>

						{/* Story Input */}
						<div className="mb-4">
							<label
								className="block text-manga-black font-medium mb-2"
								htmlFor={storyTextareaId}
							>
								{t("yourStory")}{" "}
								<span className="inline-block bg-manga-medium-gray text-white px-2 py-1 rounded text-xs ml-2">
									{wordCount}/500 {t("words")}
								</span>
							</label>
							<textarea
								id={storyTextareaId}
								className="form-control-manga"
								rows={8}
								value={story}
								onChange={(e) => {
									setStory(e.target.value);
									// Track when user starts typing (once per session)
									if (e.target.value.length === 1 && story.length === 0) {
										trackEvent({
											action: "start_typing_story",
											category: "user_interaction",
										});
									}
								}}
								placeholder={t("storyPlaceholder")}
								disabled={isGenerating}
							/>
							{/* Try Sample Button - only show when story is empty or has very few words */}
							{wordCount < 10 && (
								<div className="mt-2">
									<button
										type="button"
										className="btn-manga-secondary text-sm"
										onClick={loadSampleText}
										disabled={isGenerating}
									>
										📖 {t("trySampleStory")}
									</button>
								</div>
							)}
							{wordCount > 500 && (
								<div className="text-manga-danger text-sm mt-1">
									{t("storyTooLong")}
								</div>
							)}
						</div>

						{/* Reference Images Upload - Optional */}
						<div className="mb-4 space-y-4">
							{/* Character Reference Images */}
							<CollapsibleSection
								title={`📸 ${t("characterReferenceImages")}`}
								isExpanded={isCharacterRefsExpanded}
								onToggle={() =>
									setIsCharacterRefsExpanded(!isCharacterRefsExpanded)
								}
								badge={
									uploadedCharacterReferences.length > 0
										? `${uploadedCharacterReferences.length} ${t("image")}${
												uploadedCharacterReferences.length !== 1 ? "s" : ""
											}`
										: undefined
								}
							>
								<ImageUpload
									title="Character Reference Images"
									description="Upload reference images of characters to guide their visual design. These will be used when generating character designs."
									images={uploadedCharacterReferences}
									onImageAdd={handleCharacterReferenceAdd}
									onImageRemove={handleCharacterReferenceRemove}
									onImageNameChange={handleCharacterReferenceNameChange}
									maxImages={5}
									maxSizeMB={10}
								/>
							</CollapsibleSection>

							{/* Setting Reference Images */}
							<CollapsibleSection
								title={`🏞️ ${t("settingReferenceImages")}`}
								isExpanded={isSettingRefsExpanded}
								onToggle={() =>
									setIsSettingRefsExpanded(!isSettingRefsExpanded)
								}
								badge={
									uploadedSettingReferences.length > 0
										? `${uploadedSettingReferences.length} ${t("image")}${
												uploadedSettingReferences.length !== 1 ? "s" : ""
											}`
										: undefined
								}
							>
								<ImageUpload
									title="Setting Reference Images"
									description="Upload reference images of locations, environments, or scenes to guide the visual style of your comic panels."
									images={uploadedSettingReferences}
									onImageAdd={handleSettingReferenceAdd}
									onImageRemove={handleSettingReferenceRemove}
									onImageNameChange={handleSettingReferenceNameChange}
									maxImages={5}
									maxSizeMB={10}
								/>
							</CollapsibleSection>
						</div>

						{/* Error Display */}
						{error && (
							<div
								className="bg-manga-danger/10 border border-manga-danger text-manga-danger p-3 rounded mb-4"
								role="alert"
							>
								<strong>Error:</strong> {error}
								{(failedStep || failedPanel) && (
									<div className="mt-2">
										{failedPanel ? (
											<button
												type="button"
												className="px-3 py-1 text-sm border border-manga-danger text-manga-danger rounded hover:bg-manga-danger hover:text-white transition-colors"
												onClick={() =>
													retryFailedPanel(failedPanel.panelNumber)
												}
												disabled={isGenerating}
											>
												{t("retryPanel", { number: failedPanel.panelNumber })}
											</button>
										) : failedStep ? (
											<button
												type="button"
												className="px-3 py-1 text-sm border border-manga-danger text-manga-danger rounded hover:bg-manga-danger hover:text-white transition-colors"
												onClick={() => retryFromStep(failedStep)}
												disabled={isGenerating}
											>
												{t("retryFromStep", {
													step:
														failedStep.charAt(0).toUpperCase() +
														failedStep.slice(1),
												})}
											</button>
										) : null}
									</div>
								)}
							</div>
						)}

						{/* Generate Button */}
						<button
							type="button"
							className="btn-manga-primary w-full mb-2"
							onClick={generateComic}
							disabled={isGenerating || !story.trim() || wordCount > 500}
						>
							{isGenerating ? (
								<>
									<span
										className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
										aria-hidden="true"
									></span>
									{currentStepText}
								</>
							) : (
								t("generate")
							)}
						</button>

						{/* Clear Results Button */}
						{(storyAnalysis ||
							characterReferences.length > 0 ||
							storyBreakdown ||
							generatedPanels.length > 0) && (
							<button
								type="button"
								className="btn-manga-outline w-full mb-2"
								onClick={clearResults}
								disabled={isGenerating}
							>
								{t("clearPreviousResults")}
							</button>
						)}

						{/* Clear All Data Button */}
						{hasAnyContent && (
							<button
								type="button"
								className="btn-manga-outline w-full text-xs"
								onClick={handleClearAllData}
								disabled={isGenerating}
								style={{ fontSize: "12px", padding: "8px 12px" }}
							>
								🗑️ {t("clearAllSavedData")}
							</button>
						)}

						{/* Storage Info */}
						{storageInfo.hasData && (
							<div className="text-xs text-manga-medium-gray mt-2 text-center">
								💾 Data saved
								{storageInfo.timestamp
									? ` ${new Date(storageInfo.timestamp).toLocaleTimeString()}`
									: ""}
								{isSavingState && <span className="ml-1">💾 Saving...</span>}
							</div>
						)}
					</div>
				</div>

				{/* Right Panel - Generation Results */}
				<div className="w-full lg:w-2/3">
					<div className="comic-panel h-full">
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl">{t("behindTheScenes")}</h2>
							<button
								type="button"
								className="btn-manga-outline text-sm"
								onClick={() => {
									const hasAnyOpen = openAccordions.size > 0;
									if (hasAnyOpen) {
										collapseAllAccordions();
									} else {
										expandAllAccordions();
									}
								}}
								title={
									openAccordions.size > 0
										? t("collapseAllSections")
										: t("expandAllSections")
								}
							>
								{openAccordions.size > 0 ? t("collapseAll") : t("expandAll")}
							</button>
						</div>

						<div className="accordion-manga space-y-4">
							{/* Step 1: Story Analysis */}
							<AccordionSection
								id={analysisHeadingId}
								title={t("storyAnalysis")}
								stepNumber={1}
								isCompleted={!!storyAnalysis}
								isInProgress={
									isGenerating &&
									!storyAnalysis &&
									currentStepText.includes("Analyzing")
								}
								isOpen={openAccordions.has("analysis")}
								onToggle={() => toggleAccordionSection("analysis")}
								showStatus={isGenerating || !!storyAnalysis}
							>
								{storyAnalysis ? (
									<div>
										<div className="flex justify-between items-center mb-3">
											<h5 className="font-semibold">{t("storyAnalysis")}</h5>
											<div className="flex gap-2">
												{!editingStoryAnalysis && (
													<button
														onClick={startEditingStoryAnalysis}
														className="btn-manga-outline btn-sm"
														disabled={isGenerating}
													>
														{t("edit")}
													</button>
												)}
												<DownloadButton
													onClick={downloadStoryAnalysis}
													isLoading={false}
													label={t("download")}
													loadingText=""
													variant="outline"
												/>
											</div>
										</div>

										{editingStoryAnalysis ? (
											<div className="space-y-4">
												<div>
													<label className="form-label-enhanced">{t("title")}:</label>
													<input
														type="text"
														value={tempStoryAnalysis?.title || ''}
														onChange={(e) => setTempStoryAnalysis(prev => prev ? {...prev, title: e.target.value} : null)}
														className="form-control-manga w-full"
													/>
												</div>

												<div>
													<label className="form-label-enhanced">{t("setting")}:</label>
													<div className="space-y-2">
														<input
															type="text"
															placeholder={t("location")}
															value={tempStoryAnalysis?.setting.location || ''}
															onChange={(e) => setTempStoryAnalysis(prev => prev ? {
																...prev,
																setting: {...prev.setting, location: e.target.value}
															} : null)}
															className="form-control-manga w-full"
														/>
														<input
															type="text"
															placeholder={t("timePeriod")}
															value={tempStoryAnalysis?.setting.timePeriod || ''}
															onChange={(e) => setTempStoryAnalysis(prev => prev ? {
																...prev,
																setting: {...prev.setting, timePeriod: e.target.value}
															} : null)}
															className="form-control-manga w-full"
														/>
														<input
															type="text"
															placeholder={t("mood")}
															value={tempStoryAnalysis?.setting.mood || ''}
															onChange={(e) => setTempStoryAnalysis(prev => prev ? {
																...prev,
																setting: {...prev.setting, mood: e.target.value}
															} : null)}
															className="form-control-manga w-full"
														/>
													</div>
												</div>

												<div className="flex gap-2">
													<button
														onClick={saveStoryAnalysisEdit}
														className="btn-manga-primary"
														disabled={isGenerating}
													>
														{t("save")}
													</button>
													<button
														onClick={cancelStoryAnalysisEdit}
														className="btn-manga-outline"
														disabled={isGenerating}
													>
														{t("cancel")}
													</button>
													<button
														onClick={regenerateFromStoryAnalysis}
														className="btn-manga-primary"
														disabled={isGenerating}
													>
														{t("regenerateFromHere")}
													</button>
												</div>
											</div>
										) : (
											<div>
												<h5 className="font-semibold mb-2">{t("title")}:</h5>
												<p className="mb-3">{storyAnalysis.title}</p>
												<h5 className="font-semibold mb-2">{t("characters")}:</h5>
												<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
													{storyAnalysis.characters.map((char) => (
														<CharacterCard
															key={char.name}
															character={char}
															showImage={false}
														/>
													))}
												</div>
												<h5 className="font-semibold mt-3 mb-2">{t("setting")}:</h5>
												<p>
													<strong>{t("location")}:</strong>{" "}
													{storyAnalysis.setting.location}
												</p>
												<p>
													<strong>{t("timePeriod")}:</strong>{" "}
													{storyAnalysis.setting.timePeriod}
												</p>
												<p>
													<strong>{t("mood")}:</strong> {storyAnalysis.setting.mood}
												</p>

												{/* 场景信息显示 */}
												{storyAnalysis.scenes && storyAnalysis.scenes.length > 0 && (
													<>
														<h5 className="font-semibold mt-4 mb-2">场景设定:</h5>
														<div className="space-y-3">
															{storyAnalysis.scenes.map((scene, index) => (
																<div key={scene.id} className="bg-manga-light-gray/30 p-3 rounded-lg">
																	<p><strong>场景 {index + 1}:</strong> {scene.name}</p>
																	<p><strong>位置:</strong> {scene.location}</p>
																	<p><strong>描述:</strong> {scene.description}</p>
																	{scene.timeOfDay && <p><strong>时间:</strong> {scene.timeOfDay}</p>}
																	<p><strong>氛围:</strong> {scene.mood}</p>
																	{scene.visualElements && scene.visualElements.length > 0 && (
																		<p><strong>视觉元素:</strong> {scene.visualElements.join('，')}</p>
																	)}
																</div>
															))}
														</div>
													</>
												)}

												<div className="mt-3">
													<RerunButton
														onClick={rerunAnalysis}
														isLoading={isRerunningAnalysis}
														disabled={isGenerating}
													/>
												</div>
											</div>
										)}
									</div>
								) : (
									<div>
										<p className="text-manga-medium-gray">
											{t("storyAnalysisPlaceholder")}
										</p>
										{failedStep === "analysis" && (
											<button
												type="button"
												className="px-3 py-1 text-sm border border-manga-info text-manga-info rounded hover:bg-manga-info hover:text-white transition-colors mt-2"
												onClick={() => retryFromStep("analysis")}
												disabled={isGenerating}
											>
												{t("retryStoryAnalysis")}
											</button>
										)}
									</div>
								)}
							</AccordionSection>

							{/* Step 2: Character Designs */}
							<AccordionSection
								id={charactersHeadingId}
								title={t("characterDesigns")}
								stepNumber={2}
								isCompleted={characterReferences.length > 0}
								isInProgress={
									isGenerating &&
									!!storyAnalysis &&
									characterReferences.length === 0 &&
									currentStepText.includes("character")
								}
								isOpen={openAccordions.has("characters")}
								onToggle={() => toggleAccordionSection("characters")}
								showStatus={isGenerating || characterReferences.length > 0}
							>
								{characterReferences.length > 0 ? (
									<div className="character-grid">
										<div className="flex justify-between items-center mb-3">
											<h5 className="font-semibold">{t("characterDesigns")}</h5>
											<DownloadButton
												onClick={downloadAllCharacters}
												isLoading={isDownloadingCharacters}
												label={t("downloadAllCharacters")}
												loadingText="Creating zip..."
												variant="outline"
											/>
										</div>
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
											{characterReferences.map((char) => (
												<CharacterCard
													key={char.name}
													character={char}
													showImage={true}
													onImageClick={openImageModal}
													onDownload={() => downloadCharacter(char)}
													onEdit={() => {
														// Create a prompt for the character
														const characterPrompt = `Character: ${char.name}\nDescription: ${char.description || 'No description'}`;

														openImageEditModal(
															'character',
															char.name,
															char.image || '',
															characterPrompt
														);
													}}
												/>
											))}
										</div>
										<div className="mt-3">
											<RerunButton
												onClick={rerunCharacterDesigns}
												isLoading={isRerunningCharacters}
												disabled={isGenerating || !storyAnalysis}
											/>
										</div>
									</div>
								) : (
									<div>
										<p className="text-manga-medium-gray">
											{t("characterDesignPlaceholder")}
										</p>
										{failedStep === "characters" && storyAnalysis && (
											<button
												type="button"
												className="px-3 py-1 text-sm border border-manga-info text-manga-info rounded hover:bg-manga-info hover:text-white transition-colors mt-2"
												onClick={() => retryFromStep("characters")}
												disabled={isGenerating}
											>
												{t("retryCharacterGeneration")}
											</button>
										)}
									</div>
								)}
							</AccordionSection>

							{/* Step 3: Comic Layout Plan */}
							<AccordionSection
								id={layoutHeadingId}
								title={t("comicLayoutPlan")}
								stepNumber={3}
								isCompleted={!!storyBreakdown}
								isInProgress={
									isGenerating &&
									characterReferences.length > 0 &&
									!storyBreakdown &&
									currentStepText.includes("layout")
								}
								isOpen={openAccordions.has("layout")}
								onToggle={() => toggleAccordionSection("layout")}
								showStatus={isGenerating || !!storyBreakdown}
							>
								{storyBreakdown ? (
									<div>
										<div className="flex justify-between items-center mb-3">
											<h5 className="font-semibold">
												{t("panelSequence", {
													count: storyBreakdown.panels.length,
												})}
											</h5>
											<div className="flex gap-2">
												{!editingStoryBreakdown && (
													<button
														onClick={startEditingStoryBreakdown}
														className="btn-manga-outline btn-sm"
														disabled={isGenerating}
													>
														{t("edit")}
													</button>
												)}
												<DownloadButton
													onClick={downloadComicLayout}
													isLoading={false}
													label="Download"
													loadingText=""
													variant="outline"
												/>
											</div>
										</div>

										{editingStoryBreakdown ? (
											<div className="space-y-4">
												{tempStoryBreakdown?.panels.map((panel, index) => (
													<div key={panel.panelNumber} className="border border-gray-200 rounded-lg p-4">
														<h6 className="font-semibold mb-3">Panel {panel.panelNumber}</h6>
														<div className="space-y-3">
															<div>
																<label className="form-label-enhanced">Scene Description:</label>
																<textarea
																	value={panel.sceneDescription}
																	onChange={(e) => setTempStoryBreakdown(prev => prev ? {
																		...prev,
																		panels: prev.panels.map((p, i) =>
																			i === index ? {...p, sceneDescription: e.target.value} : p
																		)
																	} : null)}
																	className="form-control-manga w-full"
																	rows={3}
																/>
															</div>
															<div>
																<label className="form-label-enhanced">Dialogue (optional):</label>
																<textarea
																	value={panel.dialogue || ''}
																	onChange={(e) => setTempStoryBreakdown(prev => prev ? {
																		...prev,
																		panels: prev.panels.map((p, i) =>
																			i === index ? {...p, dialogue: e.target.value} : p
																		)
																	} : null)}
																	className="form-control-manga w-full"
																	rows={2}
																/>
															</div>
															<div className="grid grid-cols-2 gap-3">
																<div>
																	<label className="form-label-enhanced">Camera Angle:</label>
																	<input
																		type="text"
																		value={panel.cameraAngle}
																		onChange={(e) => setTempStoryBreakdown(prev => prev ? {
																			...prev,
																			panels: prev.panels.map((p, i) =>
																				i === index ? {...p, cameraAngle: e.target.value} : p
																			)
																		} : null)}
																		className="form-control-manga w-full"
																	/>
																</div>
																<div>
																	<label className="form-label-enhanced">Visual Mood:</label>
																	<input
																		type="text"
																		value={panel.visualMood}
																		onChange={(e) => setTempStoryBreakdown(prev => prev ? {
																			...prev,
																			panels: prev.panels.map((p, i) =>
																				i === index ? {...p, visualMood: e.target.value} : p
																			)
																		} : null)}
																		className="form-control-manga w-full"
																	/>
																</div>
															</div>
														</div>
													</div>
												))}

												<div className="flex gap-2">
													<button
														onClick={saveStoryBreakdownEdit}
														className="btn-manga-primary"
														disabled={isGenerating}
													>
														{t("save")}
													</button>
													<button
														onClick={cancelStoryBreakdownEdit}
														className="btn-manga-outline"
														disabled={isGenerating}
													>
														{t("cancel")}
													</button>
													<button
														onClick={regenerateFromStoryBreakdown}
														className="btn-manga-primary"
														disabled={isGenerating}
													>
														{t("regenerateFromHere")}
													</button>
												</div>
											</div>
										) : (
											<div>
												<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
													{storyBreakdown.panels.map((panel) => (
														<PanelCard
															key={`panel-${panel.panelNumber}`}
															panel={panel}
															showImage={false}
															scenes={storyAnalysis?.scenes || []}
														/>
													))}
												</div>
												<div className="mt-3">
													<RerunButton
														onClick={rerunLayoutPlan}
														isLoading={isRerunningLayout}
														disabled={isGenerating || !storyAnalysis}
													/>
												</div>
											</div>
										)}
									</div>
								) : (
									<div>
										<p className="text-manga-medium-gray">
											{t("comicLayoutPlaceholder")}
										</p>
										{failedStep === "layout" &&
											storyAnalysis &&
											characterReferences.length > 0 && (
												<button
													type="button"
													className="px-3 py-1 text-sm border border-manga-info text-manga-info rounded hover:bg-manga-info hover:text-white transition-colors mt-2"
													onClick={() => retryFromStep("layout")}
													disabled={isGenerating}
												>
													{t("retryComicLayout")}
												</button>
											)}
									</div>
								)}
							</AccordionSection>

							{/* Step 4: Generated Panels */}
							<AccordionSection
								id={panelsHeadingId}
								title={t("generatedPanels")}
								stepNumber={4}
								isCompleted={getPanelStatus().isCompleted}
								isInProgress={
									getPanelStatus().isInProgress ||
									(isGenerating &&
										!!storyBreakdown &&
										currentStepText.includes("panel"))
								}
								isOpen={openAccordions.has("panels")}
								onToggle={() => toggleAccordionSection("panels")}
								showStatus={isGenerating || generatedPanels.length > 0}
							>
								{storyBreakdown ? (
									<div data-section="panels">
										<div className="flex justify-between items-center mb-3">
											<h5 className="font-semibold">{t("yourComicPanels")}</h5>
											<div className="flex gap-2">
												{/* 继续生成按钮 */}
												{storyBreakdown && generatedPanels.length < storyBreakdown.panels.length && (
													<button
														onClick={continueGeneration}
														disabled={generationState.isGenerating || isGenerating}
														className="btn-primary-manga text-sm px-3 py-1"
													>
														{generationState.isGenerating ? t("generating") : t("continueGeneration")}
													</button>
												)}
												{/* 暂停/恢复按钮 */}
												{generationState.isGenerating && (
													<button
														onClick={generationState.isPaused ? resumeGeneration : pauseGeneration}
														className="btn-secondary-manga text-sm px-3 py-1"
													>
														{generationState.isPaused ? t("resume") : t("pause")}
													</button>
												)}
												{generatedPanels.length > 0 && (
													<DownloadButton
														onClick={downloadAllPanels}
														isLoading={isDownloadingPanels}
														label={t("downloadAllPanels")}
														loadingText={t("creatingZip")}
														variant="outline"
													/>
												)}
											</div>
										</div>

										{/* 生成进度显示 */}
										{generationState.isGenerating && (
											<div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
												<div className="flex justify-between items-center mb-2">
													<span className="text-sm font-medium text-blue-800">
														{t("generationProgress")}
													</span>
													<span className="text-sm text-blue-600">
														{generationState.completedPanels}/{generationState.totalPanels}
													</span>
												</div>
												<div className="w-full bg-blue-200 rounded-full h-2 mb-2">
													<div
														className="bg-blue-600 h-2 rounded-full transition-all duration-300"
														style={{
															width: `${(generationState.completedPanels / generationState.totalPanels) * 100}%`
														}}
													></div>
												</div>
												{generationState.batchInfo && (
													<div className="text-xs text-blue-600">
														{t("batch")} {generationState.batchInfo.currentBatch}/{generationState.batchInfo.totalBatches}
														{generationState.currentPanel > 0 && (
															<span className="ml-2">
																{t("currentPanel")}: {generationState.currentPanel}
															</span>
														)}
													</div>
												)}
												{generationState.failedPanels.length > 0 && (
													<div className="text-xs text-red-600 mt-1">
														{t("failedPanels")}: {generationState.failedPanels.join(", ")}
													</div>
												)}
											</div>
										)}
										{/* 分页控制 */}
										{isLazyLoadingEnabled && totalPages > 1 && (
											<div className="mb-4 flex justify-center items-center gap-4">
												<button
													onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
													disabled={currentPage === 1}
													className="btn-manga-outline text-sm px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													上一页
												</button>
												<span className="text-sm text-gray-600">
													第 {currentPage} 页 / 共 {totalPages} 页
												</span>
												<button
													onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
													disabled={currentPage === totalPages}
													className="btn-manga-outline text-sm px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													下一页
												</button>
											</div>
										)}

										<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
											{(isLazyLoadingEnabled
												? storyBreakdown.panels.slice(startIndex, endIndex)
												: storyBreakdown.panels
											).map((panel, index) => {
												// 调整索引以匹配实际的面板位置
												const actualIndex = isLazyLoadingEnabled ? startIndex + index : index;
												const generatedPanel = generatedPanels.find(
													(p) => p.panelNumber === panel.panelNumber,
												);
												const isCurrentlyGenerating =
													isGenerating &&
													currentStepText.includes("panel") &&
													generatedPanels.length === actualIndex;
												const hasFailed = failedPanels.has(panel.panelNumber);

												if (generatedPanel) {
													// Show completed panel
													return (
														<PanelCard
															key={`generated-panel-${panel.panelNumber}`}
															panel={generatedPanel}
															showImage={true}
															onImageClick={openImageModal}
															onDownload={() => downloadPanel(generatedPanel)}
															onEdit={() => {
																// Create a prompt for the panel based on its properties
																// Clean dialogue to remove character names that might appear in images
																const cleanDialogue = (dialogue: string) => {
																	if (!dialogue) return dialogue;
																	// Remove character names from dialogue format like "Character: 'text'" or "角色：'文本'"
																	return dialogue
																		.replace(/^([^:：]+)[:：]\s*['"]?([^'"]+)['"]?$/, '$2')
																		.replace(/^([^说]+)说[:：]\s*['"]?([^'"]+)['"]?$/, '$2')
																		.replace(/^['"]|['"]$/g, '')
																		.trim();
																};

																const panelPrompt = `Scene: ${panel.sceneDescription || 'No description'}${
																	panel.dialogue ? `\nDialogue: "${cleanDialogue(panel.dialogue)}"` : ''
																}${
																	panel.cameraAngle ? `\nCamera: ${panel.cameraAngle}` : ''
																}${
																	panel.visualMood ? `\nMood: ${panel.visualMood}` : ''
																}`;

																openImageEditModal(
																	'panel',
																	panel.panelNumber,
																	generatedPanel.image || '',
																	panelPrompt
																);
															}}
														/>
													);
												} else if (hasFailed) {
													// Show failed panel with retry button
													return (
														<div
															key={`failed-panel-${panel.panelNumber}`}
															className="card-manga border-dashed border-2 border-red-300 bg-red-50"
														>
															<div className="card-body text-center py-8">
																<div className="text-red-500 mb-3">
																	<svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
																	</svg>
																</div>
																<h6 className="card-title text-red-700 font-semibold mb-2">
																	{t("panel")} {panel.panelNumber} {t("generationFailed")}
																</h6>
																<p className="card-text text-sm text-red-600/80 mb-4">
																	{panel.sceneDescription}
																</p>
																<button
																	type="button"
																	className="btn-manga-outline text-sm px-4 py-2 text-red-600 border-red-300 hover:bg-red-100"
																	onClick={() => retryFailedPanel(panel.panelNumber)}
																	disabled={isGenerating}
																>
																	<svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
																	</svg>
																	{t("retryGeneration")}
																</button>
															</div>
														</div>
													);
												} else {
													// Show placeholder for pending/generating panel
													return (
														<div
															key={`placeholder-panel-${panel.panelNumber}`}
															className={`card-manga ${isCurrentlyGenerating ? "animate-pulse" : ""} border-dashed border-2 border-manga-medium-gray/50 bg-manga-medium-gray/10`}
														>
															<div className="card-body text-center py-8">
																{isCurrentlyGenerating ? (
																	<>
																		<div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-manga-black mb-2"></div>
																		<h6 className="card-title text-manga-medium-gray">
																			{t("generatingPanel", {
																				number: panel.panelNumber,
																			})}
																		</h6>
																		<p className="card-text text-sm text-manga-medium-gray/80">
																			{panel.sceneDescription}
																		</p>
																	</>
																) : (
																	<>
																		<h6 className="card-title text-manga-medium-gray">
																			{t("panel")} {panel.panelNumber}
																		</h6>
																		<p className="card-text text-sm text-manga-medium-gray/80">
																			{t("waitingToGenerate")}
																		</p>
																		<p className="card-text text-xs text-manga-medium-gray/60 mt-2">
																			{panel.sceneDescription}
																		</p>
																	</>
																)}
															</div>
														</div>
													);
												}
											})}
										</div>

										{/* 底部分页控制 */}
										{isLazyLoadingEnabled && totalPages > 1 && (
											<div className="mt-4 mb-4 flex justify-center items-center gap-4">
												<button
													onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
													disabled={currentPage === 1}
													className="btn-manga-outline text-sm px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													上一页
												</button>
												<div className="flex items-center gap-2">
													<span className="text-sm text-gray-600">
														第 {currentPage} 页 / 共 {totalPages} 页
													</span>
													<span className="text-xs text-gray-500">
														(显示 {startIndex + 1}-{Math.min(endIndex, generatedPanels.length)} / {generatedPanels.length} 个面板)
													</span>
												</div>
												<button
													onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
													disabled={currentPage === totalPages}
													className="btn-manga-outline text-sm px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													下一页
												</button>
											</div>
										)}

										<div className="mt-3">
											<RerunButton
												onClick={rerunPanels}
												isLoading={isRerunningPanels}
												disabled={
													isGenerating ||
													!storyAnalysis ||
													!storyBreakdown ||
													characterReferences.length === 0
												}
											/>
										</div>
									</div>
								) : (
									<div>
										<p className="text-manga-medium-gray">
											{t("comicPanelsPlaceholder")}
										</p>
										{failedStep === "panels" &&
											storyAnalysis &&
											characterReferences.length > 0 &&
											storyBreakdown && (
												<button
													type="button"
													className="px-3 py-1 text-sm border border-manga-info text-manga-info rounded hover:bg-manga-info hover:text-white transition-colors mt-2"
													onClick={() => retryFromStep("panels")}
													disabled={isGenerating}
												>
													{t("retryPanelGeneration")}
												</button>
											)}
									</div>
								)}
							</AccordionSection>

							{/* Step 5: Create Shareable Image */}
							<AccordionSection
								id={compositorHeadingId}
								title={t("createShareableImage")}
								stepNumber={5}
								isCompleted={false}
								isOpen={openAccordions.has("compositor")}
								onToggle={() => toggleAccordionSection("compositor")}
								showStatus={false}
							>
								{hasCompositeContent ? (
									<div>
										<div className="flex justify-between items-center mb-3">
											<h5 className="font-semibold">
												{t("createShareableComicPage")}
											</h5>
											<div className="flex gap-2">
												{/* 下载当前页面 */}
												<DownloadButton
													onClick={generateComposite}
													isLoading={isGeneratingComposite}
													label={isLazyLoadingEnabled ? `下载第${currentPage}页` : t("generateAndDownload")}
													loadingText={t("creatingComposite")}
													variant="outline"
												/>
												{/* 下载所有页面 */}
												{isLazyLoadingEnabled && totalPages > 1 && (
													<DownloadButton
														onClick={generateAllPagesComposite}
														isLoading={isGeneratingComposite}
														label={`下载全部${totalPages}页`}
														loadingText={`正在生成第${currentPage}页...`}
														variant="primary"
													/>
												)}
											</div>
										</div>

										{/* Hidden compositor layout for html2canvas */}
										<ShareableComicLayout
											storyAnalysis={storyAnalysis}
											generatedPanels={currentPagePanels}
											characterReferences={characterReferences}
											style={style}
											isPreview={false}
											compositorRef={compositorRef}
											getProxyImageUrl={getProxyImageUrl}
											isLazyLoadingEnabled={false}
											visiblePanelRange={{ start: 0, end: currentPagePanels.length }}
										/>

										{/* Preview (visible version) */}
										<div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
											<div className="text-center text-gray-600 mb-4">
												<p className="text-xs text-gray-500">
													{t("generateDownloadHint")}
												</p>
											</div>

											{/* Mini preview using the same component */}
											<ShareableComicLayout
												storyAnalysis={storyAnalysis}
												generatedPanels={currentPagePanels}
												characterReferences={characterReferences}
												style={style}
												isPreview={true}
												getProxyImageUrl={getProxyImageUrl}
												isLazyLoadingEnabled={false}
												visiblePanelRange={{ start: 0, end: currentPagePanels.length }}
											/>
										</div>
									</div>
								) : (
									<div>
										<p className="text-manga-medium-gray">
											{t("shareableImagePlaceholder")}
										</p>
									</div>
								)}
							</AccordionSection>
						</div>
					</div>
				</div>
			</div>

			{/* Floating Report Issue Button */}
			<a
				href="https://github.com/victorhuangwq/story-to-manga/issues/new"
				target="_blank"
				rel="noopener noreferrer"
				className="floating-report-btn"
				title={t("reportAnIssue")}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<title>Report Issue Icon</title>
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-6h-2v6zm0-8h2V7h-2v2z" />
				</svg>
				{t("reportIssue")}
			</a>

			{/* Image Modal */}
			{modalImage && (
				<div
					className="image-modal-overlay"
					onClick={closeImageModal}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							closeImageModal();
						}
					}}
					role="dialog"
					aria-modal="true"
					aria-label={t("imageViewer")}
					tabIndex={-1}
				>
					<div
						className="image-modal-content"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						role="document"
					>
						<button
							type="button"
							className="image-modal-close"
							onClick={closeImageModal}
							aria-label={t("closeModal")}
						>
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								aria-hidden="true"
							>
								<title>Close</title>
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
						<img src={modalImage} alt={modalAlt} className="image-modal-img" />
					</div>
				</div>
			)}

			{/* Error Modal */}
			{showErrorModal && (
				<div
					className="confirmation-modal-overlay"
					onClick={closeErrorModal}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							closeErrorModal();
						}
					}}
					role="dialog"
					aria-modal="true"
					aria-label={t("errorMessage")}
					tabIndex={-1}
				>
					<div
						className="confirmation-modal-content"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						role="document"
					>
						<div className="confirmation-modal-header">
							<div className="confirmation-modal-icon text-manga-danger">
								<svg
									width="48"
									height="48"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									aria-hidden="true"
								>
									<title>Error</title>
									<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
								</svg>
							</div>
							<h3 className="confirmation-modal-title text-manga-danger">
								{t("error")}
							</h3>
							<p className="confirmation-modal-message whitespace-pre-line">
								{errorModalMessage}
							</p>
						</div>
						<div className="confirmation-modal-actions">
							<button
								type="button"
								className="btn-manga-primary confirmation-modal-confirm"
								onClick={closeErrorModal}
							>
								{t("ok")}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Confirmation Modal */}
			{showConfirmClearModal && (
				<div
					className="confirmation-modal-overlay"
					onClick={cancelClearData}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							cancelClearData();
						}
					}}
					role="dialog"
					aria-modal="true"
					aria-label={t("confirmClearData")}
					tabIndex={-1}
				>
					<div
						className="confirmation-modal-content"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
						role="document"
					>
						<div className="confirmation-modal-header">
							<div className="confirmation-modal-icon">
								<svg
									width="48"
									height="48"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									aria-hidden="true"
								>
									<title>Warning</title>
									<path d="M12 9v4M12 17h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
								</svg>
							</div>
							<h3 className="confirmation-modal-title">
								{t("clearAllSavedDataConfirm")}
							</h3>
							<p className="confirmation-modal-message">
								{t("clearDataWarning")}
							</p>
						</div>
						<div className="confirmation-modal-actions">
							<button
								type="button"
								className="btn-manga-outline confirmation-modal-cancel"
								onClick={cancelClearData}
							>
								{t("cancel")}
							</button>
							<button
								type="button"
								className="btn-manga-primary confirmation-modal-confirm"
								onClick={confirmClearAllData}
							>
								🗑️ {t("clearAllData")}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Project Manager Modal */}
			<ProjectManager
				isOpen={showProjectManager}
				onClose={() => setShowProjectManager(false)}
				onProjectSelect={handleProjectSelect}
				onNewProject={handleNewProject}
				currentProjectId={currentProjectId}
			/>

			{/* Image Edit Modal */}
			{editingImage && (
				<ImageEditModal
					isOpen={showImageEditModal}
					onClose={closeImageEditModal}
					imageType={editingImage.type}
					imageId={editingImage.id}
					originalImage={editingImage.image}
					originalPrompt={editingImage.originalPrompt}
					onRedraw={handleImageRedraw}
					onModify={handleImageModify}
					isProcessing={isImageProcessing}
					characterReferences={characterReferences}
					autoSelectedReferences={editingImage.autoSelectedReferences || []}
				/>
			)}

			{/* 性能统计显示 */}
			{(optimizationStats.optimizedCount > 0 || cacheManager.getStats().totalItems > 0) && (
				<div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded-lg max-w-xs">
					{optimizationStats.optimizedCount > 0 && (
						<div className="mb-1">
							🗜️ 图像优化: {optimizationStats.optimizedCount}张, 节省 {(optimizationStats.totalSavings / 1024 / 1024).toFixed(1)}MB
						</div>
					)}
					{cacheManager.getStats().totalItems > 0 && (
						<div>
							💾 缓存: {cacheManager.getStats().totalItems}项, 命中率 {(cacheManager.getStats().hitRate * 100).toFixed(1)}%
						</div>
					)}
				</div>
			)}
		</div>
	);
}