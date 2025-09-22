# Story to Manga - 前端 API 接入文档

## 📋 概述

本文档为前端开发者提供完整的 API 接入指南，包括认证、端点使用、数据格式和错误处理。

> ⚠️ **安全提醒**：本文档中的 `YOUR_SUPABASE_ANON_KEY`、`YOUR_DEVICE_ID` 等为占位符，请替换为您的实际配置值。详细配置说明请参考 [API 配置指南](./API_CONFIGURATION_GUIDE.md)。

## 🔧 基础配置

### API 基础 URL
```
https://tairvnwvltidxcscsusl.supabase.co/functions/v1
```

### 必需的请求头
```javascript
const headers = {
  'Content-Type': 'application/json',
  'apikey': 'YOUR_SUPABASE_ANON_KEY',
  'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
  'x-device-id': 'your-unique-device-id' // 可选：用于匿名用户识别
}
```

## 🔐 认证方式

### 1. 匿名用户（推荐）
使用设备 ID 进行识别，无需注册：
```javascript
const headers = {
  'x-device-id': 'your-unique-device-id',
  'apikey': 'YOUR_SUPABASE_ANON_KEY'
}
```

### 2. 已登录用户
使用 JWT Token：
```javascript
const headers = {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'apikey': 'YOUR_SUPABASE_ANON_KEY'
}
```

## 📊 通用响应格式

所有 API 端点都返回统一的响应格式：

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

### 成功响应示例
```json
{
  "success": true,
  "data": {
    "id": "project-123",
    "name": "我的漫画项目"
  }
}
```

### 错误响应示例
```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "项目未找到",
    "details": {
      "projectId": "invalid-id"
    }
  }
}
```

## 🎯 核心 API 端点

### 1. 健康检查 API

#### GET /health
检查 API 服务状态

```javascript
const response = await fetch('https://tairvnwvltidxcscsusl.supabase.co/functions/v1/health', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
})

const result = await response.json()
// 返回: { success: true, data: { status: 'healthy', ... } }
```

### 2. 项目管理 API

#### GET /projects
获取项目列表

```javascript
const getProjects = async (params = {}) => {
  const {
    page = 1,
    limit = 20,
    search = '',
    tag = '',
    status = '',
    sortBy = 'updated_at',
    sortOrder = 'desc'
  } = params

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search }),
    ...(tag && { tag }),
    ...(status && { status }),
    sortBy,
    sortOrder
  })

  const response = await fetch(
    `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects?${queryParams}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
        'x-device-id': 'YOUR_DEVICE_ID'
      }
    }
  )

  return await response.json()
}

// 使用示例
const projects = await getProjects({ 
  page: 1, 
  limit: 10, 
  search: '武侠' 
})
```

#### POST /projects
创建新项目

```javascript
const createProject = async (projectData) => {
  const response = await fetch(
    'https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
        'x-device-id': 'YOUR_DEVICE_ID'
      },
      body: JSON.stringify({
        name: projectData.name,
        description: projectData.description,
        story: projectData.story,
        style: projectData.style,
        tags: projectData.tags || [],
        imageSize: projectData.imageSize || {
          width: 1024,
          height: 576,
          aspectRatio: '16:9'
        }
      })
    }
  )

  return await response.json()
}

// 使用示例
const newProject = await createProject({
  name: '武侠传奇',
  description: '一个关于江湖恩怨的故事',
  story: '在一个风雨交加的夜晚...',
  style: 'manga',
  tags: ['武侠', '冒险']
})
```

#### GET /projects/{id}
获取单个项目详情

```javascript
const getProject = async (projectId) => {
  const response = await fetch(
    `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects/${projectId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
        'x-device-id': 'YOUR_DEVICE_ID'
      }
    }
  )

  return await response.json()
}
```

#### DELETE /projects
删除项目

```javascript
const deleteProject = async (projectId) => {
  const response = await fetch(
    `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects?projectId=${projectId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
        'x-device-id': 'YOUR_DEVICE_ID'
      }
    }
  )

  return await response.json()
}
```

### 3. 项目数据存储 API

#### POST /project-storage-working
保存项目数据

```javascript
const saveProjectData = async (projectData) => {
  const response = await fetch(
    'https://tairvnwvltidxcscsusl.supabase.co/functions/v1/project-storage-working',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
        'x-device-id': 'YOUR_DEVICE_ID'
      },
      body: JSON.stringify({
        projectId: projectData.projectId,
        story: projectData.story,
        style: projectData.style,
        storyAnalysis: projectData.storyAnalysis,
        storyBreakdown: projectData.storyBreakdown,
        characterReferences: projectData.characterReferences,
        generatedPanels: projectData.generatedPanels,
        uploadedCharacterReferences: projectData.uploadedCharacterReferences,
        uploadedSettingReferences: projectData.uploadedSettingReferences,
        imageSize: projectData.imageSize,
        generationState: projectData.generationState,
        aiModel: projectData.aiModel,
        setting: projectData.setting,
        scenes: projectData.scenes
      })
    }
  )

  return await response.json()
}
```

#### GET /project-storage-working
加载项目数据

```javascript
const loadProjectData = async (projectId) => {
  const response = await fetch(
    `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/project-storage-working?projectId=${projectId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
        'x-device-id': 'YOUR_DEVICE_ID'
      }
    }
  )

  return await response.json()
}
```

### 4. 漫画生成 API

#### POST /manga-generation/analyze-story
分析故事结构

```javascript
const analyzeStory = async (storyData) => {
  const response = await fetch(
    'https://tairvnwvltidxcscsusl.supabase.co/functions/v1/manga-generation/analyze-story',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
        'x-device-id': 'YOUR_DEVICE_ID'
      },
      body: JSON.stringify({
        projectId: storyData.projectId,
        story: storyData.story,
        style: storyData.style,
        language: storyData.language || 'zh'
      })
    }
  )

  return await response.json()
}
```

#### POST /manga-generation/generate-character
生成角色图像

```javascript
const generateCharacter = async (characterData) => {
  const response = await fetch(
    'https://tairvnwvltidxcscsusl.supabase.co/functions/v1/manga-generation/generate-character',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
        'x-device-id': 'YOUR_DEVICE_ID'
      },
      body: JSON.stringify({
        projectId: characterData.projectId,
        characterName: characterData.characterName,
        description: characterData.description,
        style: characterData.style,
        referenceImages: characterData.referenceImages || []
      })
    }
  )

  return await response.json()
}
```

#### GET /manga-generation/jobs/{jobId}
查询生成任务状态

```javascript
const getJobStatus = async (jobId) => {
  const response = await fetch(
    `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/manga-generation/jobs/${jobId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
        'x-device-id': 'YOUR_DEVICE_ID'
      }
    }
  )

  return await response.json()
}
```

### 5. 作品分享 API

#### POST /sharing/publish
发布作品

```javascript
const publishWork = async (publishData) => {
  const response = await fetch(
    'https://tairvnwvltidxcscsusl.supabase.co/functions/v1/sharing/publish',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY',
        'x-device-id': 'YOUR_DEVICE_ID'
      },
      body: JSON.stringify({
        projectId: publishData.projectId,
        title: publishData.title,
        description: publishData.description,
        tags: publishData.tags,
        visibility: publishData.visibility || 'public'
      })
    }
  )

  return await response.json()
}
```

#### GET /sharing/gallery
获取公开画廊

```javascript
const getGallery = async (params = {}) => {
  const {
    page = 1,
    limit = 20,
    sort = 'latest',
    tag = ''
  } = params

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sort,
    ...(tag && { tag })
  })

  const response = await fetch(
    `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/sharing/gallery?${queryParams}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY'
      }
    }
  )

  return await response.json()
}
```

#### GET /sharing/public/{shareId}
获取分享的作品

```javascript
const getSharedWork = async (shareId) => {
  const response = await fetch(
    `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/sharing/public/${shareId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'YOUR_SUPABASE_ANON_KEY'
      }
    }
  )

  return await response.json()
}
```

## 🛠️ 实用工具类

### API 客户端封装

```javascript
class StoryToMangaAPI {
  constructor(config = {}) {
    this.baseURL = 'https://tairvnwvltidxcscsusl.supabase.co/functions/v1'
    this.apiKey = config.apiKey || 'YOUR_SUPABASE_ANON_KEY'
    this.deviceId = config.deviceId || this.generateDeviceId()
    this.authToken = config.authToken || null
  }

  generateDeviceId() {
    return 'device-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now()
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
      'x-device-id': this.deviceId
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    return headers
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: this.getHeaders(),
      ...options
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`)
      }

      return data
    } catch (error) {
      console.error('API Request failed:', error)
      throw error
    }
  }

  // 项目管理
  async getProjects(params = {}) {
    const queryParams = new URLSearchParams(params).toString()
    return this.request(`/projects${queryParams ? '?' + queryParams : ''}`)
  }

  async createProject(projectData) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    })
  }

  async getProject(projectId) {
    return this.request(`/projects/${projectId}`)
  }

  async deleteProject(projectId) {
    return this.request(`/projects?projectId=${projectId}`, {
      method: 'DELETE'
    })
  }

  // 项目数据存储
  async saveProjectData(projectData) {
    return this.request('/project-storage-working', {
      method: 'POST',
      body: JSON.stringify(projectData)
    })
  }

  async loadProjectData(projectId) {
    return this.request(`/project-storage-working?projectId=${projectId}`)
  }

  // 漫画生成
  async analyzeStory(storyData) {
    return this.request('/manga-generation/analyze-story', {
      method: 'POST',
      body: JSON.stringify(storyData)
    })
  }

  async generateCharacter(characterData) {
    return this.request('/manga-generation/generate-character', {
      method: 'POST',
      body: JSON.stringify(characterData)
    })
  }

  async getJobStatus(jobId) {
    return this.request(`/manga-generation/jobs/${jobId}`)
  }

  // 作品分享
  async publishWork(publishData) {
    return this.request('/sharing/publish', {
      method: 'POST',
      body: JSON.stringify(publishData)
    })
  }

  async getGallery(params = {}) {
    const queryParams = new URLSearchParams(params).toString()
    return this.request(`/sharing/gallery${queryParams ? '?' + queryParams : ''}`)
  }

  async getSharedWork(shareId) {
    return this.request(`/sharing/public/${shareId}`)
  }

  // 健康检查
  async healthCheck() {
    return this.request('/health')
  }
}

// 使用示例
const api = new StoryToMangaAPI({
  deviceId: 'my-unique-device-id'
})

// 获取项目列表
const projects = await api.getProjects({ page: 1, limit: 10 })

// 创建新项目
const newProject = await api.createProject({
  name: '我的漫画',
  story: '故事内容...',
  style: 'manga'
})
```

## 📱 React Hook 示例

```javascript
import { useState, useEffect, useCallback } from 'react'

// 自定义 Hook 用于项目管理
export const useProjects = (api) => {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchProjects = useCallback(async (params = {}) => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.getProjects(params)
      if (response.success) {
        setProjects(response.projects || [])
      } else {
        setError(response.error?.message || '获取项目失败')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [api])

  const createProject = useCallback(async (projectData) => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.createProject(projectData)
      if (response.success) {
        await fetchProjects() // 刷新列表
        return response.project
      } else {
        setError(response.error?.message || '创建项目失败')
        return null
      }
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [api, fetchProjects])

  const deleteProject = useCallback(async (projectId) => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.deleteProject(projectId)
      if (response.success) {
        await fetchProjects() // 刷新列表
        return true
      } else {
        setError(response.error?.message || '删除项目失败')
        return false
      }
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }, [api, fetchProjects])

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    deleteProject
  }
}

// 自定义 Hook 用于项目数据管理
export const useProjectData = (api, projectId) => {
  const [projectData, setProjectData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    if (!projectId) return

    setLoading(true)
    setError(null)

    try {
      const response = await api.loadProjectData(projectId)
      if (response.success) {
        setProjectData(response.data)
      } else {
        setError(response.error?.message || '加载项目数据失败')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [api, projectId])

  const saveData = useCallback(async (data) => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.saveProjectData({
        projectId,
        ...data
      })

      if (response.success) {
        setProjectData(prev => ({ ...prev, ...data }))
        return true
      } else {
        setError(response.error?.message || '保存项目数据失败')
        return false
      }
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }, [api, projectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  return {
    projectData,
    loading,
    error,
    loadData,
    saveData
  }
}

// 使用示例
function ProjectList() {
  const api = new StoryToMangaAPI()
  const { projects, loading, error, fetchProjects, createProject } = useProjects(api)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreateProject = async () => {
    const newProject = await createProject({
      name: '新项目',
      story: '故事内容...',
      style: 'manga'
    })

    if (newProject) {
      console.log('项目创建成功:', newProject)
    }
  }

  if (loading) return <div>加载中...</div>
  if (error) return <div>错误: {error}</div>

  return (
    <div>
      <button onClick={handleCreateProject}>创建新项目</button>
      {projects.map(project => (
        <div key={project.id}>
          <h3>{project.name}</h3>
          <p>{project.description}</p>
        </div>
      ))}
    </div>
  )
}
```

## ⚠️ 错误处理

### 常见错误码

| 错误码 | 描述 | 解决方案 |
|--------|------|----------|
| `UNAUTHORIZED` | 未授权访问 | 检查 API Key 和认证头 |
| `PROJECT_NOT_FOUND` | 项目不存在 | 验证项目 ID 是否正确 |
| `INVALID_REQUEST` | 请求参数无效 | 检查请求体格式和必需字段 |
| `RATE_LIMIT_EXCEEDED` | 请求频率超限 | 减少请求频率或等待 |
| `STORAGE_ERROR` | 存储服务错误 | 重试请求或联系支持 |
| `AI_SERVICE_ERROR` | AI 服务错误 | 检查 AI 服务状态或重试 |

### 错误处理最佳实践

```javascript
const handleAPIError = (error, context = '') => {
  console.error(`API Error ${context}:`, error)

  // 根据错误类型提供用户友好的消息
  const errorMessages = {
    'UNAUTHORIZED': '请检查登录状态',
    'PROJECT_NOT_FOUND': '项目不存在或已被删除',
    'INVALID_REQUEST': '请求参数有误，请检查输入',
    'RATE_LIMIT_EXCEEDED': '请求过于频繁，请稍后再试',
    'STORAGE_ERROR': '存储服务暂时不可用，请稍后重试',
    'AI_SERVICE_ERROR': 'AI 服务暂时不可用，请稍后重试'
  }

  const userMessage = errorMessages[error.code] || error.message || '未知错误'

  // 显示用户友好的错误消息
  showNotification(userMessage, 'error')

  // 记录详细错误信息用于调试
  if (process.env.NODE_ENV === 'development') {
    console.table(error.details)
  }
}

// 带重试机制的请求
const requestWithRetry = async (requestFn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn()
    } catch (error) {
      if (i === maxRetries - 1) throw error

      // 对于某些错误类型不进行重试
      if (['UNAUTHORIZED', 'INVALID_REQUEST'].includes(error.code)) {
        throw error
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
    }
  }
}
```

## 🔄 轮询和实时更新

### 生成任务状态轮询

```javascript
const pollJobStatus = async (api, jobId, onUpdate, maxAttempts = 60) => {
  let attempts = 0

  const poll = async () => {
    try {
      const response = await api.getJobStatus(jobId)

      if (response.success) {
        const job = response.job
        onUpdate(job)

        // 如果任务完成或失败，停止轮询
        if (['completed', 'failed'].includes(job.status)) {
          return job
        }

        // 如果达到最大尝试次数，停止轮询
        if (attempts >= maxAttempts) {
          throw new Error('轮询超时')
        }

        attempts++

        // 等待 2 秒后继续轮询
        setTimeout(poll, 2000)
      } else {
        throw new Error(response.error?.message || '获取任务状态失败')
      }
    } catch (error) {
      console.error('轮询错误:', error)
      onUpdate({ status: 'error', error: error.message })
    }
  }

  poll()
}

// 使用示例
const handleGenerateCharacter = async (characterData) => {
  try {
    // 开始生成任务
    const response = await api.generateCharacter(characterData)

    if (response.success) {
      const jobId = response.job.id

      // 开始轮询任务状态
      pollJobStatus(api, jobId, (job) => {
        console.log('任务状态更新:', job)

        if (job.status === 'completed') {
          console.log('角色生成完成:', job.result)
        } else if (job.status === 'failed') {
          console.error('角色生成失败:', job.error)
        }
      })
    }
  } catch (error) {
    handleAPIError(error, '生成角色')
  }
}
```

## 📋 数据类型定义

### TypeScript 接口定义

```typescript
// 项目相关类型
interface Project {
  id: string
  name: string
  description?: string
  story: string
  style: ComicStyle
  status: 'draft' | 'generating' | 'completed' | 'published'
  visibility: 'private' | 'public' | 'shared'
  tags: string[]
  createdAt: number
  updatedAt: number
  panelCount: number
  characterCount: number
  imageSize: ImageSizeConfig
  metadata?: any
}

interface ImageSizeConfig {
  width: number
  height: number
  aspectRatio: string
}

interface ComicStyle {
  name: string
  description?: string
  parameters?: any
}

// 项目数据类型
interface ProjectData {
  projectId: string
  story: string
  style: string
  storyAnalysis?: StoryAnalysis
  storyBreakdown?: StoryBreakdown
  characterReferences?: CharacterReference[]
  generatedPanels?: GeneratedPanel[]
  uploadedCharacterReferences?: UploadedReference[]
  uploadedSettingReferences?: UploadedReference[]
  imageSize?: ImageSizeConfig
  generationState?: GenerationState
  aiModel?: string
  setting?: any
  scenes?: Scene[]
}

interface StoryAnalysis {
  summary: string
  themes: string[]
  characters: CharacterInfo[]
  settings: SettingInfo[]
  plotPoints: PlotPoint[]
}

interface CharacterReference {
  id: string
  name: string
  description: string
  appearance: string
  personality: string
  imageUrl?: string
}

interface GeneratedPanel {
  id: string
  sceneIndex: number
  prompt: string
  imageUrl: string
  characters: string[]
  setting: string
  dialogue?: string
}

// 生成任务类型
interface GenerationJob {
  id: string
  projectId: string
  type: 'story_analysis' | 'character_generation' | 'panel_generation' | 'batch_generation'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: any
  error?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// 分享相关类型
interface SharedWork {
  id: string
  projectId: string
  title: string
  description: string
  thumbnailUrl: string
  shareUrl: string
  visibility: 'public' | 'unlisted'
  tags: string[]
  stats: WorkStats
  publishedAt: string
}

interface WorkStats {
  views: number
  likes: number
  comments: number
  shares: number
}

// API 响应类型
interface APIResponse<T> {
  success: boolean
  data?: T
  error?: APIError
  meta?: ResponseMeta
}

interface APIError {
  code: string
  message: string
  details?: any
}

interface ResponseMeta {
  pagination?: PaginationInfo
  timing?: number
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}
```

## 🎯 最佳实践

### 1. 设备 ID 管理

```javascript
// 生成和存储设备 ID
const getOrCreateDeviceId = () => {
  let deviceId = localStorage.getItem('story-to-manga-device-id')

  if (!deviceId) {
    deviceId = 'device-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now()
    localStorage.setItem('story-to-manga-device-id', deviceId)
  }

  return deviceId
}

// 在应用初始化时设置
const deviceId = getOrCreateDeviceId()
const api = new StoryToMangaAPI({ deviceId })
```

### 2. 请求缓存

```javascript
class CachedAPI extends StoryToMangaAPI {
  constructor(config = {}) {
    super(config)
    this.cache = new Map()
    this.cacheTimeout = config.cacheTimeout || 5 * 60 * 1000 // 5分钟
  }

  getCacheKey(endpoint, options = {}) {
    return `${endpoint}-${JSON.stringify(options)}`
  }

  async request(endpoint, options = {}) {
    // 只缓存 GET 请求
    if (!options.method || options.method === 'GET') {
      const cacheKey = this.getCacheKey(endpoint, options)
      const cached = this.cache.get(cacheKey)

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data
      }
    }

    const response = await super.request(endpoint, options)

    // 缓存成功的 GET 请求
    if (response.success && (!options.method || options.method === 'GET')) {
      const cacheKey = this.getCacheKey(endpoint, options)
      this.cache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      })
    }

    return response
  }

  clearCache() {
    this.cache.clear()
  }
}
```

### 3. 批量操作

```javascript
// 批量删除项目
const batchDeleteProjects = async (api, projectIds) => {
  const results = []

  // 限制并发数量
  const batchSize = 3

  for (let i = 0; i < projectIds.length; i += batchSize) {
    const batch = projectIds.slice(i, i + batchSize)

    const batchPromises = batch.map(async (projectId) => {
      try {
        const result = await api.deleteProject(projectId)
        return { projectId, success: true, result }
      } catch (error) {
        return { projectId, success: false, error: error.message }
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
  }

  return results
}
```

### 4. 离线支持

```javascript
class OfflineAPI extends StoryToMangaAPI {
  constructor(config = {}) {
    super(config)
    this.offlineQueue = []
    this.isOnline = navigator.onLine

    // 监听网络状态
    window.addEventListener('online', () => {
      this.isOnline = true
      this.processOfflineQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  async request(endpoint, options = {}) {
    if (!this.isOnline && options.method !== 'GET') {
      // 将写操作加入离线队列
      return new Promise((resolve, reject) => {
        this.offlineQueue.push({
          endpoint,
          options,
          resolve,
          reject,
          timestamp: Date.now()
        })
      })
    }

    return super.request(endpoint, options)
  }

  async processOfflineQueue() {
    while (this.offlineQueue.length > 0 && this.isOnline) {
      const { endpoint, options, resolve, reject } = this.offlineQueue.shift()

      try {
        const result = await super.request(endpoint, options)
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }
  }
}
```

## 🧪 测试示例

### 单元测试

```javascript
// 使用 Jest 进行测试
describe('StoryToMangaAPI', () => {
  let api

  beforeEach(() => {
    api = new StoryToMangaAPI({
      deviceId: 'test-device-id'
    })
  })

  test('should create project successfully', async () => {
    const projectData = {
      name: '测试项目',
      story: '测试故事',
      style: 'manga'
    }

    const response = await api.createProject(projectData)

    expect(response.success).toBe(true)
    expect(response.project).toBeDefined()
    expect(response.project.name).toBe(projectData.name)
  })

  test('should handle API errors gracefully', async () => {
    // 模拟网络错误
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    await expect(api.getProjects()).rejects.toThrow('Network error')
  })
})
```

### 集成测试

```javascript
// 端到端测试流程
const testCompleteWorkflow = async () => {
  const api = new StoryToMangaAPI()

  try {
    // 1. 创建项目
    console.log('创建项目...')
    const project = await api.createProject({
      name: '集成测试项目',
      story: '这是一个测试故事',
      style: 'manga'
    })

    console.log('项目创建成功:', project.project.id)

    // 2. 保存项目数据
    console.log('保存项目数据...')
    await api.saveProjectData({
      projectId: project.project.id,
      story: '更新的故事内容',
      style: 'manga',
      characterReferences: []
    })

    // 3. 加载项目数据
    console.log('加载项目数据...')
    const projectData = await api.loadProjectData(project.project.id)
    console.log('项目数据加载成功')

    // 4. 发布作品
    console.log('发布作品...')
    const sharedWork = await api.publishWork({
      projectId: project.project.id,
      title: '测试作品',
      description: '这是一个测试作品',
      tags: ['测试'],
      visibility: 'public'
    })

    console.log('作品发布成功:', sharedWork.sharedWork.shareUrl)

    // 5. 清理
    console.log('清理测试数据...')
    await api.deleteProject(project.project.id)

    console.log('✅ 集成测试完成')

  } catch (error) {
    console.error('❌ 集成测试失败:', error)
  }
}
```

## 📚 参考资源

### 相关文档
- [API 架构设计](./API_ARCHITECTURE.md)
- [API 端点详细规划](./API_ENDPOINTS.md)
- [Edge Functions 快速参考](./EDGE_FUNCTIONS_QUICK_REFERENCE.md)
- [Health Function 设置](./HEALTH_FUNCTION_SETUP.md)

### 在线测试工具
- **健康检查**: `https://tairvnwvltidxcscsusl.supabase.co/functions/v1/health`
- **Supabase Dashboard**: `https://supabase.com/dashboard`
- **API 测试页面**: 访问应用的 `/system-diagnosis` 页面

### 支持联系
- **技术文档**: 查看项目根目录的 Markdown 文件
- **问题反馈**: 通过应用内反馈功能提交
- **开发调试**: 使用浏览器开发者工具查看网络请求

---

*本文档持续更新中，如有疑问请参考相关技术文档或联系开发团队。*
