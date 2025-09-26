/**
 * 简化的存储系统 - 替代复杂的存储架构
 */

export interface AppState {
  story: string;
  style: string;
  generatedPanels: any[];
  characterReferences: any[];
  settingReferences: any[];
  uploadedCharacterReferences?: any[];
  uploadedSettingReferences?: any[];
  storyAnalysis?: any;
  storyBreakdown?: any;
  currentProjectId?: string;
  lastSaved?: number;
}

export interface StorageInfo {
  used: number;
  total: number;
  percentage: number;
  available: number;
  hasData?: boolean;
  timestamp?: number;
}

const STORAGE_KEY = 'storytomanga_app_state';

/**
 * 保存应用状态到 localStorage
 */
export async function saveState(
  story: string,
  style: string,
  generatedPanels: any[] = [],
  characterReferences: any[] = [],
  settingReferences: any[] = [],
  currentProjectId?: string
): Promise<void> {
  try {
    const state: AppState = {
      story,
      style,
      generatedPanels,
      characterReferences,
      settingReferences,
      ...(currentProjectId && { currentProjectId }),
      lastSaved: Date.now(),
    };

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      console.log('✅ State saved to localStorage');
    }
  } catch (error) {
    console.error('❌ Failed to save state:', error);
    throw error;
  }
}

/**
 * 从 localStorage 加载应用状态
 */
export async function loadState(): Promise<AppState | null> {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const state = JSON.parse(stored) as AppState;
    console.log('✅ State loaded from localStorage');
    return state;

  } catch (error) {
    console.error('❌ Failed to load state:', error);
    return null;
  }
}

/**
 * 清除所有数据
 */
export async function clearAllData(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      // 清除其他可能的存储键
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('storytomanga_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('✅ All data cleared from localStorage');
    }
  } catch (error) {
    console.error('❌ Failed to clear data:', error);
    throw error;
  }
}

/**
 * 获取存储信息
 */
export function getStorageInfo(): StorageInfo {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return {
        used: 0,
        total: 0,
        percentage: 0,
        available: 0,
      };
    }

    // 估算 localStorage 使用情况
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          used += key.length + value.length;
        }
      }
    }

    // 大多数浏览器的 localStorage 限制约为 5-10MB
    const total = 5 * 1024 * 1024; // 5MB
    const percentage = (used / total) * 100;
    const available = total - used;

    // 检查是否有保存的数据
    const stored = localStorage.getItem(STORAGE_KEY);
    const hasData = !!stored;
    let timestamp;

    if (stored) {
      try {
        const state = JSON.parse(stored) as AppState;
        timestamp = state.lastSaved;
      } catch (error) {
        // 忽略解析错误
      }
    }

    return {
      used,
      total,
      percentage,
      available,
      hasData,
      ...(timestamp && { timestamp }),
    };

  } catch (error) {
    console.error('❌ Failed to get storage info:', error);
    return {
      used: 0,
      total: 0,
      percentage: 0,
      available: 0,
    };
  }
}

/**
 * 检查存储是否可用
 */
export function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }

    const testKey = 'test_storage_availability';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;

  } catch (error) {
    return false;
  }
}

/**
 * 存储管理器类 - 兼容旧代码
 */
export class StorageManager {
  static getStorageInfo(): StorageInfo {
    return getStorageInfo();
  }

  static safeSetItem(key: string, value: string): boolean {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to set item:', error);
      return false;
    }
  }

  static emergencyCleanup(): void {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        // 清理一些可能的临时数据
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('temp_') || key.includes('cache_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('✅ Emergency cleanup completed');
      }
    } catch (error) {
      console.error('❌ Emergency cleanup failed:', error);
    }
  }

  static needsCleanup(): boolean {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        // 检查 localStorage 使用情况
        const storageInfo = getStorageInfo();
        return storageInfo.percentage > 80; // 如果使用超过80%则需要清理
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to check cleanup needs:', error);
      return false;
    }
  }

  static performCleanup(): void {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        // 执行清理操作
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.includes('temp_') ||
            key.includes('cache_') ||
            key.includes('old_') ||
            key.startsWith('debug_')
          )) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`✅ Cleanup completed, removed ${keysToRemove.length} items`);
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}
