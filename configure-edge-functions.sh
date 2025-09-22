#!/bin/bash

# Edge Functions 环境变量配置脚本
# 使用方法: ./configure-edge-functions.sh

set -e

PROJECT_REF="tairvnwvltidxcscsusl"

echo "🔧 配置 Edge Functions 环境变量..."
echo "项目引用: $PROJECT_REF"
echo ""

# 检查 Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI 未安装，请先安装："
    echo "   npm install -g supabase"
    exit 1
fi

# AI 服务配置
echo "📡 配置 AI 服务..."
supabase secrets set --project-ref $PROJECT_REF \
  GOOGLE_AI_API_KEY="AIzaSyDkN7ISWA0oen2w2psrJC_CQ4L5fe97JXU" \
  VOLCENGINE_API_KEY="f8858401-aa58-49b7-bff9-9876ef8bdf14" \
  DEFAULT_AI_MODEL="auto" \
  ENABLE_MODEL_SELECTION="true"

# R2 存储配置
echo "☁️ 配置 R2 存储..."
supabase secrets set --project-ref $PROJECT_REF \
  R2_ACCESS_KEY_ID="faa09717790ff70e32830f1831660579" \
  R2_SECRET_ACCESS_KEY="ca0c6b5388153aa221c181ca5589cb73dc0b87a01b3510483775ead01a8856f9" \
  R2_ACCOUNT_ID="fac7207421271dd5183fcab70164cad1" \
  R2_BUCKET_NAME="mangashare" \
  R2_ENDPOINT="https://fac7207421271dd5183fcab70164cad1.r2.cloudflarestorage.com"

# R2 公开域名配置
echo "🌐 配置 R2 公开域名..."
supabase secrets set --project-ref $PROJECT_REF \
  R2_PUBLIC_DOMAIN_DEV="https://pub-23959c61a0814f2a91a19cc37b24a893.r2.dev" \
  R2_PUBLIC_DOMAIN_PROD="https://manga.neodomain.ai" \
  R2_PUBLIC_DOMAIN="https://pub-23959c61a0814f2a91a19cc37b24a893.r2.dev"

# 应用配置
echo "⚙️ 配置应用设置..."
supabase secrets set --project-ref $PROJECT_REF \
  APP_URL="http://localhost:8000" \
  FRONTEND_URL="http://localhost:8000" \
  PRODUCTION_URL="https://manga.neodomain.ai" \
  APP_NAME="Story to Manga" \
  APP_VERSION="2.4.0" \
  APP_ENVIRONMENT="development"

# 功能配置
echo "🎛️ 配置功能开关..."
supabase secrets set --project-ref $PROJECT_REF \
  ENABLE_AI_GENERATION="true" \
  ENABLE_SHARING="true" \
  ENABLE_COMMENTS="true" \
  ENABLE_ANALYTICS="true" \
  MAX_PROJECTS_PER_USER="100" \
  MAX_PANELS_PER_PROJECT="50" \
  MAX_FILE_SIZE_MB="10" \
  MAX_STORY_LENGTH="10000"

# 可选配置
echo "🔧 配置可选设置..."
supabase secrets set --project-ref $PROJECT_REF \
  DEBUG_MODE="true" \
  LOG_LEVEL="info" \
  CACHE_TTL_SECONDS="3600" \
  ENABLE_CACHE="true"

echo ""
echo "✅ Edge Functions 环境变量配置完成！"
echo ""
echo "📋 已配置的变量："
echo "   • AI 服务: Google AI, VolcEngine"
echo "   • 存储: Cloudflare R2"
echo "   • 应用: 基础配置和功能开关"
echo "   • 限制: 用户和项目限制"
echo ""
echo "🔍 验证配置："
echo "   supabase secrets list --project-ref $PROJECT_REF"
echo ""
echo "🧪 测试 Edge Functions："
echo "   npm run test:edge"
