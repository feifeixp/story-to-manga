/**
 * 新的存储数据结构定义
 */

import type { ComicStyle, StoryAnalysis, StoryBreakdown, CharacterReference, GeneratedPanel } from './index';
import type { ImageSizeConfig } from './project';

// ===== 项目数据结构 =====

export interface ProjectMetadata {
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  isPublic: boolean;
  tags: string[];
  thumbnail?: string;
}

export interface ProjectInput {
  story: string;
  style: ComicStyle;
  language: string;
  aiModel: string;
  imageSize: ImageSizeConfig;
}

export interface GenerationReference {
  dataPath: string;
  completedAt: string;
  duration?: number;
  retryCount?: number;
}

export interface ProjectGeneration {
  storyAnalysis?: GenerationReference;
  characterReferences?: GenerationReference;
  storyBreakdown?: GenerationReference;
  panelsGeneration?: GenerationReference;
}

export interface UserUploadReference {
  id: string;
  name: string;
  imagePath: string;
  uploadedAt: string;
}

export interface ProjectUserUploads {
  characterReferences: UserUploadReference[];
  settingReferences: UserUploadReference[];
}

export interface ProjectGenerationState {
  isGenerating: boolean;
  currentStep: 'story-analysis' | 'character-refs' | 'story-breakdown' | 'panels-generation' | 'completed';
  progress: number;
  failedPanels: number[];
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
}

export interface ProjectData {
  version: string;
  projectId: string;
  metadata: ProjectMetadata;
  input: ProjectInput;
  generation: ProjectGeneration;
  userUploads: ProjectUserUploads;
  generationState: ProjectGenerationState;
}

// ===== AI生成过程数据结构 =====

export interface GenerationMetadata {
  model: string;
  duration: number;
  retryCount: number;
  timestamp: string;
}

export interface StoryAnalysisData {
  timestamp: string;
  input: {
    story: string;
    style: ComicStyle;
    language: string;
  };
  output: StoryAnalysis;
  metadata: GenerationMetadata;
}

export interface CharacterReferencesData {
  timestamp: string;
  input: {
    characters: any[];
    setting: any;
    style: ComicStyle;
    language: string;
  };
  output: {
    characterReferences: Array<{
      name: string;
      description: string;
      imagePath: string;
    }>;
  };
  metadata: GenerationMetadata;
}

export interface StoryBreakdownData {
  timestamp: string;
  input: {
    story: string;
    characters: any[];
    scenes: any[];
    style: ComicStyle;
  };
  output: StoryBreakdown;
  metadata: GenerationMetadata;
}

export interface PanelsGenerationData {
  timestamp: string;
  input: {
    panels: any[];
    characterReferences: any[];
    style: ComicStyle;
    aiModel: string;
  };
  output: {
    generatedPanels: Array<{
      panelNumber: number;
      imagePath: string;
      description: string;
      characters: string[];
      setting: string;
      mood: string;
      modelUsed: string;
    }>;
  };
  metadata: {
    totalPanels: number;
    completedPanels: number;
    failedPanels: number[];
    totalDuration: number;
    averageDuration: number;
  };
}

// ===== 公开分享数据结构 =====

export interface PublicComicAuthor {
  id: string;
  name: string;
  avatar?: string;
}

export interface PublicComicPanel {
  panelNumber: number;
  imageUrl: string;
  textContent?: string;
}

export interface PublicComicSourceProject {
  userId: string;
  projectId: string;
  projectPath: string;
}

export interface PublicComicStats {
  views: number;
  likes: number;
  shares: number;
}

export interface PublicComicData {
  version: string;
  comicId: string;
  title: string;
  description?: string;
  author: PublicComicAuthor;
  style: ComicStyle;
  tags: string[];
  publishedAt: string;
  sourceProject: PublicComicSourceProject;
  panels: PublicComicPanel[];
  stats: PublicComicStats;
}

// ===== 临时分享数据结构 =====

export interface TemporaryShareData {
  shareId: string;
  projectId: string;
  userId: string;
  title: string;
  panels: PublicComicPanel[];
  expiresAt: string;
  createdAt: string;
}

// ===== 数据加载选项 =====

export interface LoadOptions {
  includeGeneration?: boolean;
  includeImages?: boolean;
  includeMetadata?: boolean;
  generationSteps?: Array<'story-analysis' | 'character-refs' | 'story-breakdown' | 'panels-generation'>;
}

// ===== 数据保存选项 =====

export interface SaveOptions {
  updateTimestamp?: boolean;
  createBackup?: boolean;
  validateData?: boolean;
}

// ===== 迁移数据结构 =====

export interface MigrationResult {
  success: boolean;
  migratedProjects: number;
  failedProjects: number;
  errors: string[];
}

export interface LegacyProjectData {
  version: string;
  story: string;
  style: ComicStyle;
  aiModel?: string;
  storyAnalysis: StoryAnalysis | null;
  storyBreakdown: StoryBreakdown | null;
  characterReferences: CharacterReference[];
  generatedPanels: GeneratedPanel[];
  uploadedCharacterReferences: any[];
  uploadedSettingReferences: any[];
  imageSize?: ImageSizeConfig;
  generationState?: any;
  setting?: any;
  scenes?: any[];
  timestamp: number;
}

// ===== 工具类型 =====

export type StorageOperation = 'save' | 'load' | 'delete' | 'migrate';

export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  operation: StorageOperation;
  timestamp: string;
}

export interface BatchStorageResult {
  success: boolean;
  results: StorageResult[];
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
}

// ===== 路径配置 =====

export interface StoragePathConfig {
  userId: string;
  projectId: string;
  isAnonymous?: boolean;
}

export interface FileStorageConfig extends StoragePathConfig {
  fileName: string;
  contentType?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

// ===== 存储统计 =====

export interface StorageStats {
  totalProjects: number;
  totalSize: number;
  imageCount: number;
  jsonCount: number;
  lastUpdated: string;
}

export interface UserStorageStats extends StorageStats {
  userId: string;
  isAnonymous: boolean;
  quotaUsed: number;
  quotaLimit: number;
}

// ===== 缓存配置 =====

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size in MB
  strategy: 'lru' | 'fifo' | 'lfu';
}

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  size: number;
}

// ===== 验证规则 =====

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  validator?: (value: any) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

// ===== 事件类型 =====

export type StorageEventType = 
  | 'project-created'
  | 'project-updated'
  | 'project-deleted'
  | 'generation-started'
  | 'generation-completed'
  | 'generation-failed'
  | 'comic-published'
  | 'comic-shared';

export interface StorageEvent {
  type: StorageEventType;
  projectId: string;
  userId: string;
  timestamp: string;
  data?: any;
}

// ===== 导出所有类型 =====

export type {
  // 主要数据结构
  ProjectData,
  ProjectMetadata,
  ProjectInput,
  ProjectGeneration,
  ProjectUserUploads,
  ProjectGenerationState,
  
  // AI生成数据
  StoryAnalysisData,
  CharacterReferencesData,
  StoryBreakdownData,
  PanelsGenerationData,
  
  // 公开分享
  PublicComicData,
  PublicComicAuthor,
  PublicComicPanel,
  TemporaryShareData,
  
  // 操作相关
  LoadOptions,
  SaveOptions,
  StorageResult,
  BatchStorageResult,
  
  // 配置相关
  StoragePathConfig,
  FileStorageConfig,
  CacheConfig,
  
  // 统计和验证
  StorageStats,
  UserStorageStats,
  ValidationResult,
  
  // 事件
  StorageEvent
};
