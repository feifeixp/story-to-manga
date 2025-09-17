# Story to Manga Machine Enhanced 🎨

**The Ultimate AI-Powered Story-to-Visual Converter**

Transform your written stories into stunning visual manga or comic book pages using multiple AI models including Google's Gemini 2.5 Flash and VolcEngine Doubao!

> **🚀 This is an enhanced version** based on the original [Story to Manga Machine](https://github.com/victorhuangwq/story-to-manga) by victorhuangwq, featuring significant improvements and new capabilities.

## ✨ What's New in Enhanced Version

- 🤖 **Multi-AI Model Support**: Choose between Google Gemini and VolcEngine Doubao
- 📁 **Project Management**: Create, save, and manage multiple story projects
- 🎨 **10 Comic Styles**: Japanese Manga, American Comic, Chinese Wuxia, Healing, Korean Manhwa, Cinematic, Shojo, Seinen, Chibi, Fantasy
- 🖼️ **Advanced Image Editing**: Redraw and modify panels with reference images
- 📏 **Custom Image Sizes**: Configure image dimensions per project
- 🌍 **Internationalization**: Full Chinese and English language support
- 📄 **Pagination System**: Handle large projects with 50+ panels
- ⚡ **Performance Optimizations**: Caching, parallel processing, lazy loading
- 🔄 **Continue Generation**: Resume interrupted generations seamlessly
- 📱 **Enhanced UI/UX**: Modern design with improved user experience
- 🛡️ **Stability Improvements**: Robust error handling and crash prevention
- 🔧 **Developer Experience**: Comprehensive logging and debugging tools

## 🆕 Latest Updates (v2.2.0) - December 2024

### 🎯 **Critical Bug Fixes & Stability**
- **🔧 Character Reference System**: Fixed critical issue where wrong character references were used in panel generation
- **🎨 Style Consistency**: Resolved redraw functionality producing inconsistent styles (manga vs wuxia issue)
- **🌐 Language Localization**: Implemented comprehensive Chinese language support for all AI-generated content
- **⚡ Frontend Error Resolution**: Fixed all TypeScript errors, undefined variables, and null safety issues
- **🔗 Repository Links**: Updated all GitHub links to point to correct project repository

### 🚀 **Enhanced AI Generation**
- **🎭 Dynamic Character Matching**: Panels now automatically use correct character references based on scene content
- **📝 Intelligent Prompt Construction**: Language-aware prompts ensure Chinese users get Chinese content
- **🎨 Style Prefix Standardization**: All 10 comic styles now use consistent, optimized prompt formats
- **🔄 Improved Redraw Logic**: Fixed black/white manga bias in redraw functionality

### 🌍 **Internationalization Improvements**
- **📖 Story Analysis**: Chinese language stories now generate Chinese titles, character descriptions, and settings
- **🎬 Panel Generation**: Scene descriptions and dialogue properly localized based on user language
- **🎨 Character Creation**: Style-appropriate character generation with language-specific annotations
- **🔧 API Consistency**: All endpoints now respect user language preferences

### 🛠️ **Developer Experience**
- **📊 Comprehensive Logging**: Added detailed debugging logs for all AI generation processes
- **🔍 Error Tracking**: Enhanced error reporting with request IDs and detailed context
- **⚙️ Code Quality**: Resolved all linting issues, spell check warnings, and type safety problems
- **📚 Documentation**: Updated all configuration files and repository metadata

## Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="screenshots/story-to-manga-homepage.png" alt="Story to Manga Homepage" width="100%"/>
      <br><sub><b>Main Interface</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="screenshots/story-to-manga-character-refs.png" alt="Character Design Generation" width="100%"/>
      <br><sub><b>Character Design</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="screenshots/story-to-manga-panels-progress.png" alt="Panel Generation Progress" width="100%"/>
      <br><sub><b>Generation Progress</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="screenshots/story-to-manga-meta-panels.png" alt="Final Manga Output" width="100%"/>
      <br><sub><b>Final Output</b></sub>
    </td>
  </tr>
</table>

## 🌟 Core Features

### 🤖 Multi-AI Model Support
- **Google Gemini 2.5 Flash**: High-quality image generation with excellent character consistency
- **VolcEngine Doubao**: Alternative AI model for diverse artistic styles
- **Automatic Model Selection**: Smart fallback system for optimal results

### 🎨 Ten Distinct Comic Styles
- **Japanese Manga**: Traditional manga aesthetics with detailed linework
- **American Comic**: Bold superhero comic book style
- **Chinese Wuxia**: Martial arts and cultivation themes with Eastern aesthetics
- **Healing Style**: Soft, warm, therapeutic visual style
- **Korean Manhwa**: Modern webtoon-inspired artistic approach
- **Cinematic**: Movie-like dramatic and realistic rendering
- **Shojo**: Romantic and emotional manga style targeting young women
- **Seinen**: Mature manga style for adult male audiences
- **Chibi**: Cute, super-deformed character style
- **Fantasy**: Epic fantasy art with magical and mythical elements

### 📁 Advanced Project Management
- **Multiple Projects**: Create and manage separate story projects
- **Auto-Save**: Never lose your work with automatic state persistence
- **Project Switching**: Seamlessly switch between different stories
- **Generation History**: Track and resume interrupted generations

### 🖼️ Professional Image Editing
- **Panel Redrawing**: Regenerate individual panels with new prompts
- **Reference Images**: Upload custom reference images or use character designs
- **Image Modification**: Advanced editing with AI-powered modifications
- **Custom Sizing**: Configure image dimensions per project (1K, 2K, 4K options)

### ⚡ Performance & Scalability
- **Parallel Processing**: Generate multiple panels simultaneously
- **Smart Caching**: Intelligent caching system for faster regeneration
- **Lazy Loading**: Handle large projects (50+ panels) efficiently
- **Pagination**: Organized display with auto-download for all pages

### 🌍 International Support
- **Bilingual Interface**: Full Chinese and English language support
- **Localized Content**: Culturally appropriate prompts and styles
- **Regional AI Models**: Optimized for different markets and preferences

## 🛠️ Tech Stack

### Frontend
- **Next.js 15**: Latest React framework with App Router
- **TypeScript**: Full type safety and developer experience
- **Tailwind CSS v4**: Modern utility-first CSS framework
- **React i18next**: Internationalization and localization

### AI Models & APIs
- **Google Gemini 2.5 Flash**: Primary AI model for image generation
- **VolcEngine Doubao**: Secondary AI model with unique capabilities
- **Smart Model Router**: Automatic model selection and fallback

### Storage & Performance
- **Hybrid Storage**: localStorage (text) + IndexedDB (images)
- **Advanced Caching**: LRU cache with automatic cleanup
- **Image Optimization**: Client-side compression and format conversion
- **Parallel Processing**: Concurrent API requests for faster generation

### Image Processing
- **HTML2Canvas**: Social media composite generation
- **Custom Image Proxy**: Secure image handling and caching
- **Multi-format Support**: JPEG, PNG, WebP optimization

### Development & Deployment
- **Biome**: Fast linting and formatting
- **TypeScript**: Strict type checking
- **Knip**: Dead code elimination
- **AWS Amplify**: Production deployment

## 🚀 Quick Start

### 一键部署（推荐）

在新机器上快速部署，只需要一条命令：

```bash
curl -fsSL https://raw.githubusercontent.com/feifeixp/story-to-manga-enhanced/main/quick-deploy.sh | bash
```

这个脚本会自动安装所有依赖、配置环境并启动服务器。

### 手动部署

#### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

#### 1. Clone Repository

```bash
git clone https://github.com/feifeixp/story-to-manga-enhanced.git
cd story-to-manga-enhanced
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure API Keys

Copy the environment template:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your API keys:

```env
# Google AI API Key (Primary)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# VolcEngine API Key (Optional, for additional AI model)
VOLCENGINE_API_KEY=your_volcengine_api_key_here

# Development settings
NODE_ENV=development
```

#### Getting API Keys:

**Google AI API Key:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key

**VolcEngine API Key (Optional):**
1. Visit [VolcEngine Console](https://console.volcengine.com/)
2. Create an account and verify
3. Navigate to AI Services → Image Generation
4. Create API credentials

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## 🔄 Updating to Latest Version (v2.2.0)

### 🚨 Important: Breaking Changes in v2.2.0

This version includes significant improvements to character reference handling and style consistency. **Your existing projects will continue to work**, but new projects will benefit from enhanced features.

### For Existing Installations

#### Method 1: Git Pull (Recommended)
```bash
cd story-to-manga-enhanced
git pull origin main
pnpm install  # Install any new dependencies
pnpm dev      # Restart development server
```

#### Method 2: Fresh Installation
If you encounter issues with git pull, you can do a fresh installation:
```bash
# Backup your .env.local file first
cp .env.local .env.local.backup

# Remove old installation
rm -rf story-to-manga-enhanced

# Fresh clone and setup
git clone https://github.com/feifeixp/story-to-manga-enhanced.git
cd story-to-manga-enhanced
pnpm install

# Restore your API keys
cp .env.local.backup .env.local
```

### 🆕 What's New After Update

After updating to v2.2.0, you'll immediately benefit from:

1. **🎯 Better Character Consistency**: Panels now automatically use the correct character references
2. **🎨 Fixed Style Issues**: Redraw functionality now maintains proper style (no more unwanted manga style)
3. **🌐 Chinese Language Support**: Full localization for Chinese users
4. **🔧 Enhanced Stability**: Resolved all major frontend crashes and TypeScript errors
5. **📱 Improved UI**: Better error handling and user feedback

### 🔧 Troubleshooting Update Issues

If you experience issues after updating:

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Restart development server
pnpm dev
```

# Start development server
pnpm dev
```

### For Production Deployments

#### AWS Amplify
Your deployment will automatically update when you push changes to your connected GitHub repository.

#### Vercel
Vercel will automatically redeploy when you push to your connected repository.

#### Manual Server Updates
```bash
# On your production server
cd /path/to/your/deployment
git pull origin main
pnpm install
pnpm build
pm2 restart your-app-name  # or your process manager
```

### 📋 Update Checklist

After updating, verify these features are working:
- [ ] Project creation and management
- [ ] Story analysis and character generation
- [ ] Panel generation with your preferred AI model
- [ ] Image editing and redraw functionality
- [ ] Export and download features
- [ ] Language switching (Chinese/English)

### 🆘 Update Troubleshooting

**If you encounter issues after updating:**

1. **Clear Browser Cache**: Hard refresh (Ctrl+F5 or Cmd+Shift+R)
2. **Clear Application Data**:
   - Open browser DevTools → Application → Storage → Clear site data
3. **Reinstall Dependencies**:
   ```bash
   rm -rf node_modules package-lock.json
   pnpm install
   ```
4. **Check API Keys**: Ensure your `.env.local` file has valid API keys
5. **Restart Development Server**: Stop and restart `pnpm dev`

## 🔄 How It Works

### 1. **Project Creation & Setup**
- Create a new project with custom settings
- Choose from 6 distinct comic styles
- Configure image dimensions and language preferences

### 2. **Intelligent Story Analysis**
- AI analyzes your narrative structure and themes
- Extracts characters, settings, and emotional arcs
- Identifies key scenes and dialogue moments

### 3. **Character Design Generation**
- Creates consistent character reference sheets
- Generates detailed visual descriptions
- Maintains character consistency across all panels

### 4. **Smart Panel Planning**
- Intelligently breaks story into sequential panels (up to 50)
- Optimizes scene descriptions and dialogue placement
- Plans visual composition and pacing

### 5. **Multi-Model Panel Generation**
- Generates panels using selected AI model
- Maintains character consistency with reference sheets
- Supports parallel processing for faster generation

### 6. **Advanced Editing & Export**
- Edit individual panels with redraw functionality
- Add custom reference images for better results
- Export individual panels or create paginated composites

## 📖 Usage Guide

### Basic Workflow

1. **Create New Project**: Click "我的项目" → "新建项目"
2. **Configure Settings**:
   - Choose comic style (Manga, Comic, Wuxia, etc.)
   - Set image dimensions (1K, 2K, 4K)
   - Select language preference
3. **Input Your Story**: Paste your story (up to 2000 words)
4. **Generate Content**: Click "生成漫画" and watch the magic happen:
   - Story analysis and character extraction
   - Character reference sheet generation
   - Panel-by-panel comic creation
5. **Edit & Refine**: Use editing tools to perfect your panels
6. **Export & Share**: Download individual panels or complete pages

### Advanced Features

- **Project Management**: Switch between multiple story projects
- **Continue Generation**: Resume interrupted generations seamlessly
- **Batch Operations**: Generate multiple panels simultaneously
- **Reference Images**: Upload custom images to guide AI generation
- **Multi-language**: Switch between Chinese and English interfaces

## 🚀 Deployment

### AWS Amplify (Recommended)

1. Fork this repository to your GitHub account
2. Connect your GitHub repo to AWS Amplify
3. Add environment variables in Amplify console:
   ```
   GOOGLE_AI_API_KEY=your_google_ai_api_key
   VOLCENGINE_API_KEY=your_volcengine_api_key (optional)
   ```
4. Deploy automatically on push

### Vercel

1. Fork this repository
2. Import project to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy with one click

### Docker (Coming Soon)

Docker support will be added in future releases for easy self-hosting.

## 📝 Story Guidelines

### ✅ Best Practices for Optimal Results

**Story Length:**
- **Optimal**: 500-2000 words
- **Minimum**: 200 words for meaningful content
- **Maximum**: 2000 words (longer stories will be chunked)

**Content Structure:**
- Clear character introductions and descriptions
- Well-defined settings and environments
- Dialogue-heavy scenes work exceptionally well
- Action sequences with clear visual elements
- Emotional moments and character interactions

**Character Guidelines:**
- Provide physical descriptions (appearance, clothing, distinctive features)
- Limit to 3-5 main characters for best consistency
- Include personality traits that affect visual presentation

### ❌ What to Avoid

- Extremely complex plots with numerous characters
- Stories requiring specific copyrighted visual references
- Adult content or inappropriate material
- Overly abstract or philosophical content without visual elements
- Stories with rapid location changes

## 🐛 Troubleshooting

### Common Issues

**"Failed to generate character references"**
- Verify API keys are correctly configured
- Check if you've exceeded rate limits (wait 1-2 minutes)
- Ensure stable internet connection
- Try switching AI models in settings

**"Generation stopped unexpectedly"**
- Use "Continue Generation" feature to resume
- Check browser console for specific error messages
- Verify sufficient browser storage space

**"Images not displaying"**
- Clear browser cache and cookies
- Disable ad blockers temporarily
- Check network connectivity
- Try refreshing the page

**"Project not saving"**
- Ensure browser allows localStorage and IndexedDB
- Check available storage space
- Try creating a new project

### Performance Tips

- Close unnecessary browser tabs during generation
- Use Chrome or Firefox for best performance
- Ensure stable internet connection
- Generate during off-peak hours for faster API responses

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute

- 🐛 **Bug Reports**: Submit detailed issue reports
- 💡 **Feature Requests**: Suggest new features or improvements
- 🔧 **Code Contributions**: Submit pull requests
- 📖 **Documentation**: Improve documentation and guides
- 🌍 **Translations**: Add support for more languages
- 🎨 **UI/UX**: Suggest design improvements

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m 'Add amazing feature'`
5. Push to your branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📄 License

MIT License - This project is open source and free to use for personal and commercial projects.

## 🙏 Acknowledgments

This enhanced version is built upon the excellent foundation of the original [Story to Manga Machine](https://github.com/victorhuangwq/story-to-manga) by victorhuangwq. We extend our gratitude for the initial concept and implementation.

### Key Enhancements Added:
- Multi-AI model support and intelligent routing
- Comprehensive project management system
- Advanced image editing and modification tools
- Six distinct comic styles with cultural authenticity
- Full internationalization and localization
- Performance optimizations and scalability improvements
- Modern UI/UX with enhanced user experience

---

**Made with ❤️ for the global storytelling community**
