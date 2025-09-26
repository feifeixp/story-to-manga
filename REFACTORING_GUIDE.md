# 漫画应用模块化重构指南

## 概述

原始的 `src/app/app/page.tsx` 文件超过6000行代码，包含了所有功能逻辑，难以维护。本重构将其拆分为多个专门的 Hook 模块，每个模块负责特定的功能领域。

## 模块架构

### 1. 核心状态管理 (`useAppState.ts`)
**职责**: 管理应用的主要状态
- 故事内容、样式、AI模型等基础状态
- 生成结果（分析、分解、角色、面板）
- 上传的参考图片
- UI状态（手风琴展开、模态框等）
- 基础操作函数（清除数据、设置项目数据等）

### 2. 项目管理 (`useProjectManager.ts`)
**职责**: 处理项目的CRUD操作
- 项目创建、加载、保存
- 防抖和去重机制
- 项目选择和切换
- 数据持久化

**核心功能**:
```typescript
const {
  currentProjectId,
  saveProjectData,
  loadProjectData,
  selectProject,
  createProject,
  clearCurrentProject
} = useProjectManager();
```

### 3. 内容生成 (`useContentGeneration.ts`)
**职责**: AI内容生成相关功能
- 故事分析
- 角色生成
- 故事分解
- 面板批量生成
- 单个面板重新生成
- 生成状态管理

**核心功能**:
```typescript
const {
  generationState,
  analyzeStory,
  generateCharacterReferences,
  breakdownStory,
  generatePanelsBatch,
  regeneratePanel
} = useContentGeneration();
```

### 4. 内容分享 (`useContentSharing.ts`)
**职责**: 分享和导出功能
- 准备分享数据
- 发布漫画
- 下载ZIP文件
- 截图下载
- 社交媒体分享
- 复制分享链接

**核心功能**:
```typescript
const {
  publishComic,
  downloadAsZip,
  downloadScreenshot,
  shareToSocial,
  copyShareLink
} = useContentSharing();
```

### 5. 内容编辑 (`useContentEditor.ts`)
**职责**: 内容编辑和修改功能
- 面板图片编辑
- 角色图片编辑
- 批量编辑
- 面板顺序调整
- 面板增删改
- 描述和对话更新

**核心功能**:
```typescript
const {
  editPanelImage,
  editCharacterImage,
  reorderPanels,
  deletePanel,
  duplicatePanel,
  updatePanelDescription
} = useContentEditor();
```

### 6. 主应用 Hook (`useMangaApp.ts`)
**职责**: 整合所有模块，提供统一接口
- 组合所有功能模块
- 提供高级操作函数
- 处理应用初始化
- 管理模块间的交互

## 重构优势

### 1. **可维护性**
- 每个模块职责单一，易于理解和修改
- 代码结构清晰，便于定位问题
- 模块间解耦，修改一个模块不影响其他模块

### 2. **可测试性**
- 每个 Hook 可以独立测试
- 功能模块化使得单元测试更容易编写
- 可以模拟特定模块进行集成测试

### 3. **可复用性**
- Hook 可以在其他组件中复用
- 功能模块可以独立使用
- 便于构建不同的UI界面

### 4. **性能优化**
- 更精确的依赖管理
- 避免不必要的重新渲染
- 更好的内存管理

### 5. **开发体验**
- 代码提示更准确
- 更容易进行代码审查
- 新功能开发更快速

## 使用示例

### 基础使用
```typescript
import { useMangaApp } from '@/hooks/useMangaApp';

function MyComponent() {
  const app = useMangaApp();
  
  return (
    <div>
      <input 
        value={app.story} 
        onChange={(e) => app.setStory(e.target.value)} 
      />
      <button onClick={app.generateComic}>
        Generate Comic
      </button>
    </div>
  );
}
```

### 单独使用模块
```typescript
import { useProjectManager } from '@/hooks/useProjectManager';
import { useContentGeneration } from '@/hooks/useContentGeneration';

function CustomComponent() {
  const projectManager = useProjectManager();
  const contentGen = useContentGeneration();
  
  // 只使用需要的功能
  const handleAnalyze = async () => {
    const analysis = await contentGen.analyzeStory({
      story: 'My story...',
      style: 'manga',
      language: 'en',
      aiModel: 'auto'
    });
    
    if (projectManager.currentProjectId) {
      await projectManager.saveProjectData(/* ... */);
    }
  };
  
  return <button onClick={handleAnalyze}>Analyze</button>;
}
```

## 迁移步骤

### 1. 逐步替换
1. 首先创建新的 Hook 文件
2. 在原始页面中导入并使用新 Hook
3. 逐步移除原始代码
4. 测试每个步骤确保功能正常

### 2. 组件拆分
1. 将大的页面组件拆分为小的功能组件
2. 每个组件使用相应的 Hook
3. 保持组件的单一职责

### 3. 测试验证
1. 为每个 Hook 编写单元测试
2. 进行集成测试确保模块间协作正常
3. 进行端到端测试验证用户流程

## 文件结构

```
src/
├── hooks/
│   ├── useAppState.ts          # 核心状态管理
│   ├── useProjectManager.ts    # 项目管理
│   ├── useContentGeneration.ts # 内容生成
│   ├── useContentSharing.ts    # 内容分享
│   ├── useContentEditor.ts     # 内容编辑
│   └── useMangaApp.ts          # 主应用Hook
├── components/
│   ├── StoryInput.tsx          # 故事输入组件
│   ├── StoryAnalysis.tsx       # 故事分析组件
│   ├── CharacterReferences.tsx # 角色参考组件
│   ├── GeneratedPanels.tsx     # 生成面板组件
│   └── ComicCompositor.tsx     # 漫画合成器组件
└── app/
    └── app/
        ├── page.tsx            # 原始页面（待替换）
        └── page-refactored.tsx # 重构后的页面
```

## 注意事项

1. **向后兼容**: 重构过程中保持API兼容性
2. **渐进式迁移**: 不要一次性替换所有代码
3. **充分测试**: 每个模块都要有完整的测试覆盖
4. **文档更新**: 及时更新相关文档和注释
5. **性能监控**: 关注重构后的性能变化

## 下一步计划

1. 完成所有 Hook 的实现
2. 创建对应的 React 组件
3. 编写完整的测试套件
4. 逐步迁移原始页面
5. 优化性能和用户体验
