# Edge Functions 架构文档

## 📋 当前部署的 Edge Functions

| 函数名 | 状态 | 版本 | 用途 | 端点 |
|--------|------|------|------|------|
| `projects` | ✅ ACTIVE | v15 | 项目 CRUD 操作 | `/functions/v1/projects` |
| `project-storage` | ✅ ACTIVE | v17 | 项目存储管理 | `/functions/v1/project-storage` |
| `project-storage-working` | ✅ ACTIVE | v2 | 项目存储（工作版本） | `/functions/v1/project-storage-working` |
| `project-storage-simple` | ✅ ACTIVE | v1 | 项目存储（简化版本） | `/functions/v1/project-storage-simple` |
| `projects-simple` | ✅ ACTIVE | v1 | 项目管理（简化版本） | `/functions/v1/projects-simple` |
| `manga-generation` | ✅ ACTIVE | v13 | 漫画生成 | `/functions/v1/manga-generation` |
| `sharing` | ✅ ACTIVE | v13 | 项目分享 | `/functions/v1/sharing` |
| `health` | ✅ ACTIVE | v1 | 健康检查 | `/functions/v1/health` |

## 🎯 推荐的 Edge Functions 使用策略

### 1. 项目管理 - 使用 `projects` 函数
```typescript
// GET /functions/v1/projects - 获取项目列表
// POST /functions/v1/projects - 创建项目
// PUT /functions/v1/projects - 更新项目
// DELETE /functions/v1/projects?projectId=xxx - 删除项目
```

### 2. 项目存储 - 使用 `project-storage-working` 函数
```typescript
// GET /functions/v1/project-storage-working?projectId=xxx - 加载项目数据
// POST /functions/v1/project-storage-working - 保存项目数据
// GET /functions/v1/project-storage-working?list=true - 获取项目列表（备选）
```

### 3. 漫画生成 - 使用 `manga-generation` 函数
```typescript
// POST /functions/v1/manga-generation - 生成漫画
```

### 4. 项目分享 - 使用 `sharing` 函数
```typescript
// POST /functions/v1/sharing - 创建分享链接
// GET /functions/v1/sharing?shareId=xxx - 获取分享内容
```

## 🔍 当前问题分析

### ✅ 工作正常的部分
1. **Edge Functions 部署** - 所有函数都已成功部署
2. **数据库访问** - 通过 REST API 可以正常访问 `projects` 表
3. **认证系统** - JWT token 和设备ID认证都已实现

### ❌ 存在问题的部分
1. **客户端 Supabase 查询** - `supabaseProjectStorage.ts` 无法查询数据库
2. **网络连接问题** - 浏览器无法访问某些 Edge Functions 端点
3. **认证状态不一致** - 不同组件获取的认证状态不同

## 🔧 解决方案

### 方案1：使用工作正常的 Edge Functions
- 前端直接调用 `projects` Edge Function
- 绕过客户端 Supabase 查询
- 使用统一的认证头格式

### 方案2：修复客户端 Supabase 配置
- 检查 RLS 策略
- 修复客户端权限问题
- 统一认证状态管理

### 方案3：混合方案
- 项目列表：使用 Edge Functions
- 项目数据：使用客户端 Supabase
- 文件存储：使用 R2 + Edge Functions

## 📊 数据库表结构

### `projects` 表
```sql
- id: string (主键)
- name: string
- description: string
- story: string
- style: string
- status: string
- visibility: string
- tags: json[]
- ai_model: string
- user_id: string (可为空)
- device_id: string (可为空)
- image_size: json
- generation_state: json
- metadata: json
- r2_path: string
- created_at: timestamp
- updated_at: timestamp
```

## 🎯 推荐的立即行动

1. **修复项目列表加载** - 使用 `projects` Edge Function
2. **统一认证管理** - 确保所有组件使用相同的认证逻辑
3. **清理冗余函数** - 删除不需要的测试函数
4. **完善错误处理** - 添加详细的错误日志和用户友好的错误信息

## 🔄 下一步计划

1. 修复当前的项目列表加载问题
2. 测试完整的用户流程
3. 优化 Edge Functions 架构
4. 添加监控和日志系统
