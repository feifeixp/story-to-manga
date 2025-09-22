-- 修复数据库架构问题
-- 在 Supabase SQL 编辑器中执行

-- 1. 为 generation_jobs 表添加缺少的列
ALTER TABLE public.generation_jobs 
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

-- 2. 为 shared_works 表添加缺少的列
ALTER TABLE public.shared_works 
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('private', 'public', 'shared'));

-- 3. 为 shared_works 表添加其他可能需要的列
ALTER TABLE public.shared_works 
ADD COLUMN IF NOT EXISTS total_panels INTEGER DEFAULT 0;

-- 4. 更新索引
CREATE INDEX IF NOT EXISTS idx_generation_jobs_progress ON public.generation_jobs(progress);
CREATE INDEX IF NOT EXISTS idx_shared_works_visibility ON public.shared_works(visibility);

-- 5. 更新 RLS 策略以支持新的 visibility 列
DROP POLICY IF EXISTS "Anyone can view published works" ON public.shared_works;

-- 创建新的策略支持 visibility
CREATE POLICY "Anyone can view public works" ON public.shared_works
  FOR SELECT USING (visibility = 'public' AND is_published = true);

-- 6. 验证表结构
SELECT 'Schema fixes applied successfully!' as message;

-- 查看更新后的表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'generation_jobs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'shared_works' 
AND table_schema = 'public'
ORDER BY ordinal_position;
