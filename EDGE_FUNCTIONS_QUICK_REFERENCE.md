# Edge Functions 快速参考

## 🚀 常用端点

### 项目管理
```bash
# 获取项目列表
GET https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects

# 创建项目
POST https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects

# 删除项目
DELETE https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects?projectId=xxx
```

### 项目数据
```bash
# 保存数据
POST https://tairvnwvltidxcscsusl.supabase.co/functions/v1/project-storage-working

# 加载数据
GET https://tairvnwvltidxcscsusl.supabase.co/functions/v1/project-storage-working?projectId=xxx
```

## 🔐 认证头模板

### 已登录用户
```javascript
const headers = {
  'Content-Type': 'application/json',
  'apikey': 'YOUR_SUPABASE_ANON_KEY',
  'authorization': `Bearer ${userJwtToken}`,
};
```

### 匿名用户
```javascript
const headers = {
  'Content-Type': 'application/json',
  'apikey': 'YOUR_SUPABASE_ANON_KEY',
  'authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
  'x-device-id': deviceId,
};
```

## 📱 前端调用示例

### 使用 EdgeFunctionStorage
```typescript
import { edgeFunctionStorage } from '@/lib/edgeFunctionStorage';

// 项目操作
const projects = await edgeFunctionStorage.getProjectList();
const project = await edgeFunctionStorage.createProject({...});
await edgeFunctionStorage.deleteProject(projectId);

// 数据操作
await edgeFunctionStorage.saveProjectData(projectId, ...);
const data = await edgeFunctionStorage.loadProjectData(projectId);
```

### 直接 API 调用
```typescript
// 获取项目列表
const response = await fetch('https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'x-device-id': 'device-123',
  },
});

const result = await response.json();
```

## 🔧 故障排除

### "Failed to fetch" 错误
1. 检查网络连接
2. 验证请求头格式
3. 使用直接 API 调用测试
4. 检查 CORS 设置

### 认证失败
1. 确认 JWT token 有效
2. 检查设备ID生成
3. 验证请求头完整性

### 数据不同步
1. 确认项目ID正确
2. 检查用户/设备ID匹配
3. 验证数据库权限

## 📊 状态码说明

| 状态码 | 含义 | 处理方式 |
|--------|------|----------|
| 200 | 成功 | 正常处理响应数据 |
| 400 | 请求错误 | 检查请求参数 |
| 401 | 认证失败 | 重新获取认证信息 |
| 403 | 权限不足 | 检查用户权限 |
| 404 | 资源不存在 | 确认资源ID正确 |
| 500 | 服务器错误 | 重试或联系支持 |

## 🎯 最佳实践

1. **错误处理**: 始终包装 try-catch
2. **重试机制**: 网络错误时自动重试
3. **缓存策略**: 合理缓存项目列表
4. **认证管理**: 统一认证状态管理
5. **日志记录**: 详细记录调用日志

## 🔍 调试工具

### 浏览器控制台测试
```javascript
// 快速测试项目列表
fetch('https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects', {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'x-device-id': 'test-device'
  }
}).then(r => r.json()).then(console.log);
```

### cURL 测试
```bash
# 测试项目列表
curl -X GET "https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-device-id: test-device"
```

## 📞 支持信息

- **文档**: 查看 `EDGE_FUNCTIONS_GUIDE.md`
- **测试工具**: 访问 `/system-diagnosis` 页面
- **认证测试**: 访问 `/auth-persistence-test` 页面
- **连接测试**: 访问 `/exact-test` 页面
