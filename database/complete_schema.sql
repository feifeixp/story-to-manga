-- 完整的数据库架构 - Story to Manga Edge Functions
-- 请在 Supabase 控制台的 SQL 编辑器中执行这个脚本

-- 1. 创建更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. 创建项目表（增强版）
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY, -- 项目ID，格式如 project-1758354121152-abc123
  name TEXT NOT NULL,
  description TEXT,
  story TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'manga', -- manga, comic, etc.
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed', 'published')),
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public', 'shared')),
  tags TEXT[] DEFAULT '{}',
  ai_model TEXT DEFAULT 'auto',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- 认证用户
  device_id TEXT, -- 匿名用户设备ID
  image_size JSONB DEFAULT '{"width": 1024, "height": 576, "aspectRatio": "16:9"}',
  generation_state JSONB,
  metadata JSONB DEFAULT '{"panel_count": 0, "character_count": 0, "estimated_read_time": 0, "language": "zh"}',
  r2_path TEXT, -- R2存储路径前缀
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保至少有一个用户标识
  CONSTRAINT projects_user_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

-- 3. 创建项目文件表
CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  file_type TEXT NOT NULL, -- story, metadata, character_ref, panel, etc.
  file_path TEXT NOT NULL, -- R2中的完整路径
  file_url TEXT, -- 公开访问URL
  file_size INTEGER,
  content_type TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(project_id, file_type, file_path)
);

-- 4. 创建生成任务表
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id TEXT PRIMARY KEY, -- job-1758354121152-abc123
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('story_analysis', 'character_generation', 'panel_generation', 'batch_generation')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  input_data JSONB NOT NULL,
  result_data JSONB,
  error_message TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  -- 确保至少有一个用户标识
  CONSTRAINT generation_jobs_user_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

-- 5. 创建分享作品表
CREATE TABLE IF NOT EXISTS public.shared_works (
  id TEXT PRIMARY KEY, -- share-1758354121152-abc123
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  share_url TEXT NOT NULL,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted')),
  tags TEXT[] DEFAULT '{}',
  stats JSONB DEFAULT '{"views": 0, "likes": 0, "comments": 0, "shares": 0}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保至少有一个用户标识
  CONSTRAINT shared_works_user_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL),
  -- 确保每个项目只能发布一次
  UNIQUE(project_id)
);

-- 6. 创建评论表
CREATE TABLE IF NOT EXISTS public.work_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_work_id TEXT REFERENCES public.shared_works(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保至少有一个用户标识
  CONSTRAINT work_comments_user_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

-- 7. 创建点赞表
CREATE TABLE IF NOT EXISTS public.work_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_work_id TEXT REFERENCES public.shared_works(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保至少有一个用户标识
  CONSTRAINT work_likes_user_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL),
  -- 防止重复点赞
  UNIQUE(shared_work_id, user_id),
  UNIQUE(shared_work_id, device_id)
);

-- 8. 创建用户资料表（扩展）
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  preferences JSONB DEFAULT '{"language": "zh", "theme": "light", "notifications": true}',
  subscription JSONB DEFAULT '{"plan": "free", "expires_at": null}',
  stats JSONB DEFAULT '{"projects_created": 0, "works_published": 0, "total_views": 0, "total_likes": 0}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. 创建设备信息表
CREATE TABLE IF NOT EXISTS public.device_info (
  device_id TEXT PRIMARY KEY,
  device_type TEXT, -- web, mobile, etc.
  user_agent TEXT,
  ip_address INET,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. 创建索引
-- 项目表索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_device_id ON public.projects(device_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON public.projects(visibility);
CREATE INDEX IF NOT EXISTS idx_projects_tags ON public.projects USING GIN(tags);

-- 项目文件表索引
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_type ON public.project_files(file_type);

-- 生成任务表索引
CREATE INDEX IF NOT EXISTS idx_generation_jobs_project_id ON public.generation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON public.generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_device_id ON public.generation_jobs(device_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON public.generation_jobs(created_at DESC);

-- 分享作品表索引
CREATE INDEX IF NOT EXISTS idx_shared_works_visibility ON public.shared_works(visibility);
CREATE INDEX IF NOT EXISTS idx_shared_works_published_at ON public.shared_works(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_works_tags ON public.shared_works USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_shared_works_stats_views ON public.shared_works((stats->>'views')::int DESC);
CREATE INDEX IF NOT EXISTS idx_shared_works_stats_likes ON public.shared_works((stats->>'likes')::int DESC);

-- 评论表索引
CREATE INDEX IF NOT EXISTS idx_work_comments_shared_work_id ON public.work_comments(shared_work_id);
CREATE INDEX IF NOT EXISTS idx_work_comments_created_at ON public.work_comments(created_at DESC);

-- 点赞表索引
CREATE INDEX IF NOT EXISTS idx_work_likes_shared_work_id ON public.work_likes(shared_work_id);

-- 用户资料表索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);

-- 11. 启用行级安全策略 (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_info ENABLE ROW LEVEL SECURITY;

-- 12. 创建触发器
CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON public.projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generation_jobs_updated_at 
  BEFORE UPDATE ON public.generation_jobs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shared_works_updated_at 
  BEFORE UPDATE ON public.shared_works 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_comments_updated_at 
  BEFORE UPDATE ON public.work_comments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON public.user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 注意：RLS 策略请单独执行 database/rls_policies.sql 文件

-- 完成
SELECT 'Complete database schema created successfully!' as message;
SELECT 'Please run database/rls_policies.sql separately for RLS policies.' as note;
