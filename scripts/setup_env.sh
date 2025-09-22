#!/usr/bin/env bash
# Story to Manga - 环境变量设置助手
# 
# 用法：
#   bash scripts/setup_env.sh                    # 交互式设置
#   bash scripts/setup_env.sh --auto             # 自动从 .env.local 复制
#   bash scripts/setup_env.sh --env dev          # 设置开发环境
#   bash scripts/setup_env.sh --env prod         # 设置生产环境

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_LOCAL="$BASE_DIR/.env.local"

# 参数解析
AUTO_MODE=false
TARGET_ENV=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --auto)
      AUTO_MODE=true
      shift
      ;;
    --env)
      TARGET_ENV="$2"
      shift 2
      ;;
    *)
      echo "未知参数: $1"
      echo "用法: bash scripts/setup_env.sh [--auto] [--env dev|prod]"
      exit 1
      ;;
  esac
done

# 显示标题
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Story to Manga 环境变量设置助手${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 .env.local 是否存在
if [ ! -f "$ENV_LOCAL" ]; then
  echo -e "${RED}错误: 未找到 .env.local 文件${NC}"
  echo "请先从 .env.example 创建 .env.local 文件"
  exit 1
fi

# 自动模式：从 .env.local 提取变量
if [ "$AUTO_MODE" = true ]; then
  echo -e "${BLUE}自动模式: 从 .env.local 提取变量...${NC}"
  
  # 创建开发环境文件
  DEV_FILE="$BASE_DIR/supabase/.env.development.local"
  echo "# 从 .env.local 自动生成 - $(date)" > "$DEV_FILE"
  echo "" >> "$DEV_FILE"
  
  # 提取相关变量
  grep -E '^(GOOGLE_AI_API_KEY|VOLCENGINE_API_KEY|R2_|APP_|FRONTEND_|PRODUCTION_)' "$ENV_LOCAL" >> "$DEV_FILE" || true
  
  # 添加开发环境特定配置
  cat >> "$DEV_FILE" << 'EOF'

# Development specific
DEFAULT_AI_MODEL=auto
ENABLE_MODEL_SELECTION=true
APP_ENVIRONMENT=development
DEBUG_MODE=true
LOG_LEVEL=debug
ENABLE_AI_GENERATION=true
ENABLE_SHARING=true
ENABLE_COMMENTS=true
ENABLE_ANALYTICS=true
MAX_PROJECTS_PER_USER=100
MAX_PANELS_PER_PROJECT=50
MAX_FILE_SIZE_MB=10
MAX_STORY_LENGTH=10000
CACHE_TTL_SECONDS=3600
ENABLE_CACHE=true
ENABLE_CORS_ALL_ORIGINS=true
ENABLE_REQUEST_LOGGING=true
MOCK_AI_RESPONSES=false
EOF

  echo -e "${GREEN}✅ 已创建: $DEV_FILE${NC}"
  
  # 创建生产环境文件
  PROD_FILE="$BASE_DIR/supabase/.env.production.local"
  cp "$DEV_FILE" "$PROD_FILE"
  
  # 修改生产环境特定配置
  sed -i.bak 's/APP_ENVIRONMENT=development/APP_ENVIRONMENT=production/' "$PROD_FILE"
  sed -i.bak 's/DEBUG_MODE=true/DEBUG_MODE=false/' "$PROD_FILE"
  sed -i.bak 's/LOG_LEVEL=debug/LOG_LEVEL=info/' "$PROD_FILE"
  sed -i.bak 's/ENABLE_CORS_ALL_ORIGINS=true/ENABLE_CORS_ALL_ORIGINS=false/' "$PROD_FILE"
  sed -i.bak 's/ENABLE_REQUEST_LOGGING=true/ENABLE_REQUEST_LOGGING=false/' "$PROD_FILE"
  rm -f "$PROD_FILE.bak"
  
  echo -e "${GREEN}✅ 已创建: $PROD_FILE${NC}"
  echo ""
  echo -e "${YELLOW}下一步:${NC}"
  echo "1. 检查并编辑生成的文件"
  echo "2. 导入到 Supabase: bash scripts/import_secrets.sh dev"
  
  exit 0
fi

# 交互式模式
if [ -z "$TARGET_ENV" ]; then
  echo "请选择要设置的环境:"
  echo "1) 开发环境 (development)"
  echo "2) 生产环境 (production)"
  echo "3) 两者都设置"
  read -p "请选择 (1-3): " choice
  
  case $choice in
    1) TARGET_ENV="dev" ;;
    2) TARGET_ENV="prod" ;;
    3) TARGET_ENV="both" ;;
    *) echo "无效选择"; exit 1 ;;
  esac
fi

# 设置函数
setup_env_file() {
  local env_type=$1
  local env_file=""
  local env_name=""
  
  if [ "$env_type" = "dev" ]; then
    env_file="$BASE_DIR/supabase/.env.development.local"
    env_name="开发环境"
  else
    env_file="$BASE_DIR/supabase/.env.production.local"
    env_name="生产环境"
  fi
  
  echo -e "${BLUE}设置 $env_name...${NC}"
  
  # 从模板复制
  if [ "$env_type" = "dev" ]; then
    cp "$BASE_DIR/supabase/.env.development" "$env_file"
  else
    cp "$BASE_DIR/supabase/.env.production" "$env_file"
  fi
  
  # 从 .env.local 提取值
  echo "# 从 .env.local 提取的值 - $(date)" >> "$env_file"
  
  # 提取并设置变量
  while IFS='=' read -r key value; do
    if [[ $key =~ ^(GOOGLE_AI_API_KEY|VOLCENGINE_API_KEY|R2_.*|APP_URL|FRONTEND_URL|PRODUCTION_URL)$ ]]; then
      # 替换文件中的空值
      if grep -q "^${key}=$" "$env_file"; then
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$env_file"
      else
        echo "${key}=${value}" >> "$env_file"
      fi
    fi
  done < <(grep -E '^[A-Z_]+=.*' "$ENV_LOCAL" | grep -v '^#')
  
  rm -f "$env_file.bak"
  
  echo -e "${GREEN}✅ 已设置: $env_file${NC}"
}

# 执行设置
if [ "$TARGET_ENV" = "both" ]; then
  setup_env_file "dev"
  setup_env_file "prod"
elif [ "$TARGET_ENV" = "dev" ]; then
  setup_env_file "dev"
elif [ "$TARGET_ENV" = "prod" ]; then
  setup_env_file "prod"
fi

echo ""
echo -e "${GREEN}✅ 环境变量设置完成!${NC}"
echo ""
echo -e "${YELLOW}下一步:${NC}"
echo "1. 检查生成的文件并根据需要调整"
echo "2. 导入到 Supabase:"
if [ "$TARGET_ENV" = "dev" ] || [ "$TARGET_ENV" = "both" ]; then
  echo "   bash scripts/import_secrets.sh dev"
fi
if [ "$TARGET_ENV" = "prod" ] || [ "$TARGET_ENV" = "both" ]; then
  echo "   bash scripts/import_secrets.sh prod"
fi
echo "3. 测试 Edge Functions: npm run test:edge"
