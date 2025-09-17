import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface ReferenceImage {
  id: string;
  name: string;
  image: string;
  source: 'upload' | 'character';
}

interface ImageEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageType: 'panel' | 'character';
  imageId: string | number;
  originalImage: string;
  originalPrompt: string;
  onRedraw: (newPrompt?: string, referenceImages?: ReferenceImage[]) => Promise<void>;
  onModify: (modificationPrompt: string) => Promise<void>;
  isProcessing: boolean;
  characterReferences?: Array<{ name: string; image: string; description?: string }>;
  autoSelectedReferences?: ReferenceImage[]; // 自动选择的参考图片
}

export const ImageEditModal: React.FC<ImageEditModalProps> = ({
  isOpen,
  onClose,
  imageType,
  imageId,
  originalImage,
  originalPrompt,
  onRedraw,
  onModify,
  isProcessing,
  characterReferences = [],
  autoSelectedReferences = [],
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'redraw' | 'modify'>('redraw');
  const [newPrompt, setNewPrompt] = useState(originalPrompt);
  const [modificationPrompt, setModificationPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [showReferenceSelector, setShowReferenceSelector] = useState(false);

  // 🎯 当模态框打开时，自动加载预选的参考图片
  React.useEffect(() => {
    if (isOpen && autoSelectedReferences.length > 0) {
      setReferenceImages(autoSelectedReferences);
      console.log(`🎯 Auto-loaded ${autoSelectedReferences.length} reference images for ${imageType} ${imageId}:`,
        autoSelectedReferences.map(ref => ref.name));
    }
  }, [isOpen, autoSelectedReferences, imageType, imageId]);

  if (!isOpen) return null;

  // 参考图管理函数
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (referenceImages.length >= 4) return; // 最多4张参考图

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('文件大小不能超过10MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          const newRef: ReferenceImage = {
            id: `upload-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
            name: file.name.replace(/\.[^/.]+$/, ''),
            image: result,
            source: 'upload'
          };
          setReferenceImages(prev => [...prev, newRef]);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    event.target.value = '';
  }, [referenceImages.length]);

  const addCharacterReference = useCallback((character: { name: string; image: string; description?: string }) => {
    if (referenceImages.length >= 4) return;

    const newRef: ReferenceImage = {
      id: `character-${character.name}-${Date.now()}`,
      name: character.name,
      image: character.image,
      source: 'character'
    };
    setReferenceImages(prev => [...prev, newRef]);
    setShowReferenceSelector(false);
  }, [referenceImages.length]);

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages(prev => prev.filter(ref => ref.id !== id));
  }, []);

  const handleRedraw = async () => {
    const promptToUse = newPrompt.trim() !== originalPrompt.trim() ? newPrompt : undefined;
    await onRedraw(promptToUse, referenceImages);
  };

  const handleModify = async () => {
    if (!modificationPrompt.trim()) return;
    await onModify(modificationPrompt);
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
      // Reset form state
      setNewPrompt(originalPrompt);
      setModificationPrompt('');
      setActiveTab('redraw');
      setReferenceImages([]);
      setShowReferenceSelector(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">
              {t('editImage')} - {imageType === 'panel' ? t('panel') : t('character')} {imageId}
            </h3>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left side - Original Image */}
            <div>
              <h4 className="text-lg font-medium mb-3">{t('originalImage')}</h4>
              <div className="border rounded-lg p-4 bg-gray-50">
                <img
                  src={originalImage}
                  alt={`Original ${imageType} ${imageId}`}
                  className="w-full h-auto rounded-lg shadow-sm"
                />
              </div>
              
              {/* Original Prompt Display */}
              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">{t('originalPrompt')}</h5>
                <div className="bg-gray-100 p-3 rounded text-sm text-gray-600 max-h-32 overflow-y-auto">
                  {originalPrompt}
                </div>
              </div>
            </div>

            {/* Right side - Edit Options */}
            <div>
              <h4 className="text-lg font-medium mb-3">{t('editOptions')}</h4>
              
              {/* Tab Navigation */}
              <div className="flex border-b mb-4">
                <button
                  onClick={() => setActiveTab('redraw')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === 'redraw'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  disabled={isProcessing}
                >
                  {t('redraw')}
                </button>
                <button
                  onClick={() => setActiveTab('modify')}
                  className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === 'modify'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  disabled={isProcessing}
                >
                  {t('modify')}
                </button>
              </div>

              {/* Redraw Tab */}
              {activeTab === 'redraw' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('editPrompt')}
                    </label>
                    <textarea
                      value={newPrompt}
                      onChange={(e) => setNewPrompt(e.target.value)}
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={t('editPromptPlaceholder')}
                      disabled={isProcessing}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('redrawDescription')}
                    </p>
                  </div>

                  {/* 参考图管理 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        参考图片 ({referenceImages.length}/4)
                      </label>
                      <div className="flex gap-2">
                        {/* 上传本地图片 */}
                        <label className="btn-manga-outline text-xs px-3 py-1 cursor-pointer">
                          📁 上传图片
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={isProcessing || referenceImages.length >= 4}
                          />
                        </label>
                        {/* 选择角色 */}
                        {characterReferences.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowReferenceSelector(!showReferenceSelector)}
                            className="btn-manga-outline text-xs px-3 py-1"
                            disabled={isProcessing || referenceImages.length >= 4}
                          >
                            👤 选择角色
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 角色选择器 */}
                    {showReferenceSelector && (
                      <div className="mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="text-sm font-medium text-gray-700 mb-2">选择角色参考图：</div>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                          {characterReferences.map((char, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => addCharacterReference(char)}
                              className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-white transition-colors text-left"
                              disabled={referenceImages.length >= 4 || referenceImages.some(ref => ref.name === char.name)}
                            >
                              <img
                                src={char.image}
                                alt={char.name}
                                className="w-8 h-8 object-cover rounded"
                              />
                              <span className="text-sm truncate">{char.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 已选择的参考图 */}
                    {referenceImages.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {referenceImages.map((ref) => (
                          <div key={ref.id} className="relative border border-gray-200 rounded-lg p-2 bg-gray-50">
                            <div className="flex items-center gap-2">
                              <img
                                src={ref.image}
                                alt={ref.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{ref.name}</div>
                                <div className="text-xs text-gray-500">
                                  {ref.source === 'upload' ? '📁 本地上传' : '👤 角色参考'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeReferenceImage(ref.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                disabled={isProcessing}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      💡 添加参考图片可以帮助AI更好地理解角色外观和场景风格，最多可添加4张参考图
                    </p>
                  </div>

                  <button
                    onClick={handleRedraw}
                    disabled={isProcessing || !newPrompt.trim()}
                    className="w-full btn-manga-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t('redrawing')}...
                      </div>
                    ) : (
                      t('redrawImage')
                    )}
                  </button>
                </div>
              )}

              {/* Modify Tab */}
              {activeTab === 'modify' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('modificationInstructions')}
                    </label>
                    <textarea
                      value={modificationPrompt}
                      onChange={(e) => setModificationPrompt(e.target.value)}
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={t('modificationPlaceholder')}
                      disabled={isProcessing}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('modifyDescription')}
                    </p>
                  </div>
                  
                  <button
                    onClick={handleModify}
                    disabled={isProcessing || !modificationPrompt.trim()}
                    className="w-full btn-manga-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {t('modifying')}...
                      </div>
                    ) : (
                      t('modifyImage')
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t flex justify-end">
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="btn-manga-outline px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? t('processing') : t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
