-- 修复分享功能的数据库架构
-- 在 Supabase SQL 编辑器中执行

-- 1. 为 shared_works 表添加缺少的列
ALTER TABLE public.shared_works 
ADD COLUMN IF NOT EXISTS share_url TEXT;

-- 2. 为 shared_works 表添加其他可能需要的列
ALTER TABLE public.shared_works 
ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{"views": 0, "likes": 0, "comments": 0, "shares": 0}';

-- 3. 更新现有记录的 share_url（如果有的话）
UPDATE public.shared_works 
SET share_url = CONCAT('https://manga.neodomain.ai/public/', id)
WHERE share_url IS NULL;

-- 4. 创建索引以提高性能
CREATE INDEX IF NOT EXISTS idx_shared_works_share_url ON public.shared_works(share_url);

-- 5. 验证表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'shared_works' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. 显示成功消息
SELECT 'Sharing schema fixes applied successfully!' as message;
