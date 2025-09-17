# 🚀 快速开始 - Story to Manga Enhanced

## 一键部署（推荐）

在新机器上快速部署，只需要一条命令：

```bash
curl -fsSL https://raw.githubusercontent.com/feifeixp/story-to-manga-enhanced/main/quick-deploy.sh | bash
```

这个脚本会自动：
- ✅ 检查并安装必需的工具（Node.js, pnpm）
- ✅ 克隆项目到本地
- ✅ 安装所有依赖
- ✅ 创建环境配置文件
- ✅ 引导你配置 API 密钥
- ✅ 启动开发服务器

## 手动部署

如果你喜欢手动控制每个步骤：

### 1. 克隆项目
```bash
git clone https://github.com/feifeixp/story-to-manga-enhanced.git
cd story-to-manga-enhanced
```

### 2. 安装依赖
```bash
# 确保已安装 Node.js 18+
npm install -g pnpm
pnpm install
```

### 3. 配置环境
```bash
cp .env.local.example .env.local
# 编辑 .env.local 添加你的 API 密钥
```

### 4. 启动服务
```bash
pnpm dev
```

访问 http://localhost:8000

## 🔑 获取 API 密钥

### Google AI API Key（必需）
1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 登录 Google 账号
3. 创建 API Key
4. 复制到 `.env.local` 文件

### VolcEngine API Key（可选）
1. 访问 [VolcEngine 控制台](https://console.volcengine.com/)
2. 注册账号
3. 创建图像生成 API 凭证
4. 复制到 `.env.local` 文件

## 🌐 生产部署

### Vercel（推荐）
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/feifeixp/story-to-manga-enhanced)

1. 点击上方按钮
2. 连接 GitHub 账号
3. 添加环境变量：`GOOGLE_AI_API_KEY`
4. 部署完成

### Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/feifeixp/story-to-manga-enhanced)

### AWS Amplify
1. 连接 GitHub 仓库
2. 配置构建设置
3. 添加环境变量
4. 部署

## 📱 Docker 部署

```bash
# 构建镜像
docker build -t story-to-manga-enhanced .

# 运行容器
docker run -p 8000:8000 \
  -e GOOGLE_AI_API_KEY=your_key_here \
  story-to-manga-enhanced
```

## 🔧 故障排除

### 常见问题

**端口被占用**
```bash
pnpm dev -- -p 3001
```

**依赖安装失败**
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**API 密钥错误**
- 检查 `.env.local` 文件格式
- 确认密钥没有多余空格
- 验证密钥是否有效

### 获取帮助

- 📖 [完整部署指南](./DEPLOYMENT.md)
- 🐛 [GitHub Issues](https://github.com/feifeixp/story-to-manga-enhanced/issues)
- 💬 [讨论区](https://github.com/feifeixp/story-to-manga-enhanced/discussions)

## ✨ 功能特色

- 🤖 **多AI模型**: Google Gemini + VolcEngine Doubao
- 🎨 **6种风格**: 日漫、美漫、武侠、治愈、韩漫、电影风格
- 📁 **项目管理**: 多项目支持，自动保存
- 🖼️ **高级编辑**: 重绘、修改、参考图片
- 🌍 **双语支持**: 中文/英文界面
- ⚡ **性能优化**: 并行处理、智能缓存
- 📄 **分页显示**: 支持50+面板的大型项目

---

**开始创作你的漫画故事吧！** 🎨✨
