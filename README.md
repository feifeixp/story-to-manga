# Story to Manga · 故事创作工作台

把文字故事变成可以逐格打磨的漫画。先写故事、审核角色与分镜，再生成画面，最后精修和导出。

A bilingual story-to-manga workspace: write, review the storyboard, generate, then refine and export.

基于 [victorhuangwq/story-to-manga](https://github.com/victorhuangwq/story-to-manga) 扩展，使用 Next.js、React 和 TypeScript，保留 Google Gemini、火山引擎图像接口与 Supabase 图库分享功能。

## 新版工作台（2026-10）

`/app` 已升级为四步创作流程，支持中文和英文：

| 步骤 | 操作 |
| --- | --- |
| 1. 写下故事 | 输入故事、选择画风和期望分镜数量，让 AI 拆解故事。 |
| 2. 确认角色与分镜 | 编辑角色、场景、镜头与对白，上传参考图，确认后再生成画面。 |
| 3. 生成漫画 | 按顺序生成并保存分镜，查看进度，暂停或继续缺失、待重绘的画面。 |
| 4. 精修与导出 | 单格重绘、修改图片、恢复历史版本，导出漫画页面、原图和项目备份。 |

故事拆解只调用文本接口；图片生成在确认分镜后单独开始。修改故事后，需要重新拆解并审核分镜。

### 主要功能

- **项目管理**：创建、切换和自动保存多个项目，兼容已有本地项目。
- **十种画风**：日系治愈、黑白漫画、东方水墨、复古美漫、韩式条漫、电影叙事、少女漫画、青年漫画、Q 版萌系、奇幻冒险。
- **角色与场景参考**：生成角色参考图，或上传自己的角色、场景图片。
- **可恢复的生成流程**：防止重复启动同一生成流程；每格保存后再开始下一格，继续时跳过已完成画面。
- **单格精修**：调整分镜描述、重绘或修改图片；每格保留最多三个先前图片版本。
- **导出**：单张图片、分页 PNG、原图与项目 ZIP、项目 JSON 备份。漫画页面每页最多六格，多页导出为 ZIP。
- **图库分享**：保留 Supabase 登录和作品发布入口，需配置相应数据库与存储。

## 快速开始

### 1. 准备环境并安装

使用 **Node.js 24** 和 **pnpm**；当前测试依赖 Node 的 TypeScript 转换能力。先确认 `node --version` 和 `pnpm --version` 可用。

```sh
git clone https://github.com/feifeixp/story-to-manga.git
cd story-to-manga
pnpm install --frozen-lockfile
```

请使用 `pnpm-lock.yaml` 安装。仓库现有 `package-lock.json` 与依赖声明不一致，`npm ci` 会失败。

### 2. 配置模型

需要实际故事拆解和生成时，复制配置模板：

```sh
cp .env.local.example .env.local
```

将 `.env.local` 中的占位值替换为自己的凭据：

```env
# 故事分析、分镜规划与 Google 图片生成
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# 当前代码的默认模型，可按账号可用模型调整
GOOGLE_TEXT_MODEL=gemini-2.5-flash
GOOGLE_IMAGE_MODEL=gemini-2.5-flash-image

# 可选：火山引擎图片生成；故事拆解仍需 Google 凭据
VOLCENGINE_API_KEY=your_volcengine_api_key_here

# 可选：Google Analytics；留空可禁用
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

Google 密钥入口：[Google AI Studio](https://aistudio.google.com/apikey)。火山引擎凭据入口：[火山引擎控制台](https://console.volcengine.com/)。实际可用模型与调用额度取决于供应商和账号权限。

密钥仅配置在本地环境文件或部署平台的服务端环境变量中。不要提交到 GitHub，也不要添加 `NEXT_PUBLIC_` 前缀或填进故事文本。修改配置后重启服务。

未配置密钥也可以打开界面、编辑故事和管理本地草稿。故事拆解在缺少 Google 密钥时返回 503 配置提示；模板中的占位值不能用于真实生成。

### 3. 启动

```sh
pnpm dev --hostname 127.0.0.1
```

打开 **[http://localhost:8000/app](http://localhost:8000/app)** 进入创作工作台。

| 地址 | 页面 |
| --- | --- |
| `/` | 项目首页 |
| `/app` | 四步创作工作台 |
| `/comics` | 作品图库 |

Mac 用户安装依赖后，也可以在 Finder 双击 `Start Story to Manga.command`。保持启动终端打开，使用 Ctrl-C 停止服务。项目专用的 Mac 安装记录见 [LOCAL_MAC_SETUP.md](docs/LOCAL_MAC_SETUP.md)。

## 创作与保存

1. 新建项目或打开已有项目，填写故事。当前故事输入框最多接受 5,000 个字符。
2. 选择画风与期望分镜数量，拆解故事。规划支持 2–50 格，实际数量以审核后的分镜结果为准。
3. 检查角色外观、场景描述、镜头与对白，确认分镜后开始生成。
4. 如需暂停，等待当前请求完成；继续时补齐缺失或待重绘的分镜。
5. 在精修页选择单格调整、重绘或恢复先前版本，再导出成品和项目备份。

项目文字保存在当前浏览器的 localStorage，图片保存在 IndexedDB。**本地项目不会自动同步到其他浏览器或设备**；登录图库也不代表草稿已上传。

定期导出 JSON 或 ZIP 备份。清理浏览器数据会删除本地项目；存储失败时，请先备份再排查。当前工作台还没有一键导入项目备份的入口。避免同时在多个标签页编辑同一个项目。

暂停会阻止下一次客户端请求，无法取消供应商已经开始的任务。现有服务端模型路由仍可能尝试其他供应商；真实生成的费用和额度以供应商为准。

## 开发与验证

```sh
pnpm test
pnpm typecheck
pnpm exec biome check src/components/studio src/lib/studioWorkflow.ts src/lib/studioExport.ts
pnpm build
```

2026-10-11 在 Mac 本地对新版代码完成验证：

- **38 个测试通过**：19 个存储回归测试、11 个流程与接口错误测试、8 个模拟组件交互测试。
- **完整 TypeScript 检查通过**。
- **工作台范围 Biome 检查通过**。
- **Next.js 生产构建通过**，本地 `/app` 返回 HTTP 200。

上述自动化测试使用模拟接口，不消耗模型额度；不代表真实模型生成、图库登录或作品发布已经验收。

全仓库 Biome 和 knip 仍有历史问题。`pnpm lint`、`pnpm format` 会写入文件；`pnpm check` 也包含会写入文件的 lint 步骤。只需查看全仓库规范问题时，使用 `pnpm exec biome check .`。

### 目录结构

```text
src/app/app/              工作台页面与样式
src/components/studio/    工作台、对话框与项目状态
src/app/api/              故事分析、分镜、图片生成和编辑接口
src/lib/projectStorage.ts 本地项目与图片存储
src/lib/studioWorkflow.ts 生成流程与接口处理
src/lib/studioExport.ts   PNG、ZIP 与 JSON 导出
src/lib/services/         图库服务
src/locales/              中文和英文翻译
public/                  静态资源
database/                Supabase 建表与迁移脚本
tests/                   存储、流程与组件测试
```

## 更新现有安装

先导出浏览器内的重要项目，并保存自己的 `.env.local`。如果有未提交代码，先提交或备份，之后执行：

```sh
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm dev --hostname 127.0.0.1
```

更新前先停止原开发服务。不要为了更新删除浏览器数据或锁文件。

## 部署与图库

本项目包含 Next.js 服务端 POST 接口，部署需要支持 Node/Next.js 服务端运行的环境。GitHub Pages 不能单独运行这些模型接口。

在部署平台配置服务端凭据后，执行：

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start --port 8000
```

仓库的旧版一键部署脚本和 Amplify 配置尚未与新版 pnpm 安装流程同步。当前请按上述命令配置构建与启动；仓库未提供 Dockerfile。

图库沿用 `src/lib/supabase.ts` 的连接配置。接入自己的 Supabase 时，需要核对认证、表结构、行级权限和图片存储。相关说明见 [数据库配置指南](DATABASE_SETUP_GUIDE.md) 与 [漫画分享配置](COMIC_SHARING_SETUP.md)。

图库浏览、点赞和收藏计数改为依赖数据库触发器。可选迁移 [interaction_counters.sql](database/interaction_counters.sql) **尚未在远端执行**；执行前检查现有触发器并备份数据。该迁移会按交互记录重新计算历史计数；没有对应触发器时，计数不会自动更新。

**Neowow 单 Key 接入尚未实现**。当前保留 Google/火山引擎接口，不能直接用 Neowow Key 替代上述凭据。

## 常见问题

| 问题 | 处理方式 |
| --- | --- |
| 8000 端口被占用 | 停止旧服务，或运行 `pnpm exec next dev --hostname 127.0.0.1 --port 8001`，访问新端口。 |
| 故事拆解提示缺少配置 | 填写有效的 `GOOGLE_AI_API_KEY` 并重启；火山图片密钥不能替代文本规划凭据。 |
| 模型请求失败 | 查看界面错误与服务端日志，检查账号模型权限、额度和网络，再决定是否重试。 |
| 图片无法下载 | 部分供应商图片链接会过期。及时导出原图与项目 ZIP；过期链接可能需要重新生成。 |
| 项目无法读取或保存 | 保留现有数据，先备份可读取的项目，检查浏览器存储空间与隐私设置。 |
| 测试报 TypeScript 转换错误 | 确认当前终端使用 Node 24，然后重新运行 `pnpm test`。 |

## 漫画示例

以下是仓库保留的历史生成示例，不是新版工作台界面截图：

![漫画生成示例](screenshots/output.png)

## 更多资料与贡献

- [工作台改造记录](docs/STORY_STUDIO_UPGRADE.md)：最初实现范围与限制，早期验证记录以本文最新结果为补充。
- [Mac 本地运行记录](docs/LOCAL_MAC_SETUP.md)：项目专用启动方式和本地验收说明。
- [提示词说明](PROMPTS_DOCUMENTATION.md)。
- [历史更新日志](CHANGELOG.md)。
- [贡献指南](CONTRIBUTING.md)。
- [提交问题](https://github.com/feifeixp/story-to-manga/issues)。

欢迎通过 Issue 提交问题，或从功能分支发起 Pull Request。说明修改场景、验证结果，以及界面变更的截图。

本项目采用 [MIT License](LICENSE)。感谢原项目作者 [victorhuangwq](https://github.com/victorhuangwq/story-to-manga) 及所有贡献者。
