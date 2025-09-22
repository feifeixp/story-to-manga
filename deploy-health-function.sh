#!/bin/bash

# 部署 Health Edge Function 到 Supabase
# 使用提供的 Supabase 项目配置

set -e

echo "🚀 开始部署 Health Edge Function..."

# 检查 Supabase CLI 是否已安装
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI 未安装。请先安装 Supabase CLI。"
    echo "   安装命令: npm install -g supabase"
    exit 1
fi

# 检查是否已登录 Supabase
echo "🔐 检查 Supabase 登录状态..."
if ! supabase projects list &> /dev/null; then
    echo "❌ 未登录 Supabase。请先登录："
    echo "   supabase login"
    exit 1
fi

# 设置项目引用
PROJECT_REF="tairvnwvltidxcscsusl"
echo "📋 使用项目引用: $PROJECT_REF"

# 检查 health 函数是否存在
if [ ! -f "supabase/functions/health/index.ts" ]; then
    echo "❌ Health 函数文件不存在: supabase/functions/health/index.ts"
    exit 1
fi

echo "✅ Health 函数文件已找到"

# 链接到项目（如果尚未链接）
echo "🔗 链接到 Supabase 项目..."
supabase link --project-ref $PROJECT_REF || echo "⚠️  项目可能已经链接"

# 部署 health 函数
echo "📦 部署 health 函数..."
supabase functions deploy health --project-ref $PROJECT_REF

if [ $? -eq 0 ]; then
    echo "✅ Health 函数部署成功！"
    echo ""
    echo "🌐 函数 URL:"
    echo "   https://tairvnwvltidxcscsusl.supabase.co/functions/v1/health"
    echo ""
    echo "🧪 测试命令:"
    echo "   curl https://tairvnwvltidxcscsusl.supabase.co/functions/v1/health"
    echo ""
    echo "📊 带认证的测试命令:"
    echo "   curl -H \"Authorization: Bearer YOUR_ANON_KEY\" https://tairvnwvltidxcscsusl.supabase.co/functions/v1/health"
else
    echo "❌ Health 函数部署失败"
    exit 1
fi

echo "🎉 部署完成！"
