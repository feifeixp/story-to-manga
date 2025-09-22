# Edge Functions API 端点详细规划

## 1. 项目管理 API (`/functions/v1/projects`)

| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| GET | `/projects` | 获取项目列表 | `?page=1&limit=20&search=&tag=` | `ProjectListResponse` |
| POST | `/projects` | 创建新项目 | `CreateProjectRequest` | `ProjectResponse` |
| GET | `/projects/{id}` | 获取项目详情 | `id: string` | `ProjectDetailResponse` |
| PUT | `/projects/{id}` | 更新项目 | `id: string, UpdateProjectRequest` | `ProjectResponse` |
| DELETE | `/projects/{id}` | 删除项目 | `id: string` | `SuccessResponse` |
| POST | `/projects/{id}/duplicate` | 复制项目 | `id: string, name?: string` | `ProjectResponse` |
| GET | `/projects/recent` | 最近项目 | `?limit=10` | `ProjectListResponse` |

## 2. 漫画生成 API (`/functions/v1/manga-generation`)

### 故事处理
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/analyze-story` | 分析故事结构 | `AnalyzeStoryRequest` | `StoryAnalysisResponse` |
| POST | `/breakdown-story` | 分解故事场景 | `BreakdownStoryRequest` | `StoryBreakdownResponse` |
| POST | `/extract-characters` | 提取角色信息 | `ExtractCharactersRequest` | `CharactersResponse` |

### 角色生成
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/generate-character` | 生成单个角色 | `GenerateCharacterRequest` | `CharacterResponse` |
| POST | `/generate-characters` | 批量生成角色 | `GenerateCharactersRequest` | `GenerationJobResponse` |
| POST | `/refine-character` | 优化角色设计 | `RefineCharacterRequest` | `CharacterResponse` |

### 面板生成
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/generate-panel` | 生成单个面板 | `GeneratePanelRequest` | `PanelResponse` |
| POST | `/generate-panels` | 批量生成面板 | `GeneratePanelsRequest` | `GenerationJobResponse` |
| POST | `/regenerate-panel` | 重新生成面板 | `RegeneratePanelRequest` | `PanelResponse` |

### 批量操作
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/generate-all` | 一键生成整个漫画 | `GenerateAllRequest` | `GenerationJobResponse` |
| GET | `/jobs/{jobId}` | 查询生成状态 | `jobId: string` | `GenerationJobResponse` |
| POST | `/jobs/{jobId}/cancel` | 取消生成任务 | `jobId: string` | `SuccessResponse` |

## 3. 作品分享 API (`/functions/v1/sharing`)

### 分享功能
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/publish` | 发布作品 | `PublishWorkRequest` | `SharedWorkResponse` |
| POST | `/create-link` | 创建分享链接 | `CreateLinkRequest` | `ShareLinkResponse` |
| GET | `/public/{shareId}` | 获取公开作品 | `shareId: string` | `PublicWorkResponse` |
| POST | `/unpublish` | 取消发布 | `UnpublishRequest` | `SuccessResponse` |

### 社交功能
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| GET | `/gallery` | 公开画廊 | `?page=1&limit=20&sort=latest` | `GalleryResponse` |
| POST | `/like` | 点赞作品 | `LikeRequest` | `SuccessResponse` |
| POST | `/comment` | 评论作品 | `CommentRequest` | `CommentResponse` |
| GET | `/trending` | 热门作品 | `?period=week&limit=20` | `TrendingResponse` |

### 统计分析
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| GET | `/stats/{projectId}` | 作品统计 | `projectId: string` | `WorkStatsResponse` |
| GET | `/analytics` | 用户分析数据 | `?period=month` | `AnalyticsResponse` |

## 4. 用户认证 API (`/functions/v1/auth`)

### 认证管理
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/login` | 用户登录 | `LoginRequest` | `AuthResponse` |
| POST | `/register` | 用户注册 | `RegisterRequest` | `AuthResponse` |
| POST | `/logout` | 用户登出 | - | `SuccessResponse` |
| POST | `/refresh` | 刷新令牌 | `RefreshRequest` | `AuthResponse` |

### 设备管理
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/device/register` | 注册设备 | `DeviceRegisterRequest` | `DeviceResponse` |
| GET | `/device/info` | 获取设备信息 | - | `DeviceInfoResponse` |
| POST | `/device/sync` | 同步设备数据 | `DeviceSyncRequest` | `SyncResponse` |

### 用户资料
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| GET | `/profile` | 获取用户资料 | - | `ProfileResponse` |
| PUT | `/profile` | 更新用户资料 | `UpdateProfileRequest` | `ProfileResponse` |
| POST | `/avatar` | 上传头像 | `FormData` | `AvatarResponse` |

## 5. 文件存储 API (`/functions/v1/storage`)

### 文件上传
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/upload` | 上传文件 | `FormData` | `FileUploadResponse` |
| POST | `/upload/batch` | 批量上传 | `FormData[]` | `BatchUploadResponse` |
| POST | `/upload/presigned` | 获取预签名URL | `PresignedRequest` | `PresignedResponse` |

### 文件管理
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| GET | `/files` | 获取文件列表 | `?projectId=&type=&page=1` | `FileListResponse` |
| GET | `/files/{id}` | 获取文件信息 | `id: string` | `FileInfoResponse` |
| DELETE | `/files/{id}` | 删除文件 | `id: string` | `SuccessResponse` |
| POST | `/files/{id}/copy` | 复制文件 | `id: string, CopyFileRequest` | `FileInfoResponse` |

### 图片处理
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/images/resize` | 调整图片大小 | `ResizeImageRequest` | `ImageResponse` |
| POST | `/images/optimize` | 优化图片 | `OptimizeImageRequest` | `ImageResponse` |
| POST | `/images/watermark` | 添加水印 | `WatermarkRequest` | `ImageResponse` |

## 6. 工具函数 API (`/functions/v1/utils`)

### 系统工具
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| GET | `/health` | 健康检查 | - | `HealthResponse` |
| GET | `/version` | 版本信息 | - | `VersionResponse` |
| POST | `/feedback` | 用户反馈 | `FeedbackRequest` | `SuccessResponse` |

### AI 工具
| 方法 | 端点 | 描述 | 参数 | 响应 |
|------|------|------|------|------|
| POST | `/translate` | 文本翻译 | `TranslateRequest` | `TranslateResponse` |
| POST | `/enhance-prompt` | 优化提示词 | `EnhancePromptRequest` | `EnhancePromptResponse` |
| POST | `/detect-language` | 语言检测 | `DetectLanguageRequest` | `LanguageResponse` |

## 请求/响应数据结构示例

### 通用响应格式
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
    pagination?: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    timing?: number
  }
}
```

### 项目相关
```typescript
interface CreateProjectRequest {
  name: string
  description?: string
  story: string
  style: ComicStyle
  tags?: string[]
  settings?: ProjectSettings
}

interface ProjectResponse {
  project: Project
}
```

### 生成相关
```typescript
interface GeneratePanelRequest {
  projectId: string
  sceneIndex: number
  prompt: string
  style: ComicStyle
  characters: CharacterReference[]
  settings?: GenerationSettings
}

interface GenerationJobResponse {
  job: GenerationJob
}
```

### 分享相关
```typescript
interface PublishWorkRequest {
  projectId: string
  title: string
  description: string
  tags: string[]
  visibility: 'public' | 'unlisted'
}

interface SharedWorkResponse {
  sharedWork: SharedWork
}
```

## 认证和权限

### 认证方式
1. **JWT Token**: 已登录用户
2. **Device ID**: 匿名用户
3. **API Key**: 第三方集成

### 权限级别
1. **Public**: 无需认证
2. **User**: 需要用户认证
3. **Owner**: 需要资源所有者权限
4. **Admin**: 需要管理员权限

### 请求头示例
```http
Authorization: Bearer <jwt_token>
X-Device-ID: <device_id>
X-API-Key: <api_key>
Content-Type: application/json
```

这个详细的 API 端点规划为整个漫画生成平台提供了完整的后端接口设计。
