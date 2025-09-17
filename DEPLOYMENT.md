# 🚀 Story to Manga Enhanced - 部署指南

本指南将帮助你在新机器上快速部署 Story to Manga Enhanced 项目。

## 📋 系统要求

### 必需环境
- **Node.js**: 18.0.0 或更高版本
- **pnpm**: 推荐包管理器（也可使用 npm 或 yarn）
- **Git**: 用于克隆仓库

### 推荐配置
- **内存**: 4GB 或更多
- **存储**: 至少 2GB 可用空间
- **网络**: 稳定的互联网连接（用于AI API调用）

## 🛠️ 快速部署步骤

### 1. 环境准备

#### 安装 Node.js
```bash
# 使用 nvm (推荐)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 或直接下载安装
# 访问 https://nodejs.org/ 下载 LTS 版本
```

#### 安装 pnpm
```bash
npm install -g pnpm
```

### 2. 克隆项目

```bash
# 克隆你的仓库
git clone https://github.com/feifeixp/story-to-manga-enhanced.git
cd story-to-manga-enhanced
```

### 3. 安装依赖

```bash
# 安装所有依赖包
pnpm install

# 如果使用 npm
# npm install
```

### 4. 环境配置

#### 复制环境变量模板
```bash
cp .env.local.example .env.local
```

#### 编辑环境变量
```bash
# 使用你喜欢的编辑器
nano .env.local
# 或
vim .env.local
# 或
code .env.local
```

#### 配置 API 密钥
在 `.env.local` 文件中添加：

```env
# Google AI API Key (必需)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# VolcEngine API Key (可选，用于额外的AI模型)
VOLCENGINE_API_KEY=your_volcengine_api_key_here

# 开发环境设置
NODE_ENV=development
```

### 5. 获取 API 密钥

#### Google AI API Key (必需)
1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 使用 Google 账号登录
3. 点击 "Create API Key"
4. 复制生成的 API 密钥
5. 粘贴到 `.env.local` 文件中

#### VolcEngine API Key (可选)
1. 访问 [VolcEngine 控制台](https://console.volcengine.com/)
2. 注册并验证账号
3. 导航到 AI 服务 → 图像生成
4. 创建 API 凭证
5. 复制 API 密钥到 `.env.local`

### 6. 启动开发服务器

```bash
# 启动开发服务器
pnpm dev

# 服务器将在 http://localhost:8000 启动
```

### 7. 验证部署

打开浏览器访问 `http://localhost:8000`，你应该能看到：
- ✅ 主页正常加载
- ✅ 语言切换功能正常
- ✅ 项目管理功能可用
- ✅ 能够创建新项目

## 🌐 生产环境部署

### Vercel 部署 (推荐)

1. **Fork 仓库到你的 GitHub**
2. **连接 Vercel**：
   - 访问 [vercel.com](https://vercel.com)
   - 使用 GitHub 登录
   - 点击 "New Project"
   - 选择你的仓库

3. **配置环境变量**：
   - 在 Vercel 项目设置中添加环境变量
   - 添加 `GOOGLE_AI_API_KEY`
   - 可选添加 `VOLCENGINE_API_KEY`

4. **部署**：
   - 点击 "Deploy"
   - 等待构建完成

### AWS Amplify 部署

1. **连接仓库**：
   - 访问 AWS Amplify 控制台
   - 选择 "Host web app"
   - 连接你的 GitHub 仓库

2. **配置构建设置**：
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install -g pnpm
           - pnpm install
       build:
         commands:
           - pnpm build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

3. **添加环境变量**：
   - 在 Amplify 控制台添加环境变量
   - 添加所需的 API 密钥

### Netlify 部署

1. **连接仓库**：
   - 访问 [netlify.com](https://netlify.com)
   - 点击 "New site from Git"
   - 选择你的 GitHub 仓库

2. **构建设置**：
   - Build command: `pnpm build`
   - Publish directory: `.next`

3. **环境变量**：
   - 在 Netlify 站点设置中添加环境变量

## 🔧 故障排除

### 常见问题

#### 1. 端口被占用
```bash
# 使用不同端口
pnpm dev -- -p 3001
```

#### 2. 依赖安装失败
```bash
# 清理缓存重新安装
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### 3. API 密钥无效
- 检查 `.env.local` 文件格式
- 确认 API 密钥没有多余空格
- 验证 API 密钥是否有效

#### 4. 构建失败
```bash
# 检查 TypeScript 错误
pnpm typecheck

# 检查代码格式
pnpm lint

# 运行所有检查
pnpm check
```

### 性能优化

#### 开发环境
- 使用 SSD 硬盘
- 确保足够的内存 (4GB+)
- 关闭不必要的应用程序

#### 生产环境
- 启用 CDN
- 配置缓存策略
- 使用环境变量管理敏感信息

## 📱 移动端访问

项目支持响应式设计，可以在移动设备上访问：
- 在同一网络下，使用 `http://你的IP地址:8000` 访问
- 确保防火墙允许 8000 端口

## 🔒 安全注意事项

1. **API 密钥安全**：
   - 永远不要将 API 密钥提交到 Git
   - 使用环境变量管理敏感信息
   - 定期轮换 API 密钥

2. **生产环境**：
   - 使用 HTTPS
   - 配置适当的 CORS 策略
   - 监控 API 使用量

## 📞 获取帮助

如果遇到问题：
1. 检查 [GitHub Issues](https://github.com/feifeixp/story-to-manga-enhanced/issues)
2. 查看浏览器控制台错误信息
3. 检查服务器日志
4. 创建新的 Issue 描述问题

---

**部署成功后，你就可以开始创作精彩的漫画故事了！** 🎨✨
