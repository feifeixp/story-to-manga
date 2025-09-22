# Story to Manga API - 快速入门指南

> ⚠️ **安全提醒**：本文档中的 `YOUR_SUPABASE_ANON_KEY`、`YOUR_DEVICE_ID` 等为占位符，请替换为您的实际配置值。详细配置说明请参考 [API 配置指南](./API_CONFIGURATION_GUIDE.md)。

## 🚀 5分钟快速开始

### 1. 基础配置

```javascript
// 配置 API 客户端
const API_BASE_URL = 'https://tairvnwvltidxcscsusl.supabase.co/functions/v1'
const API_KEY = 'YOUR_SUPABASE_ANON_KEY'

// 生成设备 ID（用于匿名用户）
const DEVICE_ID = 'device-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now()

// 通用请求头
const headers = {
  'Content-Type': 'application/json',
  'apikey': API_KEY,
  'Authorization': `Bearer ${API_KEY}`,
  'x-device-id': DEVICE_ID
}
```

### 2. 基础 API 调用

```javascript
// 健康检查
const healthCheck = async () => {
  const response = await fetch(`${API_BASE_URL}/health`, { headers })
  return await response.json()
}

// 获取项目列表
const getProjects = async () => {
  const response = await fetch(`${API_BASE_URL}/projects`, { headers })
  return await response.json()
}

// 创建新项目
const createProject = async (projectData) => {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify(projectData)
  })
  return await response.json()
}
```

### 3. 完整示例

```javascript
// 完整的项目创建和管理示例
const example = async () => {
  try {
    // 1. 检查 API 状态
    console.log('🔍 检查 API 状态...')
    const health = await healthCheck()
    console.log('✅ API 状态:', health.data.status)

    // 2. 获取现有项目
    console.log('📋 获取项目列表...')
    const projects = await getProjects()
    console.log(`📊 找到 ${projects.projects?.length || 0} 个项目`)

    // 3. 创建新项目
    console.log('🆕 创建新项目...')
    const newProject = await createProject({
      name: '我的第一个漫画项目',
      description: '这是一个测试项目',
      story: '在一个风雨交加的夜晚，年轻的剑客踏上了复仇之路...',
      style: 'manga',
      tags: ['武侠', '冒险'],
      imageSize: {
        width: 1024,
        height: 576,
        aspectRatio: '16:9'
      }
    })

    if (newProject.success) {
      console.log('✅ 项目创建成功:', newProject.project.id)
      
      // 4. 保存项目数据
      console.log('💾 保存项目数据...')
      const saveResponse = await fetch(`${API_BASE_URL}/project-storage-working`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: newProject.project.id,
          story: newProject.project.story,
          style: 'manga',
          storyAnalysis: null,
          characterReferences: [],
          generatedPanels: [],
          imageSize: newProject.project.imageSize
        })
      })
      
      const saveResult = await saveResponse.json()
      if (saveResult.success) {
        console.log('✅ 项目数据保存成功')
      }
    }

  } catch (error) {
    console.error('❌ 操作失败:', error)
  }
}

// 运行示例
example()
```

## 📱 React 组件示例

```jsx
import React, { useState, useEffect } from 'react'

const ProjectManager = () => {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // API 配置
  const API_BASE_URL = 'https://tairvnwvltidxcscsusl.supabase.co/functions/v1'
  const headers = {
    'Content-Type': 'application/json',
    'apikey': 'YOUR_SUPABASE_ANON_KEY',
    'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
    'x-device-id': 'YOUR_DEVICE_ID'
  }

  // 获取项目列表
  const fetchProjects = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE_URL}/projects`, { headers })
      const result = await response.json()
      
      if (result.success) {
        setProjects(result.projects || [])
      } else {
        setError(result.error?.message || '获取项目失败')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 创建新项目
  const createProject = async () => {
    const projectData = {
      name: `新项目 ${Date.now()}`,
      description: '通过 API 创建的项目',
      story: '这是一个通过 API 创建的测试故事...',
      style: 'manga',
      tags: ['测试']
    }

    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify(projectData)
      })
      
      const result = await response.json()
      
      if (result.success) {
        await fetchProjects() // 刷新列表
        alert('项目创建成功！')
      } else {
        alert('创建失败: ' + result.error?.message)
      }
    } catch (err) {
      alert('创建失败: ' + err.message)
    }
  }

  // 删除项目
  const deleteProject = async (projectId) => {
    if (!confirm('确定要删除这个项目吗？')) return

    try {
      const response = await fetch(`${API_BASE_URL}/projects?projectId=${projectId}`, {
        method: 'DELETE',
        headers
      })
      
      const result = await response.json()
      
      if (result.success) {
        await fetchProjects() // 刷新列表
        alert('项目删除成功！')
      } else {
        alert('删除失败: ' + result.error?.message)
      }
    } catch (err) {
      alert('删除失败: ' + err.message)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  if (loading) return <div>加载中...</div>
  if (error) return <div>错误: {error}</div>

  return (
    <div style={{ padding: '20px' }}>
      <h1>项目管理</h1>
      
      <button onClick={createProject} style={{ marginBottom: '20px' }}>
        创建新项目
      </button>
      
      <button onClick={fetchProjects} style={{ marginBottom: '20px', marginLeft: '10px' }}>
        刷新列表
      </button>

      <div>
        <h2>项目列表 ({projects.length})</h2>
        {projects.length === 0 ? (
          <p>暂无项目</p>
        ) : (
          projects.map(project => (
            <div key={project.id} style={{ 
              border: '1px solid #ccc', 
              padding: '10px', 
              margin: '10px 0',
              borderRadius: '5px'
            }}>
              <h3>{project.name}</h3>
              <p>{project.description}</p>
              <p>状态: {project.status}</p>
              <p>面板数: {project.panelCount}</p>
              <p>创建时间: {new Date(project.createdAt).toLocaleString()}</p>
              <button 
                onClick={() => deleteProject(project.id)}
                style={{ backgroundColor: '#ff4444', color: 'white', padding: '5px 10px' }}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ProjectManager
```

## 🔧 常用代码片段

### 错误处理包装器
```javascript
const apiCall = async (requestFn) => {
  try {
    const response = await requestFn()
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error?.message || `HTTP ${response.status}`)
    }
    
    return result
  } catch (error) {
    console.error('API 调用失败:', error)
    throw error
  }
}
```

### 设备 ID 管理
```javascript
const getDeviceId = () => {
  let deviceId = localStorage.getItem('story-to-manga-device-id')
  if (!deviceId) {
    deviceId = 'device-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now()
    localStorage.setItem('story-to-manga-device-id', deviceId)
  }
  return deviceId
}
```

### 请求重试
```javascript
const retryRequest = async (requestFn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

## 📋 快速检查清单

- [ ] 配置正确的 API 基础 URL
- [ ] 设置正确的 API Key 和认证头
- [ ] 生成并存储设备 ID
- [ ] 实现基础的错误处理
- [ ] 测试健康检查端点
- [ ] 测试项目 CRUD 操作
- [ ] 实现加载状态和错误状态显示
- [ ] 添加用户友好的错误消息

## 🧪 测试命令

```bash
# 在浏览器控制台中快速测试
fetch('https://tairvnwvltidxcscsusl.supabase.co/functions/v1/health', {
  headers: {
    'apikey': 'YOUR_SUPABASE_ANON_KEY'
  }
}).then(r => r.json()).then(console.log)
```

## 📚 下一步

1. 阅读完整的 [前端 API 文档](./FRONTEND_API_DOCUMENTATION.md)
2. 查看 [API 架构设计](./API_ARCHITECTURE.md)
3. 参考 [Edge Functions 快速参考](./EDGE_FUNCTIONS_QUICK_REFERENCE.md)
4. 使用应用内的 `/system-diagnosis` 页面进行测试

---

*开始构建你的漫画生成应用吧！* 🎨
