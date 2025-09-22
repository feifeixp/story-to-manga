#!/usr/bin/env bash
# Story to Manga - Supabase Edge Functions 环境变量导入脚本
# 
# 用法：
#   bash scripts/import_secrets.sh dev                    # 导入开发环境变量
#   bash scripts/import_secrets.sh prod                   # 导入生产环境变量
#   bash scripts/import_secrets.sh dev tairvnwvltidxcscsusl  # 指定项目引用
#
# 说明：
#   - 需要已安装并登录 Supabase CLI
#   - 不会打印敏感信息，只显示键名
#   - 支持自动检测项目引用

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 参数解析
ENV_NAME="${1:-dev}"
PROJECT_REF="${2:-}"
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 环境文件映射
case "$ENV_NAME" in
  dev|development)  
    ENV_FILE="$BASE_DIR/supabase/.env.development"
    ENV_DISPLAY="开发环境"
    ;;
  prod|production)  
    ENV_FILE="$BASE_DIR/supabase/.env.production"
    ENV_DISPLAY="生产环境"
    ;;
  *)    
    echo -e "${RED}错误: 未知环境 '$ENV_NAME' (请使用 dev|prod)${NC}" >&2
    echo "用法: bash scripts/import_secrets.sh [dev|prod] [project-ref]"
    exit 1 
    ;;
esac

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

# 检查环境文件
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}错误: 环境文件不存在: $ENV_FILE${NC}" >&2
  echo "请从模板创建并填入真实值"
  exit 1
fi

# 自动检测项目引用（如果未提供）
if [ -z "$PROJECT_REF" ]; then
  echo -e "${YELLOW}正在自动检测项目引用...${NC}"
  
  # 尝试从 supabase/config.toml 读取
  if [ -f "$BASE_DIR/supabase/config.toml" ]; then
    PROJECT_REF=$(grep -E '^project_id\s*=' "$BASE_DIR/supabase/config.toml" | cut -d'"' -f2 2>/dev/null || true)
  fi
  
  # 如果仍然为空，尝试从链接的项目获取
  if [ -z "$PROJECT_REF" ]; then
    PROJECT_REF=$(supabase status 2>/dev/null | grep "Project ref:" | awk '{print $3}' || true)
  fi
  
  # 如果还是为空，使用默认值
  if [ -z "$PROJECT_REF" ]; then
    PROJECT_REF="tairvnwvltidxcscsusl"
    echo -e "${YELLOW}使用默认项目引用: $PROJECT_REF${NC}"
  else
    echo -e "${GREEN}检测到项目引用: $PROJECT_REF${NC}"
  fi
fi

# 验证环境文件内容
echo -e "${BLUE}正在验证环境文件...${NC}"
if ! grep -q "GOOGLE_AI_API_KEY" "$ENV_FILE"; then
  echo -e "${YELLOW}警告: 环境文件可能不完整${NC}"
fi

# 统计非空变量数量
NON_EMPTY_VARS=$(grep -E '^[A-Z_]+=.+' "$ENV_FILE" | grep -v '^#' | wc -l || echo "0")
echo "发现 $NON_EMPTY_VARS 个已配置的变量"

# 构建命令
CMD=(supabase secrets set --env-file "$ENV_FILE" --project-ref "$PROJECT_REF")

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  导入 $ENV_DISPLAY 环境变量${NC}"
echo -e "${BLUE}========================================${NC}"
echo "环境文件: $ENV_FILE"
echo "项目引用: $PROJECT_REF"
echo "目标环境: $ENV_DISPLAY"
echo ""

# 确认导入
read -p "确认导入环境变量? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}已取消导入${NC}"
  exit 0
fi

# 执行导入
echo -e "${BLUE}正在导入环境变量...${NC}"
if "${CMD[@]}"; then
  echo -e "${GREEN}✅ 环境变量导入成功!${NC}"
else
  echo -e "${RED}❌ 环境变量导入失败${NC}" >&2
  exit 1
fi

# 显示当前环境变量列表
echo ""
echo -e "${BLUE}当前已设置的环境变量:${NC}"
LIST_CMD=(supabase secrets list --project-ref "$PROJECT_REF")
if "${LIST_CMD[@]}"; then
  echo ""
  echo -e "${GREEN}✅ 导入完成!${NC}"
  echo ""
  echo -e "${BLUE}后续步骤:${NC}"
  echo "1. 验证 Edge Functions: npm run test:edge"
  echo "2. 查看函数日志: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
  echo "3. 部署函数: npm run deploy:edge"
else
  echo -e "${YELLOW}警告: 无法列出环境变量，但导入可能已成功${NC}"
fi

echo ""
echo -e "${BLUE}管理命令:${NC}"
echo "• 查看变量: supabase secrets list --project-ref $PROJECT_REF"
echo "• 删除变量: supabase secrets unset KEY_NAME --project-ref $PROJECT_REF"
echo "• 重新导入: bash scripts/import_secrets.sh $ENV_NAME $PROJECT_REF"
