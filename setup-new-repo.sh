#!/bin/bash

# Story to Manga Enhanced - New Repository Setup Script
# This script helps you set up a new GitHub repository for the enhanced version

echo "🎨 Story to Manga Machine Enhanced - Repository Setup"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install Git first."
    exit 1
fi

print_info "Current git status:"
git status --short

echo ""
print_warning "This script will:"
echo "1. Remove the existing remote origin"
echo "2. Add all changes to git"
echo "3. Create an initial commit"
echo "4. Help you set up a new GitHub repository"
echo ""

read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Setup cancelled."
    exit 0
fi

echo ""
print_info "Step 1: Removing existing remote origin..."
git remote remove origin
print_status "Removed existing remote origin"

echo ""
print_info "Step 2: Adding all changes to git..."
git add .
print_status "Added all changes to staging"

echo ""
print_info "Step 3: Creating initial commit..."
git commit -m "feat: initial commit of Story to Manga Enhanced v2.0.0

🚀 Major enhancements over original version:
- Multi-AI model support (Gemini + VolcEngine)
- Advanced project management system
- 6 distinct comic styles (Manga, Comic, Wuxia, Healing, Manhwa, Cinematic)
- Professional image editing tools with reference images
- Full internationalization (Chinese + English)
- Performance optimizations and scalability improvements
- Modern UI/UX with enhanced user experience

Based on the original Story to Manga Machine by victorhuangwq
https://github.com/victorhuangwq/story-to-manga"

print_status "Created initial commit"

echo ""
print_info "Step 4: Repository setup instructions"
echo ""
echo "Now you need to create a new GitHub repository:"
echo ""
echo "1. Go to https://github.com/new"
echo "2. Repository name: story-to-manga-enhanced"
echo "3. Description: Enhanced Story to Manga Machine - Transform stories into visual manga/comic pages with AI"
echo "4. Make it Public (recommended for open source)"
echo "5. DO NOT initialize with README, .gitignore, or license (we already have them)"
echo "6. Click 'Create repository'"
echo ""

read -p "Press Enter after you've created the GitHub repository..."

echo ""
print_info "Step 5: Connecting to your new repository"
echo ""
read -p "Enter your GitHub username: " github_username
read -p "Enter your repository name (default: story-to-manga-enhanced): " repo_name

# Use default if empty
if [ -z "$repo_name" ]; then
    repo_name="story-to-manga-enhanced"
fi

# Add new remote origin
git remote add origin "https://github.com/$github_username/$repo_name.git"
print_status "Added new remote origin: https://github.com/$github_username/$repo_name.git"

echo ""
print_info "Step 6: Pushing to GitHub..."
git branch -M main
git push -u origin main

if [ $? -eq 0 ]; then
    print_status "Successfully pushed to GitHub!"
    echo ""
    print_info "🎉 Your enhanced Story to Manga repository is now live at:"
    echo "https://github.com/$github_username/$repo_name"
    echo ""
    print_info "Next steps:"
    echo "1. Update package.json with your repository URL"
    echo "2. Update README.md with your GitHub username"
    echo "3. Update LICENSE with your name"
    echo "4. Set up environment variables for deployment"
    echo "5. Configure GitHub Pages or deploy to Vercel/Netlify"
else
    print_error "Failed to push to GitHub. Please check your credentials and try again."
    echo ""
    print_info "You can manually push later with:"
    echo "git push -u origin main"
fi

echo ""
print_status "Setup complete! 🚀"
