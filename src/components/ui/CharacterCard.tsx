import { useTranslation } from "react-i18next";
import { DownloadButton } from "./DownloadButton";

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
	getProxyImageUrl?: (url: string) => string;
}

export function CharacterCard({
	character,
	showImage = false,
	onImageClick,
	onDownload,
	onEdit,
	getProxyImageUrl,
}: CharacterCardProps) {
	const { t } = useTranslation();
	
	return (
		<div className={showImage ? "text-center" : "card-manga"}>
			{showImage && character.image ? (
				<>
					<img
						src={(() => {
							const imageUrl = character.image && typeof character.image === 'string' && character.image.trim() ? character.image : '/placeholder-character.svg';
							// 使用图片代理处理CORS问题
							return getProxyImageUrl ? getProxyImageUrl(imageUrl) : imageUrl;
						})()}
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
