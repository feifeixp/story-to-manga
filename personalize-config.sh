#!/bin/bash

# Story to Manga Enhanced - Personalization Script
# This script helps you personalize the configuration files with your information

echo "🎨 Story to Manga Machine Enhanced - Personalization"
echo "================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "This script will help you personalize the configuration files."
echo ""

# Get user information
read -p "Enter your full name: " user_name
read -p "Enter your email: " user_email
read -p "Enter your GitHub username: " github_username
read -p "Enter your repository name (default: story-to-manga-enhanced): " repo_name

# Use default if empty
if [ -z "$repo_name" ]; then
    repo_name="story-to-manga-enhanced"
fi

echo ""
print_info "Personalizing configuration files..."

# Update package.json
print_info "Updating package.json..."
sed -i.bak "s/Your Name <your.email@example.com>/$user_name <$user_email>/g" package.json
sed -i.bak "s/yourusername/$github_username/g" package.json
sed -i.bak "s/story-to-manga-enhanced/$repo_name/g" package.json
print_status "Updated package.json"

# Update LICENSE
print_info "Updating LICENSE..."
sed -i.bak "s/Your Name/$user_name/g" LICENSE
print_status "Updated LICENSE"

# Update README.md
print_info "Updating README.md..."
sed -i.bak "s/yourusername/$github_username/g" README.md
sed -i.bak "s/story-to-manga-enhanced/$repo_name/g" README.md
print_status "Updated README.md"

# Clean up backup files
rm -f package.json.bak LICENSE.bak README.md.bak

echo ""
print_status "Personalization complete!"
echo ""
print_info "Updated files with your information:"
echo "- package.json: Author and repository URLs"
echo "- LICENSE: Copyright holder"
echo "- README.md: Repository links"
echo ""
print_warning "Don't forget to:"
echo "1. Review the changes"
echo "2. Update any remaining placeholder text"
echo "3. Add your API keys to .env.local"
echo "4. Test the application locally"
