# Contributing to Secure Pastebin

Thank you for your interest in contributing to Secure Pastebin! 🎉 This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/your-username/secure-pastebin.git
   cd secure-pastebin
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Start development**:
   ```bash
   npm run dev
   ```

## 🏗️ Development Setup

### Prerequisites

- **Node.js 18+** and npm
- **Cloudflare account** (free tier works)
- **Wrangler CLI**: `npm install -g wrangler`

### Local Development

1. **Create KV namespaces** for testing:
   ```bash
   wrangler kv namespace create PASTES_KV --preview
   wrangler kv namespace create ANALYTICS_KV --preview
   ```

2. **Update `wrangler.toml`** with preview namespace IDs

3. **Run locally**:
   ```bash
   npm run dev
   # Visit http://localhost:8787
   ```

### Testing Your Changes

```bash
# Test paste creation
curl -X POST http://localhost:8787/create \
  -H "Content-Type: application/json" \
  -d '{"content": "test content", "expires": "1h"}'

# Test paste viewing (use ID from creation response)
curl http://localhost:8787/s/PASTE_ID

# Test web interface
open http://localhost:8787
```

## 📝 Contribution Guidelines

### Code Style

- **TypeScript**: Use strict typing, avoid `any`
- **Formatting**: Code is auto-formatted (no specific style guide needed)
- **Comments**: Add JSDoc comments for public functions
- **Naming**: Use descriptive variable and function names

### Commit Messages

Use clear, descriptive commit messages:

```
✅ Good:
- "Add download functionality for pastes"
- "Fix copy button not working in Safari"
- "Update README with deployment instructions"

❌ Avoid:
- "fix bug"
- "update stuff"
- "changes"
```

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with clear, focused commits

3. **Test thoroughly**:
   - Test the web interface manually
   - Test API endpoints with curl
   - Test on different browsers if UI changes

4. **Update documentation** if needed:
   - Update README.md for new features
   - Add JSDoc comments for new functions
   - Update API documentation if endpoints change

5. **Open a Pull Request**:
   - Use a clear title describing the change
   - Include a description of what changed and why
   - Reference any related issues

## 🎯 Areas for Contribution

### 🐛 Bug Fixes
- Browser compatibility issues
- Edge cases in paste handling
- UI/UX improvements
- Performance optimizations

### ✨ New Features
- **Syntax highlighting** with Prism.js or similar
- **Search functionality** for public pastes
- **User accounts** and paste management
- **Collections/folders** for organizing pastes
- **Password protection** for sensitive pastes
- **Email notifications** for paste expiry
- **Mobile app** or PWA features
- **Bulk operations** (delete multiple pastes)

### 📚 Documentation
- API documentation improvements
- Deployment guides for other platforms
- Video tutorials
- Translation to other languages

### 🧪 Testing
- Unit tests for core functions
- Integration tests for API endpoints
- Browser automation tests
- Performance benchmarks

## 🏛️ Architecture Overview

Understanding the codebase structure will help you contribute effectively:

```
src/
├── core/                    # Core business logic
│   ├── storage.ts          # KV operations (create, read, delete pastes)
│   ├── security.ts         # Content validation, XSS protection
│   ├── analytics.ts        # Usage tracking and metrics
│   └── utils.ts            # Helper functions, language detection
├── handlers/               # HTTP request handlers
│   ├── create.ts          # POST /create - paste creation logic
│   └── view.ts            # GET /s/{id} - paste viewing and deletion
├── ui/templates/           # HTML generation
│   ├── error.ts           # Error page templates
│   └── view.ts            # Paste view page template
├── config/                 # Configuration
│   └── constants.ts       # App constants and settings
└── worker.ts              # Main entry point, request routing
```

### Key Concepts

- **KV Storage**: Cloudflare's key-value store with TTL for automatic cleanup
- **Progressive Enhancement**: Features work without JavaScript, enhanced with JS
- **Security First**: All user input is escaped, content is validated
- **Edge Computing**: Runs on Cloudflare's global network for speed

## 🔧 Common Development Tasks

### Adding a New API Endpoint

1. **Add route** in `src/worker.ts`:
   ```typescript
   if (url.pathname === '/api/new-endpoint' && request.method === 'GET') {
     return handleNewEndpoint(request, env);
   }
   ```

2. **Create handler function**:
   ```typescript
   async function handleNewEndpoint(request: Request, env: Env): Promise<Response> {
     // Implementation here
     return Response.json({ success: true, data: result });
   }
   ```

3. **Test the endpoint**:
   ```bash
   curl http://localhost:8787/api/new-endpoint
   ```

### Modifying the UI

1. **Update templates** in `src/ui/templates/`
2. **Test in browser** with `npm run dev`
3. **Ensure progressive enhancement** (works without JS)

### Adding Configuration Options

1. **Add to `src/config/constants.ts`**:
   ```typescript
   export const NEW_SETTING = env.NEW_SETTING || 'default-value';
   ```

2. **Document in `wrangler.toml`**:
   ```toml
   [vars]
   NEW_SETTING = "production-value"
   ```

3. **Update README** with configuration docs

## 🐛 Debugging Tips

### Local Development Issues

- **KV namespace errors**: Ensure preview namespaces are created and configured
- **CORS issues**: Check that your local server is running on the expected port
- **TypeScript errors**: Run `npm run type-check` to see all type issues

### Production Issues

- **Check Wrangler logs**: `wrangler tail` to see real-time logs
- **Test with curl**: Isolate API issues from UI issues
- **Check KV storage**: Use Wrangler CLI to inspect stored data

### Common Gotchas

- **HTML escaping**: Always escape user content to prevent XSS
- **Rate limiting**: Test with multiple requests to ensure limits work
- **TTL behavior**: KV TTL is approximate, not exact
- **JavaScript optional**: Ensure features work without JS enabled

## 📊 Performance Considerations

- **Bundle size**: Keep the worker small for fast cold starts
- **KV operations**: Minimize KV reads/writes for better performance
- **HTML minification**: Compress responses to reduce bandwidth
- **Caching**: Use appropriate cache headers for static content

## 🛡️ Security Guidelines

- **Input validation**: Validate all user input on the server side
- **XSS prevention**: HTML escape all user content
- **Rate limiting**: Implement appropriate rate limits
- **Content scanning**: Check for suspicious patterns in pastes
- **No sensitive data**: Don't log sensitive information

## 🤝 Community Guidelines

- **Be respectful** and constructive in discussions
- **Help others** by answering questions and reviewing PRs
- **Share knowledge** through documentation and examples
- **Report issues** clearly with reproduction steps
- **Credit contributors** when building on their work

## ❓ Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Comments**: Check inline documentation in the codebase
- **README**: Comprehensive setup and usage documentation

## 🎉 Recognition

Contributors will be:
- **Listed in README** acknowledgments section
- **Credited in release notes** for significant contributions
- **Mentioned in commit messages** when building on their work

Thank you for contributing to Secure Pastebin! 🚀 