"use client";

import React, { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { useAuth } from '@/components/AuthProvider';
import { useMangaApp } from '@/hooks/useMangaApp';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ProjectManager from '@/components/ProjectManager';
import { ShareComicModal } from '@/components/ShareComicModal';
import { ImageEditModal } from '@/components/ImageEditModal';
import {
  AccordionSection,
  CharacterCard,
  CollapsibleSection,
  DownloadButton,
  LoadingSpinner,
  PanelCard,
  RerunButton,
  StatusBadge,
  ShareableComicLayout
} from '@/components/ui';
import { SAMPLE_STORIES } from '@/constants/sampleStories';
import type { ComicStyle } from '@/types';

export default function Home() {
  // Initialize hooks
  const { t, i18n, language } = useI18n();
  const { user, session, signOut } = useAuth();
  const mangaApp = useMangaApp();

  // Modal states
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showImageEditModal, setShowImageEditModal] = useState(false);
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<{
    url: string;
    panelNumber: number;
    altText: string;
  } | null>(null);

  // Style options
  const styleOptions: { value: ComicStyle; label: string; emoji: string }[] = [
    { value: "manga", label: t("manga", "日式漫画"), emoji: "🎌" },
    { value: "comic", label: t("comic", "美式漫画"), emoji: "🦸" },
    { value: "wuxia", label: t("wuxia", "武侠风格"), emoji: "⚔️" },
  ];

  // Image size options
  const imageSizeOptions = [
    { value: "1K", label: "1K (1024x1024)", width: 1024, height: 1024 },
    { value: "2K", label: "2K (2048x2048)", width: 2048, height: 2048 },
    { value: "4K", label: "4K (4096x4096)", width: 4096, height: 4096 },
  ];

  // AI model options
  const aiModelOptions = [
    { value: "auto", label: t("autoSelect", "自动选择") },
    { value: "gemini", label: "Gemini Pro" },
    { value: "volcengine", label: "VolcEngine" },
  ];



  // Show loading screen while initializing
  if (mangaApp.isLoadingState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-manga-off-white">
        <div className="text-center">
          <LoadingSpinner size="medium" />
          <p className="text-manga-medium-gray mt-4">
            Loading your saved content...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4 px-4 style-comic">
      {/* Top navigation */}
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
            onClick={() => mangaApp.handleNewProject()}
            className="btn-manga-outline text-sm px-3 py-1"
            title={t("projectManager")}
          >
            📁 {t("myProjects", "我的项目")}
          </button>
        </div>

        {/* Auth status and language switcher */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.location.href = '/profile'}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-lg p-1 transition-colors"
                title={language === 'zh' ? '个人设置' : 'Profile Settings'}
              >
                <img
                  src={user.avatar || `https://via.placeholder.com/32x32/6366F1/FFFFFF?text=${((user.name || user.email || 'U')[0] || 'U').toUpperCase()}`}
                  alt={user.name || user.email || 'User'}
                  className="w-6 h-6 rounded-full border border-gray-200"
                />
                <span className="text-sm text-gray-600">
                  {user.name || user.email}
                </span>
              </button>
              <button
                onClick={() => signOut()}
                className="btn-manga-outline text-sm px-2 py-1"
                title="退出登录"
              >
                退出
              </button>
            </div>
          ) : (
            <button
              className="btn-manga-primary text-sm px-3 py-1"
              title="登录以启用云存储"
            >
              🔐 登录
            </button>
          )}
          <LanguageSwitcher />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* Left Panel - Input */}
        <div className="w-full lg:w-1/3 mb-4 lg:mb-0">
          <div className="comic-panel h-full">
            <div className="mb-2">
              <h1 className="text-2xl text-center text-gradient floating-effect">
                {t("title", {
                  style: mangaApp.style === "manga" ? t("manga") : t("comic"),
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

            {/* Configuration Section */}
            <CollapsibleSection
              title={t("settings", "设置")}
              isExpanded={true}
              onToggle={() => {}}
            >
              <div className="space-y-4">
                {/* Style Selection */}
                <div>
                  <label className="block text-manga-black font-medium mb-2">
                    {t("comicStyle", "漫画风格")}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {styleOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`p-2 text-sm rounded border transition-colors ${
                          mangaApp.style === option.value
                            ? "bg-manga-primary text-white border-manga-primary"
                            : "bg-white text-manga-black border-manga-medium-gray hover:bg-manga-light-gray"
                        }`}
                        onClick={() => mangaApp.setStyle(option.value)}
                        disabled={mangaApp.isGenerating}
                      >
                        <div className="text-lg mb-1">{option.emoji}</div>
                        <div className="text-xs">{option.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Size Selection */}
                <div>
                  <label className="block text-manga-black font-medium mb-2">
                    {t("imageSize", "图片尺寸")}
                  </label>
                  <select
                    className="w-full p-2 border border-manga-medium-gray rounded focus:outline-none focus:ring-2 focus:ring-manga-primary"
                    value={mangaApp.imageSize?.volcEngineSize || "1K"}
                    onChange={(e) => {
                      const selected = imageSizeOptions.find(opt => opt.value === e.target.value);
                      if (selected) {
                        mangaApp.setImageSize({
                          width: selected.width,
                          height: selected.height,
                          aspectRatio: "1:1" as const,
                          volcEngineSize: selected.value as "1K" | "2K" | "4K",
                        });
                      }
                    }}
                    disabled={mangaApp.isGenerating}
                  >
                    {imageSizeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI Model Selection */}
                <div>
                  <label className="block text-manga-black font-medium mb-2">
                    {t("aiModel", "AI模型")}
                  </label>
                  <select
                    className="w-full p-2 border border-manga-medium-gray rounded focus:outline-none focus:ring-2 focus:ring-manga-primary"
                    value={mangaApp.aiModel}
                    onChange={(e) => mangaApp.setAiModel(e.target.value)}
                    disabled={mangaApp.isGenerating}
                  >
                    {aiModelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CollapsibleSection>

            {/* Character Upload */}
            <CollapsibleSection
              title={t("uploadCharacters", "上传角色参考")}
              isExpanded={false}
              onToggle={() => {}}
            >
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  {t("uploadCharactersDesc", "上传角色参考图片以获得更准确的角色生成")}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="w-full p-2 border border-manga-medium-gray rounded"
                  onChange={(e) => {
                    // Handle character upload
                    console.log('Character files:', e.target.files);
                  }}
                  disabled={mangaApp.isGenerating}
                />
                {mangaApp.uploadedCharacterReferences.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {mangaApp.uploadedCharacterReferences.map((ref, index) => (
                      <div key={index} className="relative">
                        <img
                          src={ref.image}
                          alt={ref.name}
                          className="w-full h-20 object-cover rounded border"
                        />
                        <button
                          onClick={() => mangaApp.removeUploadedCharacterReference(ref.id)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* Setting Upload */}
            <CollapsibleSection
              title={t("uploadSettings", "上传场景参考")}
              isExpanded={false}
              onToggle={() => {}}
            >
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  {t("uploadSettingsDesc", "上传场景参考图片以获得更准确的背景生成")}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="w-full p-2 border border-manga-medium-gray rounded"
                  onChange={(e) => {
                    // Handle setting upload
                    console.log('Setting files:', e.target.files);
                  }}
                  disabled={mangaApp.isGenerating}
                />
                {mangaApp.uploadedSettingReferences.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {mangaApp.uploadedSettingReferences.map((ref, index) => (
                      <div key={index} className="relative">
                        <img
                          src={ref.image}
                          alt={ref.name}
                          className="w-full h-20 object-cover rounded border"
                        />
                        <button
                          onClick={() => mangaApp.removeUploadedSettingReference(ref.id)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* Story Input */}
            <div className="mb-4">
              <label htmlFor="story-input" className="block text-manga-black font-medium mb-2">
                {t("enterYourStory")}
              </label>
              <textarea
                id="story-input"
                className="w-full h-32 p-3 border border-manga-medium-gray rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-manga-primary focus:border-transparent"
                placeholder={t("storyPlaceholder")}
                value={mangaApp.story}
                onChange={(e) => mangaApp.setStory(e.target.value)}
                disabled={mangaApp.isGenerating}
              />
              <div className="text-right text-sm text-manga-medium-gray mt-1">
                {mangaApp.story.length}/500 {t("characters")}
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="button"
              className="btn-manga-primary w-full mb-2"
              onClick={mangaApp.generateComic}
              disabled={mangaApp.isGenerating || !mangaApp.story.trim() || mangaApp.story.length > 500}
            >
              {mangaApp.isGenerating ? (
                <>
                  <LoadingSpinner size="small" color="white" className="mr-2" />
                  {t("generating")}
                </>
              ) : (
                <>🎨 {t("generateComic")}</>
              )}
            </button>

            {/* Sample Stories */}
            <CollapsibleSection
              title={t("sampleStories")}
              isExpanded={false}
              onToggle={() => {}}
            >
              <div className="space-y-2">
                {Object.entries(SAMPLE_STORIES).map(([lang, story]) => (
                  <button
                    key={lang}
                    type="button"
                    className="w-full text-left p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border"
                    onClick={() => mangaApp.setStory(story)}
                    disabled={mangaApp.isGenerating}
                  >
                    {lang === 'zh' ? '中文示例' : 'English Sample'}
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="w-full lg:w-2/3">
          <div className="comic-panel h-full">
            {/* Story Analysis */}
            <AccordionSection
              id="analysis"
              title={t("storyAnalysis")}
              stepNumber={1}
              isCompleted={!!mangaApp.storyAnalysis}
              isOpen={mangaApp.openAccordions.has("analysis")}
              onToggle={() => mangaApp.toggleAccordion("analysis")}
            >
              {mangaApp.storyAnalysis ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold">{t("title")}</h4>
                    <p>{mangaApp.storyAnalysis.title}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">{t("characters")}</h4>
                    <p>{mangaApp.storyAnalysis.characters?.join(', ')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">{t("setting")}</h4>
                    <p>{mangaApp.storyAnalysis.setting?.location}</p>
                  </div>
                </div>
              ) : (
                <p className="text-manga-medium-gray">{t("storyAnalysisPlaceholder")}</p>
              )}
            </AccordionSection>

            {/* Character References */}
            <AccordionSection
              id="characters"
              title={t("characterDesigns")}
              stepNumber={2}
              isCompleted={mangaApp.characterReferences.length > 0}
              isOpen={mangaApp.openAccordions.has("characters")}
              onToggle={() => mangaApp.toggleAccordion("characters")}
            >
              {mangaApp.characterReferences.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mangaApp.characterReferences.map((character, index) => (
                    <CharacterCard
                      key={index}
                      character={character}
                      onImageClick={(imageUrl, altText) => {
                        setSelectedImageForEdit({
                          url: imageUrl,
                          panelNumber: index + 1,
                          altText: altText || `Character ${index + 1}`,
                        });
                        setShowImageEditModal(true);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-manga-medium-gray">{t("characterDesignsPlaceholder")}</p>
              )}
            </AccordionSection>

            {/* Story Breakdown */}
            <AccordionSection
              id="layout"
              title={t("storyBreakdown", "故事分解")}
              stepNumber={3}
              isCompleted={!!mangaApp.storyBreakdown}
              isOpen={mangaApp.openAccordions.has("layout")}
              onToggle={() => mangaApp.toggleAccordion("layout")}
            >
              {mangaApp.storyBreakdown ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">{t("panels", "面板")}</h4>
                    <div className="space-y-2">
                      {mangaApp.storyBreakdown.panels?.map((panel: any, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 rounded border">
                          <div className="font-medium text-sm mb-1">
                            {t("panel", "面板")} {panel.panelNumber}
                          </div>
                          <div className="text-sm text-gray-600">
                            {panel.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-manga-medium-gray">{t("storyBreakdownPlaceholder", "故事分解将在这里显示")}</p>
              )}
            </AccordionSection>

            {/* Generated Panels */}
            <AccordionSection
              id="panels"
              title={t("comicPanels")}
              stepNumber={4}
              isCompleted={mangaApp.generatedPanels.length > 0}
              isOpen={mangaApp.openAccordions.has("panels")}
              onToggle={() => mangaApp.toggleAccordion("panels")}
            >
              {mangaApp.generatedPanels.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mangaApp.generatedPanels.map((panel, index) => (
                    <PanelCard
                      key={index}
                      panel={panel}
                      onImageClick={(imageUrl, altText) => {
                        setSelectedImageForEdit({
                          url: imageUrl,
                          panelNumber: index + 1,
                          altText: altText || `Panel ${index + 1}`,
                        });
                        setShowImageEditModal(true);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-manga-medium-gray">{t("comicPanelsPlaceholder")}</p>
              )}
            </AccordionSection>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {mangaApp.generatedPanels.length > 0 && (
        <div className="fixed bottom-4 right-4 flex gap-2">
          <button
            onClick={() => setShowShareModal(true)}
            className="btn-manga-primary px-4 py-2 rounded-full shadow-lg"
            title={t("shareComic", "分享漫画")}
          >
            📤 {t("share", "分享")}
          </button>
          <DownloadButton
            onClick={() => {
              // Handle download
              console.log('Download clicked');
            }}
            isLoading={false}
            label={t("download", "下载")}
            loadingText={t("downloading", "下载中...")}
            variant="outline"
          />
        </div>
      )}

      {/* Modals */}
      {showProjectManager && (
        <ProjectManager
          isOpen={showProjectManager}
          onClose={() => setShowProjectManager(false)}
          currentProjectId={mangaApp.currentProjectId}
          onProjectSelect={mangaApp.handleProjectSelect}
          onNewProject={mangaApp.handleNewProject}
        />
      )}

      {showShareModal && (
        <ShareComicModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          panels={mangaApp.generatedPanels}
          storyTitle={mangaApp.storyAnalysis?.title || "My Comic"}
          storyDescription={mangaApp.story}
          style={mangaApp.style}
        />
      )}

      {showImageEditModal && selectedImageForEdit && (
        <ImageEditModal
          isOpen={showImageEditModal}
          onClose={() => {
            setShowImageEditModal(false);
            setSelectedImageForEdit(null);
          }}
          imageType="panel"
          imageId={selectedImageForEdit.panelNumber}
          originalImage={selectedImageForEdit.url}
          originalPrompt=""
          onRedraw={async (newPrompt?: string) => {
            // Handle redraw
            console.log('Redraw with prompt:', newPrompt);
          }}
          onModify={async (modificationPrompt: string) => {
            // Handle modify
            console.log('Modify with prompt:', modificationPrompt);
          }}
          isProcessing={false}
          characterReferences={mangaApp.characterReferences}
        />
      )}

      {/* Generation Progress */}
      {mangaApp.isGenerating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <LoadingSpinner size="medium" />
              <h3 className="text-lg font-semibold mt-4 mb-2">
                {t("generating", "生成中...")}
              </h3>
              <p className="text-gray-600 mb-4">
                {mangaApp.currentStepText || t("processingStory", "正在处理您的故事...")}
              </p>
              {mangaApp.generationState?.totalPanels > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-manga-primary h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(mangaApp.generationState.completedPanels / mangaApp.generationState.totalPanels) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
