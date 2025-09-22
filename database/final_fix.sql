-- 最终修复数据库架构问题
-- 在 Supabase SQL 编辑器中执行

-- 1. 重命名 job_type 列为 type（Edge Function 期望的列名）
ALTER TABLE public.generation_jobs 
RENAME COLUMN job_type TO type;

-- 2. 验证修复
SELECT 'Final database fixes applied successfully!' as message;

-- 3. 查看 generation_jobs 表的最终结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'generation_jobs' 
AND table_schema = 'public'
ORDER BY ordinal_position;
