# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-16

### 🚀 Major New Features

#### Multi-AI Model Support
- **Added**: Google Gemini 2.5 Flash integration
- **Added**: VolcEngine Doubao AI model support
- **Added**: Intelligent AI model router with automatic fallback
- **Added**: Model-specific optimization and prompt engineering

#### Advanced Project Management
- **Added**: Complete project management system
- **Added**: Multiple project support with isolated data storage
- **Added**: Project switching and state persistence
- **Added**: Auto-save functionality with recovery options

#### Six Distinct Comic Styles
- **Added**: Japanese Manga style with traditional aesthetics
- **Added**: American Comic book style with bold visuals
- **Added**: Chinese Wuxia style with martial arts themes
- **Added**: Healing style with soft, therapeutic visuals
- **Added**: Korean Manhwa style with modern webtoon aesthetics
- **Added**: Cinematic style with movie-like dramatic rendering

#### Professional Image Editing Tools
- **Added**: Panel redraw functionality with custom prompts
- **Added**: Reference image upload and management (up to 4 images)
- **Added**: Character reference selection for consistent styling
- **Added**: Advanced image modification with AI assistance

### 🌍 Internationalization
- **Added**: Full Chinese language support
- **Added**: English language interface
- **Added**: Localized prompts and cultural adaptations
- **Added**: Dynamic language switching

### ⚡ Performance & Scalability
- **Added**: Parallel panel generation for faster processing
- **Added**: Intelligent caching system with LRU algorithm
- **Added**: Lazy loading for large projects (50+ panels)
- **Added**: Pagination system with auto-download functionality
- **Added**: Image optimization and compression

### 🎨 Enhanced User Experience
- **Added**: Modern UI with improved visual design
- **Added**: Progress tracking and generation status indicators
- **Added**: Continue generation feature for interrupted sessions
- **Added**: Batch operations for multiple panels
- **Added**: Custom image size configuration (1K, 2K, 4K)

### 🔧 Technical Improvements
- **Added**: TypeScript strict mode for better type safety
- **Added**: Advanced error handling and recovery mechanisms
- **Added**: Comprehensive logging and debugging tools
- **Added**: Performance monitoring and optimization
- **Added**: Hybrid storage system (localStorage + IndexedDB)

### 📱 User Interface Enhancements
- **Added**: Responsive design for mobile and desktop
- **Added**: Dark/light theme support
- **Added**: Improved navigation and user flow
- **Added**: Enhanced accessibility features
- **Added**: Real-time generation progress visualization

## [1.0.0] - 2024-12-XX (Original Version)

### Initial Release (Based on victorhuangwq/story-to-manga)
- Basic story to manga conversion
- Google Gemini AI integration
- Simple character reference generation
- Basic panel creation
- Single comic style support
- Basic state persistence

---

## Migration from v1.0.0

If you're upgrading from the original version, please note:

### Breaking Changes
- Project structure has been completely redesigned
- API endpoints have been updated
- Storage format has changed (automatic migration included)
- Configuration format has been updated

### Migration Steps
1. Export your existing projects (if any)
2. Update to v2.0.0
3. Create new projects with enhanced features
4. Import your stories using the new project system

### New Requirements
- Node.js 18+ (previously 16+)
- Additional environment variables for new AI models
- Updated dependencies

---

## Acknowledgments

This enhanced version builds upon the excellent foundation of the original [Story to Manga Machine](https://github.com/victorhuangwq/story-to-manga) by victorhuangwq. We extend our gratitude for the initial concept and implementation that made this enhanced version possible.
