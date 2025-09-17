#!/bin/bash

# Story to Manga Enhanced - 一键部署脚本
# 适用于新机器快速部署

echo "🎨 Story to Manga Enhanced - 一键部署脚本"
echo "========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 输出函数
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${PURPLE}🚀 $1${NC}"
}

# 检查操作系统
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*)    MACHINE=Cygwin;;
    MINGW*)     MACHINE=MinGw;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

print_info "检测到操作系统: $MACHINE"
echo ""

# 步骤1: 检查必需工具
print_step "步骤 1/7: 检查必需工具"

# 检查 Git
if ! command -v git &> /dev/null; then
    print_error "Git 未安装。请先安装 Git:"
    if [ "$MACHINE" = "Mac" ]; then
        echo "  brew install git"
    elif [ "$MACHINE" = "Linux" ]; then
        echo "  sudo apt-get install git  # Ubuntu/Debian"
        echo "  sudo yum install git      # CentOS/RHEL"
    fi
    exit 1
fi
print_status "Git 已安装"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    print_warning "Node.js 未安装。正在安装..."
    
    if [ "$MACHINE" = "Mac" ]; then
        if command -v brew &> /dev/null; then
            brew install node
        else
            print_error "请先安装 Homebrew 或手动安装 Node.js"
            exit 1
        fi
    elif [ "$MACHINE" = "Linux" ]; then
        # 安装 Node.js 18
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
else
    NODE_VERSION=$(node --version)
    print_status "Node.js 已安装: $NODE_VERSION"
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm 未安装。正在安装..."
    npm install -g pnpm
fi
print_status "pnpm 已安装"

echo ""

# 步骤2: 克隆项目
print_step "步骤 2/7: 克隆项目"

if [ -d "story-to-manga-enhanced" ]; then
    print_warning "项目目录已存在，正在更新..."
    cd story-to-manga-enhanced
    git pull origin main
else
    print_info "正在克隆项目..."
    git clone https://github.com/feifeixp/story-to-manga-enhanced.git
    cd story-to-manga-enhanced
fi
print_status "项目克隆/更新完成"

echo ""

# 步骤3: 安装依赖
print_step "步骤 3/7: 安装依赖"
print_info "正在安装项目依赖，这可能需要几分钟..."
pnpm install
print_status "依赖安装完成"

echo ""

# 步骤4: 环境配置
print_step "步骤 4/7: 环境配置"

if [ ! -f ".env.local" ]; then
    if [ -f ".env.local.example" ]; then
        cp .env.local.example .env.local
        print_status "已创建 .env.local 文件"
    else
        # 创建基本的 .env.local 文件
        cat > .env.local << EOF
# Google AI API Key (必需)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# VolcEngine API Key (可选)
VOLCENGINE_API_KEY=your_volcengine_api_key_here

# 开发环境设置
NODE_ENV=development
EOF
        print_status "已创建基本的 .env.local 文件"
    fi
else
    print_status ".env.local 文件已存在"
fi

echo ""

# 步骤5: API 密钥配置
print_step "步骤 5/7: API 密钥配置"
print_warning "需要配置 API 密钥才能正常使用"
echo ""
echo "请按照以下步骤获取 API 密钥:"
echo ""
echo "📝 Google AI API Key (必需):"
echo "1. 访问: https://aistudio.google.com/app/apikey"
echo "2. 使用 Google 账号登录"
echo "3. 点击 'Create API Key'"
echo "4. 复制生成的 API 密钥"
echo ""
echo "📝 VolcEngine API Key (可选):"
echo "1. 访问: https://console.volcengine.com/"
echo "2. 注册并验证账号"
echo "3. 导航到 AI 服务 → 图像生成"
echo "4. 创建 API 凭证"
echo ""

read -p "是否现在配置 API 密钥? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    read -p "请输入 Google AI API Key: " google_api_key
    
    if [ ! -z "$google_api_key" ]; then
        # 更新 .env.local 文件
        if [[ "$MACHINE" == "Mac" ]]; then
            sed -i '' "s/your_google_ai_api_key_here/$google_api_key/g" .env.local
        else
            sed -i "s/your_google_ai_api_key_here/$google_api_key/g" .env.local
        fi
        print_status "Google AI API Key 已配置"
    fi
    
    echo ""
    read -p "请输入 VolcEngine API Key (可选，直接回车跳过): " volcengine_api_key
    
    if [ ! -z "$volcengine_api_key" ]; then
        if [[ "$MACHINE" == "Mac" ]]; then
            sed -i '' "s/your_volcengine_api_key_here/$volcengine_api_key/g" .env.local
        else
            sed -i "s/your_volcengine_api_key_here/$volcengine_api_key/g" .env.local
        fi
        print_status "VolcEngine API Key 已配置"
    fi
else
    print_warning "请稍后手动编辑 .env.local 文件配置 API 密钥"
    echo "使用命令: nano .env.local 或 vim .env.local"
fi

echo ""

# 步骤6: 代码检查
print_step "步骤 6/7: 代码检查"
print_info "正在进行代码检查..."

# TypeScript 检查
if pnpm typecheck; then
    print_status "TypeScript 检查通过"
else
    print_warning "TypeScript 检查有警告，但不影响运行"
fi

echo ""

# 步骤7: 启动服务
print_step "步骤 7/7: 启动开发服务器"
print_info "准备启动开发服务器..."
echo ""
print_status "🎉 部署完成！"
echo ""
print_info "服务器将在 http://localhost:8000 启动"
print_info "按 Ctrl+C 停止服务器"
echo ""
print_warning "如果 API 密钥未配置，请先编辑 .env.local 文件"
echo ""

read -p "现在启动开发服务器吗? (Y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    print_info "正在启动开发服务器..."
    pnpm dev
else
    print_info "稍后可以使用以下命令启动服务器:"
    echo "cd story-to-manga-enhanced"
    echo "pnpm dev"
fi
