/**
 * 统一的存储路径管理器
 * 实现清晰的 用户/项目/数据 目录结构
 */

export interface PathConfig {
  userId: string;
  projectId: string;
  isAnonymous?: boolean;
}

export interface FilePathConfig extends PathConfig {
  fileName: string;
  category?: 'generation' | 'images' | 'metadata';
  subCategory?: string;
}

export class StoragePathManager {
  private static readonly BASE_PRIVATE = 'private';
  private static readonly BASE_PUBLIC = 'public';
  private static readonly BASE_TEMP = 'temp';

  /**
   * 生成用户项目的基础路径
   */
  static getProjectBasePath(config: PathConfig): string {
    const userType = config.isAnonymous ? 'anonymous' : 'users';
    return `${this.BASE_PRIVATE}/${userType}/${config.userId}/projects/${config.projectId}`;
  }

  /**
   * 生成项目主数据文件路径
   */
  static getProjectDataPath(config: PathConfig): string {
    const basePath = this.getProjectBasePath(config);
    return `${basePath}/project.json`;
  }

  /**
   * 生成项目元数据文件路径
   */
  static getProjectMetadataPath(config: PathConfig): string {
    const basePath = this.getProjectBasePath(config);
    return `${basePath}/metadata.json`;
  }

  /**
   * 生成AI生成过程数据文件路径
   */
  static getGenerationDataPath(config: PathConfig, step: 'story-analysis' | 'character-refs' | 'story-breakdown' | 'panels-generation'): string {
    const basePath = this.getProjectBasePath(config);
    return `${basePath}/generation/${step}.json`;
  }

  /**
   * 生成图片文件路径
   */
  static getImagePath(config: FilePathConfig): string {
    const basePath = this.getProjectBasePath(config);
    
    if (config.category === 'images') {
      if (config.subCategory) {
        return `${basePath}/images/${config.subCategory}/${config.fileName}`;
      }
      return `${basePath}/images/${config.fileName}`;
    }
    
    // 默认图片路径
    return `${basePath}/images/${config.fileName}`;
  }

  /**
   * 生成角色图片路径
   */
  static getCharacterImagePath(config: PathConfig, characterName: string, type: 'generated' | 'uploaded' = 'generated'): string {
    const basePath = this.getProjectBasePath(config);
    const fileName = type === 'generated' ? `${characterName}.jpg` : `${characterName}.jpg`;
    return `${basePath}/images/characters/${type}/${fileName}`;
  }

  /**
   * 生成场景图片路径
   */
  static getSettingImagePath(config: PathConfig, refId: string): string {
    const basePath = this.getProjectBasePath(config);
    return `${basePath}/images/settings/uploaded/${refId}.jpg`;
  }

  /**
   * 生成面板图片路径
   */
  static getPanelImagePath(config: PathConfig, panelNumber: number): string {
    const basePath = this.getProjectBasePath(config);
    return `${basePath}/images/panels/${panelNumber}.jpg`;
  }

  /**
   * 生成公开漫画路径
   */
  static getPublicComicPath(comicId: string): string {
    return `${this.BASE_PUBLIC}/comics/${comicId}`;
  }

  /**
   * 生成公开漫画数据文件路径
   */
  static getPublicComicDataPath(comicId: string): string {
    return `${this.getPublicComicPath(comicId)}/comic.json`;
  }

  /**
   * 生成公开漫画缩略图路径
   */
  static getPublicComicThumbnailPath(comicId: string): string {
    return `${this.getPublicComicPath(comicId)}/thumbnail.jpg`;
  }

  /**
   * 生成临时分享路径
   */
  static getTemporarySharePath(shareId: string): string {
    return `${this.BASE_PUBLIC}/shared/${shareId}/share.json`;
  }

  /**
   * 生成临时文件路径
   */
  static getTemporaryFilePath(sessionId: string, fileName: string): string {
    const timestamp = Date.now();
    return `${this.BASE_TEMP}/${sessionId}/${timestamp}/${fileName}`;
  }

  /**
   * 解析路径获取配置信息
   */
  static parseProjectPath(filePath: string): PathConfig | null {
    // 匹配模式: private/(users|anonymous)/{userId}/projects/{projectId}/...
    const match = filePath.match(/^private\/(users|anonymous)\/([^\/]+)\/projects\/([^\/]+)/);
    
    if (!match) {
      return null;
    }

    const [, userType, userId, projectId] = match;
    
    return {
      userId,
      projectId,
      isAnonymous: userType === 'anonymous'
    };
  }

  /**
   * 检查路径是否为私有项目路径
   */
  static isPrivateProjectPath(filePath: string): boolean {
    return filePath.startsWith(`${this.BASE_PRIVATE}/`) && filePath.includes('/projects/');
  }

  /**
   * 检查路径是否为公开路径
   */
  static isPublicPath(filePath: string): boolean {
    return filePath.startsWith(`${this.BASE_PUBLIC}/`);
  }

  /**
   * 检查路径是否为临时路径
   */
  static isTemporaryPath(filePath: string): boolean {
    return filePath.startsWith(`${this.BASE_TEMP}/`);
  }

  /**
   * 获取文件的相对路径（去除基础路径）
   */
  static getRelativePath(fullPath: string, basePath: string): string {
    if (fullPath.startsWith(basePath)) {
      const relativePath = fullPath.substring(basePath.length);
      return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    }
    return fullPath;
  }

  /**
   * 标准化路径（确保路径格式一致）
   */
  static normalizePath(path: string): string {
    // 移除开头的斜杠
    let normalized = path.startsWith('/') ? path.substring(1) : path;
    
    // 移除结尾的斜杠
    normalized = normalized.endsWith('/') ? normalized.substring(0, normalized.length - 1) : normalized;
    
    // 替换多个连续斜杠为单个斜杠
    normalized = normalized.replace(/\/+/g, '/');
    
    return normalized;
  }

  /**
   * 生成项目的所有相关路径
   */
  static getAllProjectPaths(config: PathConfig): {
    basePath: string;
    projectData: string;
    metadata: string;
    generation: {
      storyAnalysis: string;
      characterRefs: string;
      storyBreakdown: string;
      panelsGeneration: string;
    };
    images: {
      charactersGenerated: string;
      charactersUploaded: string;
      settingsUploaded: string;
      panels: string;
    };
  } {
    const basePath = this.getProjectBasePath(config);
    
    return {
      basePath,
      projectData: this.getProjectDataPath(config),
      metadata: this.getProjectMetadataPath(config),
      generation: {
        storyAnalysis: this.getGenerationDataPath(config, 'story-analysis'),
        characterRefs: this.getGenerationDataPath(config, 'character-refs'),
        storyBreakdown: this.getGenerationDataPath(config, 'story-breakdown'),
        panelsGeneration: this.getGenerationDataPath(config, 'panels-generation')
      },
      images: {
        charactersGenerated: `${basePath}/images/characters/generated/`,
        charactersUploaded: `${basePath}/images/characters/uploaded/`,
        settingsUploaded: `${basePath}/images/settings/uploaded/`,
        panels: `${basePath}/images/panels/`
      }
    };
  }

  /**
   * 验证路径是否符合规范
   */
  static validatePath(path: string): { valid: boolean; error?: string } {
    // 检查路径长度
    if (path.length > 1000) {
      return { valid: false, error: 'Path too long' };
    }

    // 检查非法字符
    if (/[<>:"|?*\x00-\x1f]/.test(path)) {
      return { valid: false, error: 'Path contains illegal characters' };
    }

    // 检查路径结构
    if (!path.startsWith(this.BASE_PRIVATE) && 
        !path.startsWith(this.BASE_PUBLIC) && 
        !path.startsWith(this.BASE_TEMP)) {
      return { valid: false, error: 'Path must start with private/, public/, or temp/' };
    }

    return { valid: true };
  }
}

// 导出便捷函数
export const {
  getProjectBasePath,
  getProjectDataPath,
  getProjectMetadataPath,
  getGenerationDataPath,
  getImagePath,
  getCharacterImagePath,
  getSettingImagePath,
  getPanelImagePath,
  getPublicComicPath,
  getPublicComicDataPath,
  getPublicComicThumbnailPath,
  getTemporarySharePath,
  getTemporaryFilePath,
  parseProjectPath,
  isPrivateProjectPath,
  isPublicPath,
  isTemporaryPath,
  getRelativePath,
  normalizePath,
  getAllProjectPaths,
  validatePath
} = StoragePathManager;
