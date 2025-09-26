import { useTranslation } from "react-i18next";
import { DownloadButton } from "./DownloadButton";

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
	getProxyImageUrl?: (url: string) => string;
}

export function PanelCard({
	panel,
	showImage = false,
	onImageClick,
	onDownload,
	onEdit,
	scenes = [],
	getProxyImageUrl,
}: PanelCardProps) {
	const { t } = useTranslation();

	// 查找面板对应的场景信息
	const panelScene = panel.sceneId ? scenes.find(scene => scene.id === panel.sceneId) : null;

	return (
		<div className={showImage ? "text-center" : "card-manga"}>
			{showImage && panel.image ? (
				<>
					<img
						src={(() => {
							const imageUrl = panel.image && typeof panel.image === 'string' && panel.image.trim() ? panel.image : '/placeholder-panel.svg';
							// 使用图片代理处理CORS问题
							return getProxyImageUrl ? getProxyImageUrl(imageUrl) : imageUrl;
						})()}
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
