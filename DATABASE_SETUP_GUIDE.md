# 数据库设置指南

## 🚨 错误解决

如果你遇到 `Could not find the table 'public.comics' in the schema cache` 错误，说明 Supabase 数据库中还没有创建必要的表结构。

## 📋 快速设置步骤

### 1. 登录 Supabase 控制台
1. 访问 [https://supabase.com](https://supabase.com)
2. 登录你的账户
3. 选择你的项目：`https://tairvnwvltidxcscsusl.supabase.co`

### 2. 打开 SQL 编辑器
1. 在左侧导航栏中点击 **"SQL Editor"**
2. 点击 **"New query"** 创建新查询

### 3. 执行数据库设置脚本
1. 复制 `database/quick_setup.sql` 文件的全部内容
2. 粘贴到 SQL 编辑器中
3. 点击 **"Run"** 按钮执行脚本
4. 等待执行完成，应该看到 "Database setup completed successfully!" 消息

### 4. 验证表创建
执行以下查询来验证表是否创建成功：

```sql
-- 检查所有表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'comics', 'comic_panels', 'comic_likes', 'comic_favorites', 'comic_views');
```

应该返回 6 行结果，包含所有表名。

### 5. 检查 RLS 策略
执行以下查询来检查行级安全策略：

```sql
-- 检查 RLS 策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

应该看到多个策略被创建。

## 🔧 手动创建表（如果脚本失败）

如果自动脚本失败，你可以逐个创建表：

### 1. 创建 profiles 表
```sql
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
```

### 2. 创建 comics 表
```sql
CREATE TABLE public.comics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  cover_image TEXT,
  style TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  is_published BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  favorites_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  total_panels INTEGER DEFAULT 0
);

ALTER TABLE public.comics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published comics" ON public.comics FOR SELECT USING (is_published = true);
CREATE POLICY "Authors can view own comics" ON public.comics FOR SELECT USING (auth.uid() = author_id);
CREATE POLICY "Authors can insert own comics" ON public.comics FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own comics" ON public.comics FOR UPDATE USING (auth.uid() = author_id);
```

### 3. 创建其他表
继续创建 `comic_panels`, `comic_likes`, `comic_favorites`, `comic_views` 表，参考 `database/quick_setup.sql` 文件。

## 🧪 测试数据库连接

创建表后，你可以测试数据库连接：

### 1. 测试插入数据
```sql
-- 测试插入一个示例漫画（需要先有用户登录）
INSERT INTO public.comics (title, description, author_id, author_name, style, is_published) 
VALUES ('测试漫画', '这是一个测试漫画', auth.uid(), '测试用户', 'manga', false);
```

### 2. 测试查询数据
```sql
-- 查询所有已发布的漫画
SELECT * FROM public.comics WHERE is_published = true;
```

## 🔍 常见问题排查

### 问题 1: 权限错误
如果遇到权限错误，确保：
1. RLS 策略已正确创建
2. 用户已登录
3. 用户在 `profiles` 表中有记录

### 问题 2: 外键约束错误
如果遇到外键约束错误：
1. 确保 `profiles` 表中有对应的用户记录
2. 检查 `author_id` 是否正确

### 问题 3: 表不存在错误
如果仍然提示表不存在：
1. 刷新 Supabase 控制台
2. 检查表是否在 `public` schema 中
3. 重新执行创建表的 SQL

## 📞 获取帮助

如果遇到问题：
1. 检查 Supabase 控制台的日志
2. 确认 API 密钥和 URL 配置正确
3. 查看浏览器开发者工具的网络请求
4. 检查应用程序的错误日志

## ✅ 设置完成检查清单

- [ ] 所有 6 个表已创建
- [ ] RLS 策略已启用
- [ ] 触发器已创建
- [ ] 用户注册触发器已设置
- [ ] 测试查询成功执行
- [ ] 应用程序可以连接数据库
- [ ] 分享功能正常工作

完成这些步骤后，你的漫画分享功能应该可以正常工作了！
