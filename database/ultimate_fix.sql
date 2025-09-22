-- 终极修复数据库架构问题
-- 在 Supabase SQL 编辑器中执行

-- 1. 重命名 output_data 列为 result_data（Edge Function 期望的列名）
ALTER TABLE public.generation_jobs 
RENAME COLUMN output_data TO result_data;

-- 2. 验证修复
SELECT 'Ultimate database fixes applied successfully!' as message;

-- 3. 查看 generation_jobs 表的最终结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'generation_jobs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. 显示所有相关表的结构
SELECT 'Projects table:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'Generation Jobs table:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'generation_jobs' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'Shared Works table:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shared_works' AND table_schema = 'public'
ORDER BY ordinal_position;
