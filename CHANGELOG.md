# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2024-12-17

### 🎯 Critical Bug Fixes

#### Character Reference System
- **Fixed**: Critical issue where wrong character references were used in panel generation
- **Fixed**: Dynamic character matching now correctly selects references based on panel content
- **Fixed**: Batch panel generation now uses character-specific references instead of fixed selection
- **Fixed**: Frontend redraw functionality now auto-selects correct character references

#### Style Consistency Issues
- **Fixed**: Redraw functionality producing inconsistent styles (manga vs wuxia issue)
- **Fixed**: Removed "漫画面板" (manga panel) bias from redraw prompts that caused black/white style
- **Fixed**: Style prefix standardization across all 10 comic styles
- **Fixed**: Prompt construction now uses correct style prefixes instead of conflicting instructions

### 🌐 Language Localization

#### Comprehensive Chinese Support
- **Added**: Language-aware prompt construction for all AI generation endpoints
- **Added**: Chinese story analysis generates Chinese titles, character descriptions, and settings
- **Added**: Chinese panel generation with proper scene descriptions and dialogue
- **Added**: Chinese character creation with style-appropriate annotations
- **Fixed**: All AI-generated content now respects user language preferences

### ⚡ Frontend Stability & Quality

#### Error Resolution
- **Fixed**: All TypeScript errors including implicit 'any' types and undefined variables
- **Fixed**: Null safety issues with proper optional chaining and type guards
- **Fixed**: Spell check warnings for technical terms and project-specific vocabulary
- **Fixed**: Image proxy error handling for expired VolcEngine URLs

#### Code Quality Improvements
- **Added**: Comprehensive debugging logs for all AI generation processes
- **Added**: Request ID tracking for better error diagnosis
- **Added**: Enhanced error reporting with detailed context
- **Removed**: All unused code and variables

### 🔗 Repository & Configuration

#### GitHub Links Update
- **Fixed**: Report Issue button now points to correct repository
- **Fixed**: All GitHub links updated from victorhuangwq/story-to-manga to feifeixp/story-to-manga-enhanced
- **Updated**: Package.json repository metadata and issue tracking URLs
- **Updated**: GitHub Issue templates and discussion links

### 🛠️ Developer Experience

#### Enhanced Debugging
- **Added**: Detailed logging for character reference selection process
- **Added**: Style prefix generation tracking and validation
- **Added**: Complete prompt construction visibility for troubleshooting
- **Added**: AI model response tracking with performance metrics

#### Technical Improvements
- **Improved**: API parameter passing and validation
- **Improved**: Error handling with graceful degradation
- **Improved**: Memory usage optimization for large projects
- **Enhanced**: Network resilience and timeout handling

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
