# Contributing to Story to Manga Machine Enhanced

Thank you for your interest in contributing to Story to Manga Machine Enhanced! We welcome contributions from the community and are grateful for your support.

## 🤝 Ways to Contribute

### 🐛 Bug Reports
- Report bugs through GitHub Issues
- Include detailed reproduction steps
- Provide browser/OS information
- Include screenshots if applicable

### 💡 Feature Requests
- Suggest new features or improvements
- Explain the use case and benefits
- Discuss implementation approaches

### 🔧 Code Contributions
- Fix bugs and implement features
- Improve performance and optimization
- Add tests and documentation

### 📖 Documentation
- Improve README and guides
- Add code comments and examples
- Create tutorials and how-to guides

### 🌍 Translations
- Add support for new languages
- Improve existing translations
- Localize cultural content

## 🚀 Getting Started

### Development Setup

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/story-to-manga-enhanced.git
   cd story-to-manga-enhanced
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.local.example .env.local
   # Add your API keys to .env.local
   ```

4. **Run Development Server**
   ```bash
   pnpm dev
   ```

### Code Style

We use Biome for linting and formatting:

```bash
# Check code style
pnpm lint

# Format code
pnpm format

# Type checking
pnpm typecheck

# Run all checks
pnpm check
```

## 📋 Pull Request Process

### Before Submitting

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make Your Changes**
   - Follow existing code patterns
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   pnpm check
   pnpm build
   ```

4. **Commit Your Changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

### Commit Message Format

We follow conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Build process or auxiliary tool changes

### Pull Request Guidelines

1. **Title**: Clear and descriptive
2. **Description**: Explain what and why
3. **Testing**: Describe how you tested
4. **Screenshots**: Include if UI changes
5. **Breaking Changes**: Document any breaking changes

## 🏗️ Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Main page
├── components/         # React components
├── lib/               # Utility libraries
│   ├── aiModelRouter.ts    # AI model management
│   ├── cacheManager.ts     # Caching system
│   ├── projectStorage.ts   # Project persistence
│   └── styleConfig.ts      # Style configurations
├── types/             # TypeScript type definitions
└── styles/            # CSS styles
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Writing Tests

- Add tests for new features
- Test edge cases and error conditions
- Use descriptive test names
- Mock external dependencies

## 📚 Documentation

### Code Documentation

- Add JSDoc comments for functions
- Document complex algorithms
- Explain non-obvious code decisions

### User Documentation

- Update README for new features
- Add examples and use cases
- Keep documentation current

## 🌍 Internationalization

### Adding New Languages

1. Create language files in `src/locales/`
2. Add translations for all keys
3. Update language selector
4. Test with different locales

### Translation Guidelines

- Use clear, concise language
- Consider cultural context
- Test with native speakers
- Maintain consistency

## 🚨 Issue Guidelines

### Bug Reports

Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS information
- Screenshots or videos

### Feature Requests

Include:
- Clear description of the feature
- Use case and benefits
- Possible implementation approach
- Examples from other applications

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Discord**: [Join our community](https://discord.gg/your-server) (if available)

## 🎯 Priorities

Current focus areas:
1. Performance optimization
2. Mobile responsiveness
3. Additional AI model integrations
4. Enhanced editing tools
5. Accessibility improvements

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Story to Manga Machine Enhanced! 🎨✨
