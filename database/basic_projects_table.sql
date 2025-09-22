-- 基本项目表创建脚本
-- 在 Supabase SQL 编辑器中执行

-- 创建项目表
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  story TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'manga',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed', 'published')),
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'shared')),
  tags TEXT[] DEFAULT '{}',
  ai_model TEXT DEFAULT 'auto',
  user_id UUID,
  device_id TEXT,
  image_size JSONB DEFAULT '{"width": 1024, "height": 576, "aspectRatio": "16:9"}',
  generation_state JSONB,
  metadata JSONB DEFAULT '{"panel_count": 0, "character_count": 0, "estimated_read_time": 0, "language": "zh"}',
  r2_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保至少有一个用户标识
  CONSTRAINT projects_user_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_device_id ON public.projects(device_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON public.projects(visibility);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

-- 启用行级安全
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
-- 允许匿名用户基于 device_id 访问自己的项目
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- 允许查看公开项目
CREATE POLICY "Anyone can view public projects" ON public.projects
  FOR SELECT USING (visibility = 'public');
