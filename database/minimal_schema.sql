-- 最小化数据库架构 - 用于测试 Edge Functions
-- 在 Supabase SQL 编辑器中执行: https://supabase.com/dashboard/project/tairvnwvltidxcscsusl/sql

-- 1. 创建项目表
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  story TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'manga',
  status TEXT DEFAULT 'draft',
  visibility TEXT DEFAULT 'private',
  tags TEXT[] DEFAULT '{}',
  ai_model TEXT DEFAULT 'auto',
  user_id UUID,
  device_id TEXT,
  image_size JSONB DEFAULT '{"width": 1024, "height": 576}',
  generation_state JSONB,
  metadata JSONB DEFAULT '{}',
  r2_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保至少有一个用户标识
  CONSTRAINT projects_user_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

-- 2. 创建生成任务表
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, -- analyze_story, generate_characters, generate_panels
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  ai_model TEXT,
  user_id UUID,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. 创建分享作品表
CREATE TABLE IF NOT EXISTS public.shared_works (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  author_name TEXT,
  author_avatar TEXT,
  cover_image TEXT,
  style TEXT,
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  user_id UUID,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建点赞表
CREATE TABLE IF NOT EXISTS public.work_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_id UUID REFERENCES public.shared_works(id) ON DELETE CASCADE,
  user_id UUID,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保每个用户/设备只能点赞一次
  UNIQUE(work_id, user_id),
  UNIQUE(work_id, device_id)
);

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_device_id ON public.projects(device_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_project_id ON public.generation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON public.generation_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_works_published ON public.shared_works(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_works_user_id ON public.shared_works(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_works_device_id ON public.shared_works(device_id);

-- 6. 启用行级安全
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_likes ENABLE ROW LEVEL SECURITY;

-- 7. 创建基本 RLS 策略
-- 项目表策略
CREATE POLICY "Users can manage own projects" ON public.projects
  FOR ALL USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- 生成任务表策略
CREATE POLICY "Users can manage own jobs" ON public.generation_jobs
  FOR ALL USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- 分享作品表策略
CREATE POLICY "Users can manage own works" ON public.shared_works
  FOR ALL USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- 允许查看已发布的作品
CREATE POLICY "Anyone can view published works" ON public.shared_works
  FOR SELECT USING (is_published = true);

-- 点赞表策略
CREATE POLICY "Users can manage own likes" ON public.work_likes
  FOR ALL USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
    (auth.uid() IS NULL AND device_id IS NOT NULL)
  );

-- 8. 创建更新时间戳函数和触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表创建触发器
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generation_jobs_updated_at BEFORE UPDATE ON public.generation_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shared_works_updated_at BEFORE UPDATE ON public.shared_works
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 完成
SELECT 'Database schema created successfully!' as message;
