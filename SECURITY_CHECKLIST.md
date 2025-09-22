# API 安全检查清单

## 🔒 文档安全审查

### ✅ 已完成的安全措施

- [x] **移除真实 API 密钥**：所有 .md 文档中的真实 API 密钥已替换为占位符
- [x] **移除服务角色密钥**：所有文档中的服务角色密钥已移除或替换为占位符
- [x] **添加安全提醒**：在主要文档中添加了安全提醒和配置指南链接
- [x] **创建配置指南**：提供了详细的 API 配置和安全最佳实践指南
- [x] **占位符标准化**：统一使用 `YOUR_SUPABASE_ANON_KEY`、`YOUR_DEVICE_ID` 等占位符

### 📋 文档安全状态

| 文档 | 状态 | 说明 |
|------|------|------|
| `FRONTEND_API_DOCUMENTATION.md` | ✅ 安全 | 已移除真实密钥，添加安全提醒 |
| `API_QUICK_START_GUIDE.md` | ✅ 安全 | 已移除真实密钥，添加安全提醒 |
| `API_DOCUMENTATION_SUMMARY.md` | ✅ 安全 | 已移除真实密钥，添加安全提醒 |
| `API_CONFIGURATION_GUIDE.md` | ✅ 安全 | 专门的配置和安全指南 |
| `HEALTH_FUNCTION_SETUP.md` | ✅ 安全 | 已移除真实服务角色密钥 |
| `EDGE_FUNCTIONS_QUICK_REFERENCE.md` | ✅ 安全 | 使用占位符格式 |
| `EDGE_FUNCTIONS_GUIDE.md` | ✅ 安全 | 使用占位符格式 |

## 🛡️ 开发者安全指南

### 1. 密钥管理

#### ✅ 正确做法
```javascript
// 使用环境变量
const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const headers = {
  'apikey': apiKey,
  'Authorization': `Bearer ${apiKey}`
}
```

#### ❌ 错误做法
```javascript
// 不要硬编码密钥
const headers = {
  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
}
```

### 2. 环境变量配置

#### 前端环境变量 (.env.local)
```bash
# ✅ 可以在前端使用
NEXT_PUBLIC_SUPABASE_URL=https://tairvnwvltidxcscsusl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_DEVICE_ID=your_device_id_here

# ❌ 不要在前端使用
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

#### 服务器端环境变量 (.env)
```bash
# ✅ 服务器端可以使用所有密钥
SUPABASE_URL=https://tairvnwvltidxcscsusl.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. 代码审查检查点

- [ ] 检查是否有硬编码的 API 密钥
- [ ] 确认服务角色密钥不在前端代码中
- [ ] 验证环境变量正确配置
- [ ] 检查 .env 文件是否在 .gitignore 中
- [ ] 确认生产环境使用不同的密钥

## 🔍 安全审计工具

### 1. 密钥扫描脚本

```bash
#!/bin/bash
# 检查代码中是否有泄露的密钥

echo "🔍 扫描硬编码的 API 密钥..."

# 检查 JWT 格式的密钥
if grep -r "eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" .; then
    echo "❌ 发现可能的硬编码 JWT 密钥！"
    exit 1
else
    echo "✅ 未发现硬编码的 JWT 密钥"
fi

# 检查 Supabase 密钥模式
if grep -r "sb-.*-auth-token" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" .; then
    echo "❌ 发现可能的 Supabase 密钥！"
    exit 1
else
    echo "✅ 未发现 Supabase 密钥"
fi

echo "🎉 安全扫描完成"
```

### 2. 环境变量验证

```javascript
// 验证必需的环境变量
const validateEnvironment = () => {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ]
  
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`缺少必需的环境变量: ${missing.join(', ')}`)
  }
  
  // 检查密钥格式
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey.startsWith('eyJ')) {
    throw new Error('Supabase 匿名密钥格式不正确')
  }
  
  console.log('✅ 环境变量验证通过')
}
```

## 📚 相关资源

### 官方文档
- [Supabase 安全最佳实践](https://supabase.com/docs/guides/auth/security)
- [Next.js 环境变量](https://nextjs.org/docs/basic-features/environment-variables)

### 内部文档
- [API 配置指南](./API_CONFIGURATION_GUIDE.md)
- [前端 API 接入文档](./FRONTEND_API_DOCUMENTATION.md)
- [快速入门指南](./API_QUICK_START_GUIDE.md)

## 🚨 应急响应

### 如果密钥泄露

1. **立即行动**
   - 在 Supabase Dashboard 中撤销泄露的密钥
   - 生成新的 API 密钥
   - 更新所有环境变量

2. **代码清理**
   - 从代码库中移除硬编码的密钥
   - 检查 Git 历史记录
   - 如果需要，重写 Git 历史

3. **重新部署**
   - 使用新密钥重新部署应用
   - 验证所有功能正常工作
   - 通知团队成员更新本地环境

### 联系方式
- **技术负责人**：查看项目 README
- **安全问题**：通过内部渠道报告
- **紧急情况**：立即联系项目维护者

---

## 📋 定期安全检查

### 每月检查
- [ ] 审查 API 密钥使用情况
- [ ] 检查环境变量配置
- [ ] 运行安全扫描脚本
- [ ] 更新依赖包

### 每季度检查
- [ ] 轮换 API 密钥
- [ ] 审查访问权限
- [ ] 更新安全文档
- [ ] 培训团队成员

### 发布前检查
- [ ] 运行完整的安全扫描
- [ ] 验证生产环境配置
- [ ] 检查所有密钥都是占位符
- [ ] 确认 .env 文件不在版本控制中

---

*保持警惕，确保 API 安全！* 🔒
