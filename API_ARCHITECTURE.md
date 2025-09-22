# Story to Manga - Edge Functions API 架构设计

## 总体架构

我们将使用 Supabase Edge Functions 构建一个完整的漫画生成平台 API，包含以下核心模块：

```
📦 Edge Functions API
├── 🗂️ projects          - 项目管理
├── 🎨 manga-generation   - 漫画生成
├── 🌐 sharing           - 作品分享
├── 👤 auth              - 用户认证
├── 📁 storage           - 文件存储
└── 🔧 utils             - 工具函数
```

## 1. 项目管理 API (`/functions/v1/projects`)

### 基础 CRUD 操作
- `GET /projects` - 获取项目列表
- `POST /projects` - 创建新项目
- `GET /projects/{id}` - 获取项目详情
- `PUT /projects/{id}` - 更新项目
- `DELETE /projects/{id}` - 删除项目

### 高级功能
- `GET /projects/search?q={query}` - 搜索项目
- `GET /projects/recent` - 最近项目
- `POST /projects/{id}/duplicate` - 复制项目
- `POST /projects/{id}/export` - 导出项目
- `POST /projects/import` - 导入项目

### 数据结构
```typescript
interface Project {
  id: string
  name: string
  description?: string
  story: string
  style: ComicStyle
  status: 'draft' | 'generating' | 'completed' | 'published'
  visibility: 'private' | 'public' | 'shared'
  tags: string[]
  metadata: {
    panelCount: number
    characterCount: number
    estimatedReadTime: number
    language: string
  }
  settings: {
    imageSize: ImageSizeConfig
    aiModel: string
    generationOptions: any
  }
  createdAt: string
  updatedAt: string
  userId?: string
  deviceId?: string
}
```

## 2. 漫画生成 API (`/functions/v1/manga-generation`)

### 故事处理
- `POST /manga-generation/analyze-story` - 分析故事结构
- `POST /manga-generation/breakdown-story` - 分解故事为场景
- `POST /manga-generation/extract-characters` - 提取角色信息

### 角色生成
- `POST /manga-generation/generate-character` - 生成单个角色
- `POST /manga-generation/generate-characters` - 批量生成角色
- `POST /manga-generation/refine-character` - 优化角色设计

### 面板生成
- `POST /manga-generation/generate-panel` - 生成单个面板
- `POST /manga-generation/generate-panels` - 批量生成面板
- `POST /manga-generation/regenerate-panel` - 重新生成面板

### 批量操作
- `POST /manga-generation/generate-all` - 一键生成整个漫画
- `GET /manga-generation/status/{jobId}` - 查询生成状态
- `POST /manga-generation/cancel/{jobId}` - 取消生成任务

### 数据结构
```typescript
interface GenerationJob {
  id: string
  projectId: string
  type: 'character' | 'panel' | 'batch'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: any
  error?: string
  createdAt: string
  completedAt?: string
}
```

## 3. 作品分享 API (`/functions/v1/sharing`)

### 分享功能
- `POST /sharing/publish` - 发布作品
- `POST /sharing/create-link` - 创建分享链接
- `GET /sharing/public/{shareId}` - 获取公开作品
- `POST /sharing/unpublish` - 取消发布

### 社交功能
- `GET /sharing/gallery` - 公开画廊
- `POST /sharing/like` - 点赞作品
- `POST /sharing/comment` - 评论作品
- `GET /sharing/trending` - 热门作品

### 统计分析
- `GET /sharing/stats/{projectId}` - 作品统计
- `GET /sharing/analytics` - 用户分析数据

### 数据结构
```typescript
interface SharedWork {
  id: string
  projectId: string
  title: string
  description: string
  thumbnailUrl: string
  shareUrl: string
  visibility: 'public' | 'unlisted'
  tags: string[]
  stats: {
    views: number
    likes: number
    comments: number
    shares: number
  }
  publishedAt: string
  userId?: string
}
```

## 4. 用户认证 API (`/functions/v1/auth`)

### 认证管理
- `POST /auth/login` - 用户登录
- `POST /auth/register` - 用户注册
- `POST /auth/logout` - 用户登出
- `POST /auth/refresh` - 刷新令牌

### 设备管理
- `POST /auth/device/register` - 注册设备
- `GET /auth/device/info` - 获取设备信息
- `POST /auth/device/sync` - 同步设备数据

### 用户资料
- `GET /auth/profile` - 获取用户资料
- `PUT /auth/profile` - 更新用户资料
- `POST /auth/avatar` - 上传头像

### 数据结构
```typescript
interface User {
  id: string
  email?: string
  username?: string
  displayName: string
  avatar?: string
  isAnonymous: boolean
  deviceId?: string
  preferences: {
    language: string
    theme: string
    notifications: boolean
  }
  subscription: {
    plan: 'free' | 'pro' | 'enterprise'
    expiresAt?: string
  }
  createdAt: string
  lastActiveAt: string
}
```

## 5. 文件存储 API (`/functions/v1/storage`)

### 文件上传
- `POST /storage/upload` - 上传文件
- `POST /storage/upload/batch` - 批量上传
- `POST /storage/upload/presigned` - 获取预签名URL

### 文件管理
- `GET /storage/files` - 获取文件列表
- `GET /storage/files/{id}` - 获取文件信息
- `DELETE /storage/files/{id}` - 删除文件
- `POST /storage/files/{id}/copy` - 复制文件

### 图片处理
- `POST /storage/images/resize` - 调整图片大小
- `POST /storage/images/optimize` - 优化图片
- `POST /storage/images/watermark` - 添加水印

### 数据结构
```typescript
interface StorageFile {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
  cdnUrl?: string
  metadata: {
    width?: number
    height?: number
    duration?: number
  }
  projectId?: string
  userId?: string
  deviceId?: string
  createdAt: string
}
```

## 6. 工具函数 API (`/functions/v1/utils`)

### 系统工具
- `GET /utils/health` - 健康检查
- `GET /utils/version` - 版本信息
- `POST /utils/feedback` - 用户反馈

### AI 工具
- `POST /utils/translate` - 文本翻译
- `POST /utils/enhance-prompt` - 优化提示词
- `POST /utils/detect-language` - 语言检测

## API 设计原则

### 1. RESTful 设计
- 使用标准 HTTP 方法 (GET, POST, PUT, DELETE)
- 资源导向的 URL 设计
- 统一的响应格式

### 2. 错误处理
```typescript
interface APIResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    pagination?: PaginationInfo
    timing?: number
  }
}
```

### 3. 认证授权
- 支持 JWT 令牌认证
- 支持设备 ID 匿名访问
- 基于角色的权限控制

### 4. 性能优化
- 请求缓存机制
- 分页查询支持
- 批量操作接口
- CDN 静态资源分发

### 5. 监控日志
- 请求响应时间监控
- 错误率统计
- 用户行为分析
- 资源使用情况追踪

## 部署策略

### 1. 分阶段部署
1. **Phase 1**: 项目管理 + 基础认证
2. **Phase 2**: 漫画生成核心功能
3. **Phase 3**: 作品分享社交功能
4. **Phase 4**: 高级功能和优化

### 2. 环境配置
- **开发环境**: 本地 Supabase + 测试数据
- **测试环境**: Staging 环境完整测试
- **生产环境**: 正式部署 + 监控告警

### 3. 数据库设计
- 项目表 (projects)
- 用户表 (users, profiles)
- 文件表 (storage_files)
- 分享表 (shared_works)
- 任务表 (generation_jobs)
- 统计表 (analytics)

这个架构设计为漫画生成平台提供了完整的后端 API 支持，具有良好的扩展性和维护性。
