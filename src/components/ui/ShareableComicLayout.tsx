import React from 'react';
import { getProxyImageUrl } from '@/utils/imageUtils';
import type { StoryAnalysis, GeneratedPanel, CharacterReference, ComicStyle } from '@/types';

interface ShareableComicLayoutProps {
  storyAnalysis: StoryAnalysis | null;
  generatedPanels: GeneratedPanel[];
  characterReferences: CharacterReference[];
  style: ComicStyle;
  compositorRef?: React.RefObject<HTMLDivElement | null>;
  isPreview?: boolean;
  isLazyLoadingEnabled?: boolean;
  visiblePanelRange?: { start: number; end: number };
  getProxyImageUrl?: (url: string) => string;
}

export const ShareableComicLayout: React.FC<ShareableComicLayoutProps> = ({
  storyAnalysis,
  generatedPanels,
  characterReferences,
  style,
  compositorRef,
  isPreview = false,
  isLazyLoadingEnabled = false,
  visiblePanelRange = { start: 0, end: generatedPanels.length },
  getProxyImageUrl: getProxyImageUrlProp
}) => {
  // Use the passed getProxyImageUrl function or fallback to the imported one
  const getProxyImageUrlFunc = getProxyImageUrlProp || getProxyImageUrl;
  const title = storyAnalysis?.title || `${style === "manga" ? "Manga" : "Comic"} Story`;

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
                    src={(() => {
                      const imageUrl = panel.image && typeof panel.image === 'string' && panel.image.trim() ? panel.image : '/placeholder-panel.svg';
                      return getProxyImageUrlFunc ? getProxyImageUrlFunc(imageUrl) : imageUrl;
                    })()}
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
                    src={char.image && typeof char.image === 'string' && char.image.trim() ? (getProxyImageUrlFunc ? getProxyImageUrlFunc(char.image) : char.image) : '/placeholder-character.svg'}
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
        minHeight: "1200px",
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
          Generator at manga.neodomain.ai
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
                  src={panel.image && typeof panel.image === 'string' && panel.image.trim() ? (getProxyImageUrlFunc ? getProxyImageUrlFunc(panel.image) : panel.image) : '/placeholder-panel.svg'}
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
};
