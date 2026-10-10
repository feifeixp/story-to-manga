# Mac 本地运行与验收

新版代码已安装在 `/Users/ff/Documents/Codex/2026-10-11/task/story-to-manga`。
打开 http://127.0.0.1:8000/app 进入四步创作工作台。

## 启动

在 Finder 双击项目目录的 `Start Story to Manga.command`，或在终端运行：

```sh
cd /Users/ff/Documents/Codex/2026-10-11/task/story-to-manga
./'Start Story to Manga.command'
```

保持终端打开。停止使用 Ctrl-C；若 8000 端口已有服务，先使用现有页面。
该脚本仅监听本机 127.0.0.1，并优先使用本任务目录安装的 Node 24。
未改变 Mac 的全局 Node、pnpm 或 npm 版本。

## 验证

```sh
export PATH="$PWD/../.runtime/node_modules/node/bin:$PATH"
pnpm test
pnpm typecheck
pnpm exec biome check src/components/studio src/lib/studioWorkflow.ts src/lib/studioExport.ts
pnpm build
```

测试需要 Node 24。安装使用 `pnpm install --frozen-lockfile`；原 npm 锁文件仍然过期。
全仓库 Biome 和 knip 仍报告代码风格和未使用文件/导出，需要后续专项清理；
新版工作台范围的 Biome 已通过。完整日志和浏览器导出样本在项目父目录。

## 配置与边界

本次没有复制示例假密钥，也没有从其他目录取用凭据。未配置 Google 密钥时，
界面和本地草稿正常运行，故事拆解接口返回 503 和配置提示。
需要实际拆解时，在本项目 `.env.local` 配置 `GOOGLE_AI_API_KEY` 并重启。
Neowow 单 Key 接入仍未实现；现有 Google/火山接口保留，实际模型生成尚未验收。
本次所有生成、暂停、重绘和导出浏览器测试使用隔离的模拟接口，没有付费模型调用。
原图库登录和发布没有执行，远端 Supabase 配置没有改动。

图库旧代码使用了 Supabase SDK 不存在的 `supabase.sql`；现已改为交互记录写入，
计数应由数据库触发器维护。`database/interaction_counters.sql` 是待人工审阅的
可选迁移，没有在远端执行；若远端没有相应触发器，图库计数不会自动刷新。
迁移的回填以现有交互记录为准，会重新计算历史计数；使用前应确认这一行为。

## 加入 Codex 项目

当前工具没有创建侧栏项目接口，且桌面自动化禁止操作 Codex 本体。
请在 Codex 的添加项目/打开文件夹入口选择上述项目目录。
这一步是注册新的侧栏项目；当前委派任务不代表已经创建侧栏项目。

## 版本

从基线 `633f07c1104133a4326fc7fed512d99e3a7a211e` 的新分支
`feat/story-studio-workflow` 应用了 Library ZIP 的 Git patch。初次应用后的
22 个文件与 ZIP 的 changed-files 逐字节一致；后续修复单独保留在本地。
没有推送、创建 PR、合并或发布。
