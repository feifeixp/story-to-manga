# 前端 API 调用混乱情况分析

## 🚨 发现的问题

### 1. 多种API调用方式并存

#### 方式1: EdgeFunctionStorage 类
- **位置**: `src/lib/edgeFunctionStorage.ts`
- **使用**: 主应用页面 (`src/app/app/page.tsx`) 导入使用
- **特点**: 
  - 硬编码了真实的 API Key
  - 混合使用认证方式（JWT + device-id）
  - 有复杂的初始化逻辑

#### 方式2: 直接 fetch 调用
- **位置**: `src/components/ProjectManager.tsx`
- **特点**: 
  - 硬编码了真实的 API Key
  - 直接调用 Edge Functions
  - 简单的错误处理

#### 方式3: 本地 API 路由
- **位置**: `src/app/app/page.tsx` 中的大部分调用
- **特点**: 
  - 调用 `/api/*` 路由而不是直接调用 Edge Functions
  - 这些可能是旧的 API 路由

#### 方式4: Supabase 客户端
- **位置**: `src/lib/safeSupabase.ts`
- **特点**: 
  - 用于认证和一些数据操作
  - 与 Edge Functions 调用混合使用

### 2. 硬编码的 API Key 问题

**严重安全问题**：多个文件中硬编码了真实的 API Key：

```typescript
// src/lib/edgeFunctionStorage.ts:32
private readonly SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhaXJ2bnd2bHRpZHhjc2NzdXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjY3MDIsImV4cCI6MjA3Mzc0MjcwMn0.9YU03FVkvHFzhxOiJfrIACiOcK460cN9kT-or641g94';

// src/components/ProjectManager.tsx:63-64
'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhaXJ2bnd2bHRpZHhjc2NzdXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjY3MDIsImV4cCI6MjA3Mzc0MjcwMn0.9YU03FVkvHFzhxOiJfrIACiOcK460cN9kT-or641g94',
'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhaXJ2bnd2bHRpZHhjc2NzdXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNjY3MDIsImV4cCI6MjA3Mzc0MjcwMn0.9YU03FVkvHFzhxOiJfrIACiOcK460cN9kT-or641g94',
```

### 3. 混合的 API 端点

#### Edge Functions (正确的方式)
```
https://tairvnwvltidxcscsusl.supabase.co/functions/v1/projects
https://tairvnwvltidxcscsusl.supabase.co/functions/v1/project-storage-working
```

#### 本地 API 路由 (可能过时)
```
/api/generate-panel
/api/analyze-story
/api/generate-character-refs
/api/chunk-story
/api/generate-panels-batch
/api/redraw-image
/api/modify-image
```

### 4. 认证方式混乱

- **EdgeFunctionStorage**: 混合使用 JWT token 和 device-id
- **ProjectManager**: 只使用 device-id
- **主应用**: 通过本地 API 路由，认证方式不明确

## 📋 具体问题列表

### 高优先级问题

1. **安全漏洞**: 硬编码的 API Key 暴露在前端代码中
2. **API 调用不一致**: 同一功能使用不同的调用方式
3. **错误处理不统一**: 不同组件有不同的错误处理逻辑
4. **认证方式混乱**: 多种认证方式并存

### 中优先级问题

1. **代码重复**: 多处重复的 fetch 调用和头部配置
2. **环境变量未使用**: `.env.local` 中有配置但代码中硬编码
3. **调试代码残留**: 大量 console.log 和临时解决方案

### 低优先级问题

1. **文档不同步**: 代码与文档中的示例不一致
2. **类型定义缺失**: 一些 API 调用缺少 TypeScript 类型

## 🎯 建议的解决方案

### 1. 统一 API 调用方式

创建一个统一的 API 客户端：

```typescript
// src/lib/apiClient.ts
class UnifiedAPIClient {
  private baseURL: string;
  private apiKey: string;
  
  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1';
    this.apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  
  private async getHeaders(): Promise<Record<string, string>> {
    const { deviceManager } = await import('./deviceManager');
    const deviceId = await deviceManager.getDeviceId();
    
    return {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'x-device-id': deviceId,
    };
  }
  
  async request(endpoint: string, options: RequestInit = {}) {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
}
```

### 2. 移除硬编码的 API Key

所有 API Key 都应该从环境变量获取：

```typescript
// 错误的方式
private readonly SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// 正确的方式
private readonly SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
```

### 3. 统一错误处理

创建统一的错误处理机制：

```typescript
// src/lib/errorHandler.ts
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export const handleAPIError = (error: unknown): APIError => {
  if (error instanceof APIError) {
    return error;
  }
  
  if (error instanceof Error) {
    if (error.message === 'Failed to fetch') {
      return new APIError('网络连接失败，请检查网络连接');
    }
    return new APIError(error.message);
  }
  
  return new APIError('未知错误');
};
```

### 4. 迁移计划

#### 阶段1: 安全修复 (立即执行)
- [ ] 移除所有硬编码的 API Key
- [ ] 使用环境变量替代硬编码值
- [ ] 验证环境变量配置

#### 阶段2: API 统一 (1-2天)
- [ ] 创建统一的 API 客户端
- [ ] 迁移 ProjectManager 使用统一客户端
- [ ] 迁移 EdgeFunctionStorage 使用统一客户端

#### 阶段3: 清理和优化 (2-3天)
- [ ] 移除重复的 API 调用代码
- [ ] 统一错误处理
- [ ] 添加适当的 TypeScript 类型
- [ ] 清理调试代码

## 🔧 立即行动项

1. **紧急安全修复**: 移除硬编码的 API Key
2. **创建统一客户端**: 实现 UnifiedAPIClient
3. **测试验证**: 确保所有功能正常工作
4. **文档更新**: 更新相关文档

## 📊 影响评估

- **安全风险**: 高 (硬编码 API Key)
- **维护成本**: 高 (多种调用方式)
- **开发效率**: 中 (代码重复和不一致)
- **用户体验**: 中 (错误处理不一致)

这个分析显示前端确实存在严重的 API 调用混乱问题，需要立即进行整理和修复。
