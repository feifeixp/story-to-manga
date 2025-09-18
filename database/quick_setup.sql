-- 快速设置 Supabase 数据库表
-- 请在 Supabase 控制台的 SQL 编辑器中执行这个脚本

-- 1. 创建用户资料表
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建漫画作品表
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

-- 3. 创建漫画面板表
CREATE TABLE IF NOT EXISTS public.comic_panels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE NOT NULL,
  panel_number INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  text_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comic_id, panel_number)
);

-- 4. 创建漫画点赞表
CREATE TABLE IF NOT EXISTS public.comic_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comic_id, user_id)
);

-- 5. 创建漫画收藏表
CREATE TABLE IF NOT EXISTS public.comic_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comic_id, user_id)
);

-- 6. 创建漫画浏览记录表
CREATE TABLE IF NOT EXISTS public.comic_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comic_id UUID REFERENCES public.comics(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 启用行级安全策略 (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comic_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comic_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comic_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comic_views ENABLE ROW LEVEL SECURITY;

-- 8. 创建基本的 RLS 策略
-- 用户资料策略
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 漫画作品策略
DROP POLICY IF EXISTS "Anyone can view published comics" ON public.comics;
CREATE POLICY "Anyone can view published comics" ON public.comics FOR SELECT USING (is_published = true);

DROP POLICY IF EXISTS "Authors can view own comics" ON public.comics;
CREATE POLICY "Authors can view own comics" ON public.comics FOR SELECT USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can insert own comics" ON public.comics;
CREATE POLICY "Authors can insert own comics" ON public.comics FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can update own comics" ON public.comics;
CREATE POLICY "Authors can update own comics" ON public.comics FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete own comics" ON public.comics;
CREATE POLICY "Authors can delete own comics" ON public.comics FOR DELETE USING (auth.uid() = author_id);

-- 漫画面板策略
DROP POLICY IF EXISTS "Anyone can view panels of published comics" ON public.comic_panels;
CREATE POLICY "Anyone can view panels of published comics" ON public.comic_panels FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.comics WHERE comics.id = comic_panels.comic_id AND comics.is_published = true)
);

DROP POLICY IF EXISTS "Authors can manage own comic panels" ON public.comic_panels;
CREATE POLICY "Authors can manage own comic panels" ON public.comic_panels FOR ALL USING (
  EXISTS (SELECT 1 FROM public.comics WHERE comics.id = comic_panels.comic_id AND comics.author_id = auth.uid())
);

-- 点赞策略
DROP POLICY IF EXISTS "Anyone can view likes" ON public.comic_likes;
CREATE POLICY "Anyone can view likes" ON public.comic_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage own likes" ON public.comic_likes;
CREATE POLICY "Authenticated users can manage own likes" ON public.comic_likes FOR ALL USING (auth.uid() = user_id);

-- 收藏策略
DROP POLICY IF EXISTS "Users can view own favorites" ON public.comic_favorites;
CREATE POLICY "Users can view own favorites" ON public.comic_favorites FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can manage own favorites" ON public.comic_favorites;
CREATE POLICY "Authenticated users can manage own favorites" ON public.comic_favorites FOR ALL USING (auth.uid() = user_id);

-- 浏览记录策略
DROP POLICY IF EXISTS "Users can view own views" ON public.comic_views;
CREATE POLICY "Users can view own views" ON public.comic_views FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can insert views" ON public.comic_views;
CREATE POLICY "Anyone can insert views" ON public.comic_views FOR INSERT WITH CHECK (true);

-- 9. 创建自动更新时间戳的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 10. 创建触发器
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comics_updated_at ON public.comics;
CREATE TRIGGER update_comics_updated_at BEFORE UPDATE ON public.comics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. 创建自动创建用户资料的函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. 创建用户注册触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 完成提示
SELECT 'Database setup completed successfully!' as message;
