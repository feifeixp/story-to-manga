-- 创建项目管理相关的表
-- 请在 Supabase 控制台的 SQL 编辑器中执行这个脚本

-- 1. 创建项目表（用于项目管理）
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY, -- 项目ID，格式如 project-1758354121152-abc123
  name TEXT NOT NULL,
  description TEXT,
  story TEXT NOT NULL,
  style TEXT NOT NULL, -- manga, comic, etc.
  ai_model TEXT DEFAULT 'auto',
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- 认证用户
  device_id TEXT, -- 匿名用户设备ID
  image_size JSONB DEFAULT '{"width": 1024, "height": 576, "aspectRatio": "16:9"}',
  generation_state JSONB,
  r2_path TEXT, -- R2存储路径前缀
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 确保至少有一个用户标识
  CONSTRAINT projects_user_check CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

-- 2. 创建项目文件表（跟踪R2中的文件）
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

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_device_id ON public.projects(device_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_type ON public.project_files(file_type);

-- 4. 启用行级安全策略 (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- 5. 创建RLS策略 - 项目表
-- 用户只能访问自己的项目（通过user_id或device_id）
CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT USING (
    auth.uid() = user_id OR 
    device_id IS NOT NULL
  );

CREATE POLICY "Users can insert their own projects" ON public.projects
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    device_id IS NOT NULL
  );

CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    device_id IS NOT NULL
  );

CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE USING (
    auth.uid() = user_id OR 
    device_id IS NOT NULL
  );

-- 6. 创建RLS策略 - 项目文件表
CREATE POLICY "Users can view their project files" ON public.project_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_files.project_id 
      AND (projects.user_id = auth.uid() OR projects.device_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can insert their project files" ON public.project_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_files.project_id 
      AND (projects.user_id = auth.uid() OR projects.device_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can update their project files" ON public.project_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_files.project_id 
      AND (projects.user_id = auth.uid() OR projects.device_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can delete their project files" ON public.project_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_files.project_id 
      AND (projects.user_id = auth.uid() OR projects.device_id IS NOT NULL)
    )
  );

-- 7. 创建触发器来自动更新 updated_at 字段
CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON public.projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 完成
SELECT 'Projects tables created successfully!' as message;
