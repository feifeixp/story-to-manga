#!/usr/bin/env bash
# Story to Manga - 快速环境变量配置脚本
# 基于当前 .env.local 文件的值直接配置 Edge Functions

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_REF="tairvnwvltidxcscsusl"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Story to Manga 快速环境变量配置${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 Supabase CLI
if ! command -v supabase >/dev/null 2>&1; then
  echo -e "${RED}错误: 未找到 Supabase CLI${NC}" >&2
  echo "请安装: https://supabase.com/docs/guides/cli"
  exit 1
fi

# 检查登录状态
if ! supabase projects list >/dev/null 2>&1; then
  echo -e "${RED}错误: 未登录 Supabase CLI${NC}" >&2
  echo "请先登录: supabase login"
  exit 1
fi

echo -e "${BLUE}正在配置环境变量...${NC}"
echo "项目引用: $PROJECT_REF"
echo ""

# 直接设置环境变量（基于你的 .env.local 文件）
echo -e "${YELLOW}🤖 配置 AI 服务...${NC}"
supabase secrets set \
  GOOGLE_AI_API_KEY="AIzaSyDkN7ISWA0oen2w2psrJC_CQ4L5fe97JXU" \
  VOLCENGINE_API_KEY="f8858401-aa58-49b7-bff9-9876ef8bdf14" \
  DEFAULT_AI_MODEL="auto" \
  ENABLE_MODEL_SELECTION="true" \
  --project-ref $PROJECT_REF

echo -e "${YELLOW}☁️ 配置 R2 存储...${NC}"
supabase secrets set \
  R2_ACCESS_KEY_ID="faa09717790ff70e32830f1831660579" \
  R2_SECRET_ACCESS_KEY="ca0c6b5388153aa221c181ca5589cb73dc0b87a01b3510483775ead01a8856f9" \
  R2_ACCOUNT_ID="fac7207421271dd5183fcab70164cad1" \
  R2_BUCKET_NAME="mangashare" \
  R2_ENDPOINT="https://fac7207421271dd5183fcab70164cad1.r2.cloudflarestorage.com" \
  R2_PUBLIC_DOMAIN_DEV="https://pub-23959c61a0814f2a91a19cc37b24a893.r2.dev" \
  R2_PUBLIC_DOMAIN_PROD="https://manga.neodomain.ai" \
  R2_PUBLIC_DOMAIN="https://pub-23959c61a0814f2a91a19cc37b24a893.r2.dev" \
  --project-ref $PROJECT_REF

echo -e "${YELLOW}🌐 配置应用设置...${NC}"
supabase secrets set \
  APP_URL="http://localhost:8000" \
  FRONTEND_URL="http://localhost:8000" \
  PRODUCTION_URL="https://manga.neodomain.ai" \
  APP_NAME="Story to Manga" \
  APP_VERSION="2.4.0" \
  APP_ENVIRONMENT="development" \
  --project-ref $PROJECT_REF

echo -e "${YELLOW}🎛️ 配置功能开关...${NC}"
supabase secrets set \
  ENABLE_AI_GENERATION="true" \
  ENABLE_SHARING="true" \
  ENABLE_COMMENTS="true" \
  ENABLE_ANALYTICS="true" \
  MAX_PROJECTS_PER_USER="100" \
  MAX_PANELS_PER_PROJECT="50" \
  MAX_FILE_SIZE_MB="10" \
  MAX_STORY_LENGTH="10000" \
  --project-ref $PROJECT_REF

echo -e "${YELLOW}🔧 配置可选设置...${NC}"
supabase secrets set \
  DEBUG_MODE="true" \
  LOG_LEVEL="info" \
  CACHE_TTL_SECONDS="3600" \
  ENABLE_CACHE="true" \
  ENABLE_CORS_ALL_ORIGINS="true" \
  ENABLE_REQUEST_LOGGING="true" \
  MOCK_AI_RESPONSES="false" \
  --project-ref $PROJECT_REF

echo ""
echo -e "${GREEN}✅ 环境变量配置完成！${NC}"
echo ""

# 显示已配置的变量
echo -e "${BLUE}已配置的环境变量:${NC}"
supabase secrets list --project-ref $PROJECT_REF

echo ""
echo -e "${GREEN}🎉 配置成功！${NC}"
echo ""
echo -e "${BLUE}下一步:${NC}"
echo "1. 测试 Edge Functions: npm run test:edge"
echo "2. 查看函数日志: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
echo "3. 重新部署函数: npm run deploy:edge"
echo ""
echo -e "${YELLOW}⚠️ 安全提醒:${NC}"
echo "• 你的 API 密钥已在代码中暴露，建议重新生成"
echo "• 定期轮换 API 密钥以确保安全"
echo "• 生产环境使用不同的密钥"
