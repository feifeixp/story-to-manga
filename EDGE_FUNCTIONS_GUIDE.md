# Edge Functions 使用指南

## 📊 当前部署状态

| 函数名 | 状态 | 版本 | 主要用途 | 推荐使用 |
|--------|------|------|----------|----------|
| `projects` | ✅ ACTIVE | v15 | 项目 CRUD 操作 | ⭐ 推荐 |
| `project-storage-working` | ✅ ACTIVE | v2 | 项目数据存储 | ⭐ 推荐 |
| `manga-generation` | ✅ ACTIVE | v13 | 漫画生成 | ⭐ 推荐 |
| `sharing` | ✅ ACTIVE | v13 | 项目分享 | ⭐ 推荐 |
| `health` | ✅ ACTIVE | v1 | 健康检查 | ⚠️ 有问题 |
| `project-storage` | ✅ ACTIVE | v17 | 项目存储（旧版） | ❌ 不推荐 |
| `project-storage-simple` | ✅ ACTIVE | v1 | 简化存储 | ❌ 测试用 |
| `projects-simple` | ✅ ACTIVE | v1 | 简化项目管理 | ❌ 测试用 |

## 🎯 推荐的 Edge Functions 架构

### 1. 项目管理 - `projects` 函数

**端点**: `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects`

#### 获取项目列表
```http
GET /functions/v1/projects
Headers:
  Content-Type: application/json
  apikey: [SUPABASE_ANON_KEY]
  authorization: Bearer [JWT_TOKEN 或 ANON_KEY]
  x-device-id: [设备ID，用于匿名用户]
```

**响应示例**:
```json
{
  "success": true,
  "projects": [
    {
      "id": "project-123",
      "name": "我的漫画项目",
      "description": "项目描述",
      "createdAt": 1640995200000,
      "updatedAt": 1640995200000,
      "panelCount": 5,
      "characterCount": 3,
      "style": "manga",
      "status": "draft",
      "imageSize": {
        "width": 1024,
        "height": 576,
        "aspectRatio": "16:9"
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 创建新项目
```http
POST /functions/v1/projects
Headers: [同上]
Body:
{
  "name": "项目名称",
  "description": "项目描述",
  "style": "manga",
  "imageSize": {
    "width": 1024,
    "height": 576,
    "aspectRatio": "16:9"
  }
}
```

#### 删除项目
```http
DELETE /functions/v1/projects?projectId=project-123
Headers: [同上]
```

### 2. 项目数据存储 - `project-storage-working` 函数

**端点**: `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/project-storage-working`

#### 保存项目数据
```http
POST /functions/v1/project-storage-working
Headers: [同上]
Body:
{
  "projectId": "project-123",
  "story": "故事内容",
  "metadata": {
    "style": "manga",
    "storyAnalysis": {...},
    "storyBreakdown": {...},
    "characterReferences": [...],
    "generatedPanels": [...],
    "uploadedCharacterReferences": [...],
    "uploadedSettingReferences": [...],
    "imageSize": {...},
    "generationState": {...},
    "aiModel": "auto",
    "setting": {...},
    "scenes": [...]
  }
}
```

#### 加载项目数据
```http
GET /functions/v1/project-storage-working?projectId=project-123
Headers: [同上]
```

#### 获取项目列表（备选方法）
```http
GET /functions/v1/project-storage-working?list=true
Headers: [同上]
```

### 3. 漫画生成 - `manga-generation` 函数

**端点**: `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/manga-generation`

```http
POST /functions/v1/manga-generation
Headers: [同上]
Body:
{
  "projectId": "project-123",
  "panelIndex": 0,
  "prompt": "生成提示词",
  "style": "manga",
  "characterReferences": [...],
  "settingReferences": [...]
}
```

### 4. 项目分享 - `sharing` 函数

**端点**: `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/sharing`

#### 创建分享链接
```http
POST /functions/v1/sharing
Headers: [同上]
Body:
{
  "projectId": "project-123",
  "shareType": "public"
}
```

#### 获取分享内容
```http
GET /functions/v1/sharing?shareId=share-123
Headers: [同上]
```

## 🔐 认证机制

### 1. 已登录用户
```http
Headers:
  authorization: Bearer [JWT_ACCESS_TOKEN]
  apikey: [SUPABASE_ANON_KEY]
```

### 2. 匿名用户
```http
Headers:
  authorization: Bearer [SUPABASE_ANON_KEY]
  apikey: [SUPABASE_ANON_KEY]
  x-device-id: [设备唯一标识]
```

## 📱 前端使用示例

### 使用 EdgeFunctionStorage 服务
```typescript
import { edgeFunctionStorage } from '@/lib/edgeFunctionStorage';

// 获取项目列表
const projects = await edgeFunctionStorage.getProjectList();

// 创建项目
const project = await edgeFunctionStorage.createProject({
  name: "新项目",
  description: "项目描述",
  style: "manga"
});

// 保存项目数据
await edgeFunctionStorage.saveProjectData(
  projectId,
  story,
  style,
  storyAnalysis,
  storyBreakdown,
  characterReferences,
  generatedPanels
);

// 加载项目数据
const data = await edgeFunctionStorage.loadProjectData(projectId);
```

### 直接 API 调用（推荐用于调试）
```typescript
// 获取设备ID
const { deviceManager } = await import('@/lib/deviceManager');
const deviceId = await deviceManager.getDeviceId();

// 构建请求头
const headers = {
  'Content-Type': 'application/json',
  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'x-device-id': deviceId,
};

// 调用 API
const response = await fetch('https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects', {
  method: 'GET',
  headers: headers,
});
```

## ⚠️ 已知问题

1. **`health` 函数** - 无法正常访问，返回 "Failed to fetch"
2. **网络连接问题** - 某些环境下可能无法稳定访问 Edge Functions
3. **认证状态不一致** - 不同组件可能获取到不同的认证状态

## 🔧 故障排除

### 1. "Failed to fetch" 错误
- 检查网络连接
- 使用直接 API 调用替代 EdgeFunctionStorage
- 检查请求头格式

### 2. 认证失败
- 确认设备ID正确生成
- 检查 JWT token 是否过期
- 验证请求头包含必要的认证信息

### 3. 项目数据丢失
- 确认项目ID正确传递
- 检查用户/设备ID匹配
- 验证数据库权限设置

## 📈 性能优化建议

1. **缓存项目列表** - 避免频繁请求
2. **批量操作** - 合并多个小请求
3. **错误重试** - 实现自动重试机制
4. **离线支持** - 本地缓存重要数据

## 🔍 技术实现细节

### 数据库表结构
```sql
-- projects 表
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  story TEXT,
  style TEXT,
  status TEXT DEFAULT 'draft',
  visibility TEXT DEFAULT 'private',
  tags JSONB DEFAULT '[]',
  ai_model TEXT DEFAULT 'auto',
  user_id TEXT,
  device_id TEXT,
  image_size JSONB,
  generation_state JSONB,
  metadata JSONB DEFAULT '{}',
  r2_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- project_files 表
CREATE TABLE project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  file_type TEXT,
  file_path TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 认证流程图
```
用户请求 → 检查 Authorization Header
    ↓
JWT Token? → 验证用户身份 → 返回 user_id
    ↓ (否)
设备ID? → 验证设备ID → 返回 device_id
    ↓ (否)
返回认证错误
```

### 错误处理标准
```typescript
// 标准错误响应格式
{
  "success": false,
  "error": "错误描述",
  "code": "ERROR_CODE",
  "details": {...}
}

// 标准成功响应格式
{
  "success": true,
  "data": {...},
  "meta": {...}
}
```

## 🚀 未来改进计划

1. **简化架构** - 合并重复的 Edge Functions
2. **统一认证** - 改善认证状态管理
3. **监控系统** - 添加性能和错误监控
4. **文档完善** - 提供更详细的 API 文档
5. **缓存优化** - 实现 Redis 缓存层
6. **批量操作** - 支持批量项目操作
7. **实时同步** - WebSocket 实时数据同步
