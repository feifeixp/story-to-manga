# 云存储架构设计文档

## 🎯 目标
将用户生成的数据从本地存储迁移到Cloudflare R2对象存储，实现跨设备同步、数据持久化和用户间共享。

## 🏗️ 存储架构

### 1. 文件组织结构
```
mangashare/
├── users/
│   └── {userId}/
│       ├── projects/
│       │   └── {projectId}/
│       │       ├── metadata.json          # 项目元数据
│       │       ├── story.json             # 故事内容和分析
│       │       ├── characters/            # 角色相关
│       │       │   ├── generated/         # AI生成的角色图
│       │       │   │   └── {characterName}.jpg
│       │       │   └── uploaded/          # 用户上传的参考图
│       │       │       └── {refId}.jpg
│       │       ├── settings/              # 场景设置
│       │       │   └── uploaded/
│       │       │       └── {refId}.jpg
│       │       └── panels/                # 漫画面板
│       │           └── {panelNumber}.jpg
│       └── profile/
│           ├── avatar.jpg                 # 用户头像
│           └── preferences.json           # 用户偏好设置
└── public/                                # 公开分享的内容
    └── comics/
        └── {comicId}/
            ├── metadata.json              # 公开漫画元数据
            ├── cover.jpg                  # 封面图
            └── panels/                    # 面板图片
                └── {panelNumber}.jpg
```

### 2. 数据类型定义

#### 项目元数据 (metadata.json)
```typescript
interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  style: ComicStyle;
  imageSize: ImageSizeConfig;
  createdAt: number;
  updatedAt: number;
  panelCount: number;
  characterCount: number;
  thumbnail?: string;  // R2 URL
  isPublic: boolean;
  tags: string[];
}
```

#### 故事数据 (story.json)
```typescript
interface StoryData {
  version: string;
  story: string;
  storyAnalysis: StoryAnalysis | null;
  storyBreakdown: StoryBreakdown | null;
  characterReferences: CharacterReference[];
  generatedPanels: GeneratedPanel[];
  uploadedCharacterReferences: UploadedCharacterReference[];
  uploadedSettingReferences: UploadedSettingReference[];
  generationState?: GenerationState;
  setting?: any;
  scenes?: any[];
  timestamp: number;
}
```

### 3. 访问权限策略

#### 私有数据 (users/{userId}/)
- 只有认证用户可以访问自己的数据
- 使用JWT token验证用户身份
- 服务端API验证用户权限

#### 公开数据 (public/comics/)
- 任何人都可以访问
- 用于漫画分享功能
- 通过公开链接访问

### 4. 文件命名规范

#### 图片文件
- 格式: `{type}_{id}_{timestamp}.{ext}`
- 示例: `panel_1_1642123456789.jpg`
- 支持格式: jpg, png, webp

#### JSON文件
- 使用语义化名称: `metadata.json`, `story.json`
- 包含版本信息用于数据迁移

### 5. 缓存策略

#### CDN缓存
- 公开内容: 24小时缓存
- 私有内容: 1小时缓存
- 图片资源: 7天缓存

#### 本地缓存
- 最近访问的项目数据缓存到localStorage
- 图片缓存到IndexedDB作为离线支持
- 缓存过期时间: 1小时

## 🔧 技术实现

### 1. R2客户端配置
```typescript
interface R2Config {
  endpoint: string;           // https://fac7207421271dd5183fcab70164cad1.r2.cloudflarestorage.com
  bucket: string;            // mangashare
  accessKeyId: string;       // 从环境变量获取
  secretAccessKey: string;   // 从环境变量获取
  region: string;            // auto
}
```

### 2. API端点设计
```
POST /api/storage/upload          # 上传文件
GET  /api/storage/download        # 下载文件
DELETE /api/storage/delete        # 删除文件
POST /api/storage/project/save    # 保存项目数据
GET  /api/storage/project/load    # 加载项目数据
POST /api/storage/project/sync    # 同步项目数据
```

### 3. 数据同步策略

#### 上传策略
- 增量上传: 只上传变更的文件
- 压缩上传: 图片自动压缩优化
- 重试机制: 网络失败时自动重试

#### 下载策略
- 懒加载: 按需下载图片资源
- 预加载: 预加载下一个面板图片
- 离线缓存: 缓存最近使用的数据

## 🔒 安全考虑

### 1. 认证授权
- 使用Supabase Auth进行用户认证
- JWT token验证API访问权限
- 用户数据隔离

### 2. 文件安全
- 文件类型验证
- 文件大小限制
- 恶意文件检测

### 3. 访问控制
- 私有文件需要认证
- 公开文件通过CDN访问
- 防盗链保护

## 📊 性能优化

### 1. 上传优化
- 多文件并行上传
- 图片压缩和格式转换
- 上传进度显示

### 2. 下载优化
- CDN加速
- 图片懒加载
- 缓存策略

### 3. 存储优化
- 重复文件去重
- 定期清理过期数据
- 存储成本监控

## 🔄 迁移策略

### 1. 数据迁移
- 检测本地数据
- 批量上传到云端
- 验证数据完整性

### 2. 兼容性
- 保持现有API接口
- 渐进式迁移
- 回退机制

### 3. 用户体验
- 迁移进度显示
- 错误处理和重试
- 数据备份提醒
