# 环境变量设置指南

## 📋 .env.local 文件配置

`.env.local` 文件包含了应用程序运行所需的环境变量。这个文件应该放在项目根目录下。

## 🔧 当前配置

你的 `.env.local` 文件现在应该包含以下内容：

```bash
# Google AI API Key (used for NanoBanana - Gemini Flash Image)
# Get your API key from: https://makersuite.google.com/app/apikey
GOOGLE_AI_API_KEY=AIzaSyDkN7ISWA0oen2w2psrJC_CQ4L5fe97JXU

# Google Analytics Measurement ID
# Get your Measurement ID from: https://analytics.google.com/
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# VolcEngine (ByteDance) API Configuration
# Get your API credentials from: https://console.volcengine.com/
VOLCENGINE_API_KEY=f8858401-aa58-49b7-bff9-9876ef8bdf14

# AI Model Configuration
# Supported values: auto, nanobanana, volcengine
NEXT_PUBLIC_DEFAULT_AI_MODEL=auto
NEXT_PUBLIC_ENABLE_MODEL_SELECTION=true

# Supabase 配置 (用于漫画分享功能)
# 项目 URL - 你提供的 Supabase 项目地址
NEXT_PUBLIC_SUPABASE_URL=https://tairvnwvltidxcscsusl.supabase.co

# 匿名公钥 - 你提供的 API Key
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhaXJ2bnd2bHRpZHhjc2NzdXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjY3MDIsImV4cCI6MjA3Mzc0MjcwMn0.9YU03FVkvHFzhxOiJfrIACiOcK460cN9kT-or641g94

# Cloudflare R2 存储配置 (用于云端数据存储)
# 从 Cloudflare R2 控制台获取
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key

# 应用程序配置
NEXT_PUBLIC_APP_URL=http://localhost:8000
```

## 📝 环境变量说明

### 🤖 AI 模型配置
- **GOOGLE_AI_API_KEY**: Google Gemini API 密钥，用于图像生成
- **VOLCENGINE_API_KEY**: 火山引擎 API 密钥，用于图像生成
- **NEXT_PUBLIC_DEFAULT_AI_MODEL**: 默认 AI 模型选择
- **NEXT_PUBLIC_ENABLE_MODEL_SELECTION**: 是否启用模型选择功能

### 🗄️ Supabase 数据库配置
- **NEXT_PUBLIC_SUPABASE_URL**: Supabase 项目 URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Supabase 匿名公钥，用于客户端访问

### ☁️ Cloudflare R2 存储配置
- **R2_ACCESS_KEY_ID**: Cloudflare R2 访问密钥 ID
- **R2_SECRET_ACCESS_KEY**: Cloudflare R2 秘密访问密钥

### 📊 其他配置
- **NEXT_PUBLIC_GA_MEASUREMENT_ID**: Google Analytics 跟踪 ID
- **NEXT_PUBLIC_APP_URL**: 应用程序的基础 URL

## 🔍 如何获取 Supabase 配置

如果你需要获取或验证 Supabase 配置：

### 1. 登录 Supabase 控制台
1. 访问 [https://supabase.com](https://supabase.com)
2. 登录你的账户
3. 选择你的项目

### 2. 获取项目 URL
1. 在项目仪表板中，点击左侧的 **"Settings"**
2. 点击 **"API"**
3. 在 **"Project URL"** 部分复制 URL
4. 应该类似于：`https://your-project-id.supabase.co`

### 3. 获取 API 密钥
在同一个 API 设置页面：
1. 找到 **"Project API keys"** 部分
2. 复制 **"anon public"** 密钥（不是 service_role 密钥）
3. 这个密钥是安全的，可以在客户端使用

## ⚠️ 安全注意事项

### 可以公开的变量 (NEXT_PUBLIC_ 前缀)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEFAULT_AI_MODEL`
- `NEXT_PUBLIC_ENABLE_MODEL_SELECTION`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_APP_URL`

### 需要保密的变量 (无 NEXT_PUBLIC_ 前缀)
- `GOOGLE_AI_API_KEY`
- `VOLCENGINE_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (如果使用)

## 🔄 重启应用程序

修改 `.env.local` 文件后，需要重启开发服务器：

```bash
# 停止当前服务器 (Ctrl+C)
# 然后重新启动
pnpm dev
```

## ✅ 验证配置

### 1. 检查环境变量加载
在浏览器开发者工具的 Console 中运行：
```javascript
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
```

### 2. 测试 Supabase 连接
尝试使用分享功能，如果配置正确，应该能够连接到数据库。

### 3. 查看网络请求
在开发者工具的 Network 标签页中，查看是否有发送到 Supabase 的请求。

## 🐛 常见问题

### 问题 1: 环境变量未加载
**症状**: 应用程序无法连接到 Supabase
**解决**: 
1. 确认 `.env.local` 文件在项目根目录
2. 重启开发服务器
3. 检查变量名拼写是否正确

### 问题 2: API 密钥无效
**症状**: 认证错误或权限错误
**解决**:
1. 重新从 Supabase 控制台复制 API 密钥
2. 确认使用的是 `anon public` 密钥，不是 `service_role` 密钥
3. 检查项目 URL 是否正确

### 问题 3: 跨域错误
**症状**: CORS 错误
**解决**:
1. 在 Supabase 控制台的 Authentication > Settings 中
2. 添加 `http://localhost:8000` 到 Site URL
3. 添加 `http://localhost:8000/**` 到 Redirect URLs

## 📁 文件位置

确保 `.env.local` 文件位于正确的位置：

```
story-to-manga-enhanced/
├── .env.local          ← 应该在这里
├── package.json
├── next.config.js
├── src/
└── ...
```

## 🔄 生产环境配置

在部署到生产环境时，需要在部署平台（如 Vercel、Netlify）中设置相同的环境变量。

完成这些配置后，你的漫画分享功能应该可以正常连接到 Supabase 数据库了！
