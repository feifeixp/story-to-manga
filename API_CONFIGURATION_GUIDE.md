# API 配置指南

## 🔑 获取 API 密钥

### 1. Supabase API 密钥

要使用 Story to Manga API，您需要从 Supabase 项目获取以下密钥：

#### 获取步骤：
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目：`tairvnwvltidxcscsusl`
3. 进入 **Settings** → **API**
4. 复制以下密钥：

```bash
# 项目 URL
SUPABASE_URL=https://tairvnwvltidxcscsusl.supabase.co

# 匿名公钥（用于前端）
SUPABASE_ANON_KEY=your_anon_key_here

# 服务角色密钥（仅用于服务器端，勿在前端使用）
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 2. 设备 ID 生成

对于匿名用户，您需要生成一个唯一的设备 ID：

```javascript
// 生成设备 ID
const generateDeviceId = () => {
  return 'device-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now()
}

// 存储设备 ID
const getOrCreateDeviceId = () => {
  let deviceId = localStorage.getItem('story-to-manga-device-id')
  
  if (!deviceId) {
    deviceId = generateDeviceId()
    localStorage.setItem('story-to-manga-device-id', deviceId)
  }
  
  return deviceId
}
```

## 🛠️ 配置示例

### 前端配置

```javascript
// 配置对象
const apiConfig = {
  baseURL: 'https://tairvnwvltidxcscsusl.supabase.co/functions/v1',
  supabaseUrl: 'https://tairvnwvltidxcscsusl.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY', // 替换为实际的匿名密钥
  deviceId: getOrCreateDeviceId()
}

// 请求头配置
const headers = {
  'Content-Type': 'application/json',
  'apikey': apiConfig.anonKey,
  'Authorization': `Bearer ${apiConfig.anonKey}`,
  'x-device-id': apiConfig.deviceId
}
```

### React 环境变量配置

创建 `.env.local` 文件：

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://tairvnwvltidxcscsusl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PROJECT_ID=your_project_id
NEXT_PUBLIC_DEVICE_ID=your_device_id

# API 配置
NEXT_PUBLIC_API_BASE_URL=https://tairvnwvltidxcscsusl.supabase.co/functions/v1
```

在 React 组件中使用：

```javascript
const apiConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  deviceId: process.env.NEXT_PUBLIC_DEVICE_ID || getOrCreateDeviceId()
}
```

### Node.js 服务器端配置

创建 `.env` 文件：

```bash
# Supabase 配置
SUPABASE_URL=https://tairvnwvltidxcscsusl.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 应用配置
API_BASE_URL=https://tairvnwvltidxcscsusl.supabase.co/functions/v1
PROJECT_ID=your_project_id
DEVICE_ID=your_device_id
```

在 Node.js 中使用：

```javascript
require('dotenv').config()

const apiConfig = {
  baseURL: process.env.API_BASE_URL,
  supabaseUrl: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  deviceId: process.env.DEVICE_ID
}
```

## 🔒 安全最佳实践

### 1. 密钥管理

- ✅ **匿名密钥**：可以在前端使用，用于只读操作
- ❌ **服务角色密钥**：绝不要在前端暴露，仅用于服务器端
- ✅ **环境变量**：使用环境变量存储敏感信息
- ❌ **硬编码**：不要在代码中硬编码 API 密钥

### 2. 前端安全

```javascript
// ✅ 正确的做法
const headers = {
  'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
}

// ❌ 错误的做法 - 不要硬编码密钥
const headers = {
  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
}
```

### 3. 服务器端安全

```javascript
// ✅ 正确的做法 - 使用服务角色密钥进行管理操作
const adminHeaders = {
  'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
}

// ✅ 正确的做法 - 使用匿名密钥进行普通操作
const userHeaders = {
  'apikey': process.env.SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
  'x-device-id': deviceId
}
```

## 🧪 配置验证

### 验证脚本

```javascript
const validateConfig = async () => {
  const config = {
    baseURL: 'https://tairvnwvltidxcscsusl.supabase.co/functions/v1',
    anonKey: 'YOUR_SUPABASE_ANON_KEY', // 替换为实际密钥
    deviceId: 'YOUR_DEVICE_ID'
  }

  try {
    // 测试健康检查
    const response = await fetch(`${config.baseURL}/health`, {
      headers: {
        'apikey': config.anonKey,
        'x-device-id': config.deviceId
      }
    })

    if (response.ok) {
      const data = await response.json()
      console.log('✅ API 配置验证成功:', data.data.status)
      return true
    } else {
      console.error('❌ API 配置验证失败:', response.status)
      return false
    }
  } catch (error) {
    console.error('❌ 配置验证错误:', error.message)
    return false
  }
}

// 运行验证
validateConfig()
```

### 配置检查清单

- [ ] 已获取 Supabase 匿名密钥
- [ ] 已设置正确的项目 URL
- [ ] 已生成或配置设备 ID
- [ ] 环境变量已正确设置
- [ ] 前端不包含服务角色密钥
- [ ] API 健康检查通过
- [ ] 基础 API 调用正常工作

## 🔄 配置更新

### 密钥轮换

当需要更新 API 密钥时：

1. 在 Supabase Dashboard 中生成新密钥
2. 更新环境变量文件
3. 重新部署应用
4. 验证新配置是否正常工作
5. 撤销旧密钥（如果需要）

### 环境切换

```javascript
// 开发环境
const devConfig = {
  baseURL: 'https://tairvnwvltidxcscsusl.supabase.co/functions/v1',
  anonKey: 'dev_anon_key',
  deviceId: 'dev-device-id'
}

// 生产环境
const prodConfig = {
  baseURL: 'https://tairvnwvltidxcscsusl.supabase.co/functions/v1',
  anonKey: 'prod_anon_key',
  deviceId: 'prod-device-id'
}

// 根据环境选择配置
const config = process.env.NODE_ENV === 'production' ? prodConfig : devConfig
```

## 📞 故障排除

### 常见问题

1. **401 Unauthorized**
   - 检查 API 密钥是否正确
   - 确认密钥没有过期
   - 验证请求头格式

2. **403 Forbidden**
   - 检查权限设置
   - 确认使用了正确的密钥类型
   - 验证设备 ID 是否有效

3. **404 Not Found**
   - 检查 API 端点 URL
   - 确认 Edge Function 已部署
   - 验证项目引用是否正确

### 调试技巧

```javascript
// 启用调试模式
const debugConfig = {
  ...config,
  debug: true
}

// 记录请求详情
const debugFetch = async (url, options) => {
  console.log('🔍 API 请求:', { url, options })
  
  const response = await fetch(url, options)
  const data = await response.json()
  
  console.log('📥 API 响应:', { status: response.status, data })
  
  return { response, data }
}
```

---

**重要提醒**：请将文档中的 `YOUR_SUPABASE_ANON_KEY`、`YOUR_DEVICE_ID` 等占位符替换为您的实际配置值。
