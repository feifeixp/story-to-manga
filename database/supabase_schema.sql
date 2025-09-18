-- Supabase 数据库表结构
-- 请在 Supabase 控制台的 SQL 编辑器中执行这些 SQL 语句

-- 1. 用户资料表 (扩展 auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 漫画作品表
CREATE TABLE IF NOT EXISTS public.comics (
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

-- 3. 漫画面板表
CREATE TABLE IF NOT EXISTS public.comic_panels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE NOT NULL,
  panel_number INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  text_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comic_id, panel_number)
);

-- 4. 漫画点赞表
CREATE TABLE IF NOT EXISTS public.comic_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comic_id, user_id)
);

-- 5. 漫画收藏表
CREATE TABLE IF NOT EXISTS public.comic_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comic_id, user_id)
);

-- 6. 漫画浏览记录表
CREATE TABLE IF NOT EXISTS public.comic_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_comics_author_id ON public.comics(author_id);
CREATE INDEX IF NOT EXISTS idx_comics_published_at ON public.comics(published_at DESC) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_comics_likes_count ON public.comics(likes_count DESC) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_comics_views_count ON public.comics(views_count DESC) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_comics_style ON public.comics(style) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_comic_panels_comic_id ON public.comic_panels(comic_id, panel_number);
CREATE INDEX IF NOT EXISTS idx_comic_likes_comic_id ON public.comic_likes(comic_id);
CREATE INDEX IF NOT EXISTS idx_comic_likes_user_id ON public.comic_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comic_favorites_comic_id ON public.comic_favorites(comic_id);
CREATE INDEX IF NOT EXISTS idx_comic_favorites_user_id ON public.comic_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_comic_views_comic_id ON public.comic_views(comic_id);

-- 设置行级安全策略 (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comic_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comic_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comic_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comic_views ENABLE ROW LEVEL SECURITY;

-- 用户资料策略
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 漫画作品策略
CREATE POLICY "Anyone can view published comics" ON public.comics FOR SELECT USING (is_published = true);
CREATE POLICY "Authors can view own comics" ON public.comics FOR SELECT USING (auth.uid() = author_id);
CREATE POLICY "Authors can insert own comics" ON public.comics FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own comics" ON public.comics FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete own comics" ON public.comics FOR DELETE USING (auth.uid() = author_id);

-- 漫画面板策略
CREATE POLICY "Anyone can view panels of published comics" ON public.comic_panels FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.comics WHERE comics.id = comic_panels.comic_id AND comics.is_published = true)
);
CREATE POLICY "Authors can manage own comic panels" ON public.comic_panels FOR ALL USING (
  EXISTS (SELECT 1 FROM public.comics WHERE comics.id = comic_panels.comic_id AND comics.author_id = auth.uid())
);

-- 点赞策略
CREATE POLICY "Anyone can view likes" ON public.comic_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage own likes" ON public.comic_likes FOR ALL USING (auth.uid() = user_id);

-- 收藏策略
CREATE POLICY "Users can view own favorites" ON public.comic_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can manage own favorites" ON public.comic_favorites FOR ALL USING (auth.uid() = user_id);

-- 浏览记录策略
CREATE POLICY "Users can view own views" ON public.comic_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert views" ON public.comic_views FOR INSERT WITH CHECK (true);

-- 创建触发器函数来自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加触发器
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comics_updated_at BEFORE UPDATE ON public.comics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建函数来自动创建用户资料
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器在用户注册时自动创建资料
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 插入一些示例数据 (可选)
-- 注意：这些数据仅用于测试，实际使用时请删除或修改

-- 示例用户资料 (需要先有真实用户注册)
-- INSERT INTO public.profiles (id, name, avatar_url, bio) VALUES 
-- ('00000000-0000-0000-0000-000000000001', '示例作者1', 'https://via.placeholder.com/100x100/6366F1/FFFFFF?text=A1', '热爱创作漫画的艺术家'),
-- ('00000000-0000-0000-0000-000000000002', '示例作者2', 'https://via.placeholder.com/100x100/EF4444/FFFFFF?text=A2', '专注于科幻题材的创作者');

-- 示例漫画作品
-- INSERT INTO public.comics (id, title, description, author_id, author_name, cover_image, style, tags, is_published, likes_count, favorites_count, views_count, total_panels, published_at) VALUES 
-- ('11111111-1111-1111-1111-111111111111', '魔法学院的日常', '一个关于魔法学院学生生活的温馨故事', '00000000-0000-0000-0000-000000000001', '示例作者1', 'https://via.placeholder.com/300x400/8B5CF6/FFFFFF?text=Magic', 'manga', ARRAY['魔法', '校园', '日常'], true, 1234, 567, 5678, 24, NOW() - INTERVAL '5 days'),
-- ('22222222-2222-2222-2222-222222222222', '星际冒险', '在遥远的星系中展开的科幻冒险故事', '00000000-0000-0000-0000-000000000002', '示例作者2', 'https://via.placeholder.com/300x400/3B82F6/FFFFFF?text=Space', 'comic', ARRAY['科幻', '冒险', '太空'], true, 987, 234, 3456, 18, NOW() - INTERVAL '3 days');

-- 示例漫画面板
-- INSERT INTO public.comic_panels (comic_id, panel_number, image_url, text_content) VALUES 
-- ('11111111-1111-1111-1111-111111111111', 1, 'https://via.placeholder.com/800x600/8B5CF6/FFFFFF?text=Panel+1', '欢迎来到魔法学院！'),
-- ('11111111-1111-1111-1111-111111111111', 2, 'https://via.placeholder.com/800x600/8B5CF6/FFFFFF?text=Panel+2', '这里充满了神奇的魔法...'),
-- ('22222222-2222-2222-2222-222222222222', 1, 'https://via.placeholder.com/800x600/3B82F6/FFFFFF?text=Panel+1', '星际飞船准备起航！'),
-- ('22222222-2222-2222-2222-222222222222', 2, 'https://via.placeholder.com/800x600/3B82F6/FFFFFF?text=Panel+2', '目标：未知的星系...');
