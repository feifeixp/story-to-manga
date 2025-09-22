-- 创建已发布作品表
CREATE TABLE IF NOT EXISTS published_works (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_published_works_author_id ON published_works(author_id);
CREATE INDEX IF NOT EXISTS idx_published_works_project_id ON published_works(project_id);
CREATE INDEX IF NOT EXISTS idx_published_works_is_published ON published_works(is_published);
CREATE INDEX IF NOT EXISTS idx_published_works_created_at ON published_works(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_published_works_view_count ON published_works(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_published_works_like_count ON published_works(like_count DESC);

-- 创建唯一约束：每个用户的每个项目只能有一个发布记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_published_works_unique_project_author 
ON published_works(project_id, author_id);

-- 启用行级安全策略
ALTER TABLE published_works ENABLE ROW LEVEL SECURITY;

-- 创建安全策略
-- 1. 任何人都可以查看已发布的公开作品
CREATE POLICY "Anyone can view published public works" ON published_works
  FOR SELECT USING (is_published = true AND visibility = 'public');

-- 2. 用户可以查看自己的所有作品
CREATE POLICY "Users can view their own works" ON published_works
  FOR SELECT USING (auth.uid() = author_id);

-- 3. 用户可以插入自己的作品
CREATE POLICY "Users can insert their own works" ON published_works
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- 4. 用户可以更新自己的作品
CREATE POLICY "Users can update their own works" ON published_works
  FOR UPDATE USING (auth.uid() = author_id);

-- 5. 用户可以删除自己的作品
CREATE POLICY "Users can delete their own works" ON published_works
  FOR DELETE USING (auth.uid() = author_id);

-- 创建更新时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_published_works_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_published_works_updated_at ON published_works;
CREATE TRIGGER trigger_update_published_works_updated_at
  BEFORE UPDATE ON published_works
  FOR EACH ROW
  EXECUTE FUNCTION update_published_works_updated_at();

-- 创建用户交互表（点赞、收藏等）
CREATE TABLE IF NOT EXISTS user_work_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_id UUID NOT NULL REFERENCES published_works(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('like', 'favorite', 'view')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建唯一约束：每个用户对每个作品的每种交互类型只能有一条记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_work_interactions_unique 
ON user_work_interactions(user_id, work_id, interaction_type);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_work_interactions_user_id ON user_work_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_work_interactions_work_id ON user_work_interactions(work_id);
CREATE INDEX IF NOT EXISTS idx_user_work_interactions_type ON user_work_interactions(interaction_type);

-- 启用行级安全策略
ALTER TABLE user_work_interactions ENABLE ROW LEVEL SECURITY;

-- 创建安全策略
-- 1. 用户可以查看自己的交互记录
CREATE POLICY "Users can view their own interactions" ON user_work_interactions
  FOR SELECT USING (auth.uid() = user_id);

-- 2. 用户可以插入自己的交互记录
CREATE POLICY "Users can insert their own interactions" ON user_work_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. 用户可以更新自己的交互记录
CREATE POLICY "Users can update their own interactions" ON user_work_interactions
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. 用户可以删除自己的交互记录
CREATE POLICY "Users can delete their own interactions" ON user_work_interactions
  FOR DELETE USING (auth.uid() = user_id);

-- 创建更新统计数据的函数
CREATE OR REPLACE FUNCTION update_work_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 增加统计
    IF NEW.interaction_type = 'like' THEN
      UPDATE published_works SET like_count = like_count + 1 WHERE id = NEW.work_id;
    ELSIF NEW.interaction_type = 'favorite' THEN
      UPDATE published_works SET favorite_count = favorite_count + 1 WHERE id = NEW.work_id;
    ELSIF NEW.interaction_type = 'view' THEN
      UPDATE published_works SET view_count = view_count + 1 WHERE id = NEW.work_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- 减少统计
    IF OLD.interaction_type = 'like' THEN
      UPDATE published_works SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.work_id;
    ELSIF OLD.interaction_type = 'favorite' THEN
      UPDATE published_works SET favorite_count = GREATEST(favorite_count - 1, 0) WHERE id = OLD.work_id;
    ELSIF OLD.interaction_type = 'view' THEN
      UPDATE published_works SET view_count = GREATEST(view_count - 1, 0) WHERE id = OLD.work_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_update_work_stats ON user_work_interactions;
CREATE TRIGGER trigger_update_work_stats
  AFTER INSERT OR DELETE ON user_work_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_work_stats();
