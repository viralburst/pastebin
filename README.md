# 🔐 Secure Pastebin

A production-ready, secure pastebin built on Cloudflare Workers with one-time view capability, comprehensive analytics, and a beautiful modern UI. Perfect for sharing code snippets, logs, and sensitive data with automatic expiration.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/your-username/secure-pastebin)

## ✨ Features

### 🔒 Security First
- **🔥 One-time view**: Pastes are automatically deleted after being viewed once (optional)
- **👁️ Multi-view mode**: Allow multiple views until expiration
- **⏰ Auto-expiration**: Configurable expiry times (5 minutes to 30 days)
- **🛡️ Content validation**: Suspicious pattern detection and content quality checks
- **🚫 XSS protection**: Full HTML escaping and secure rendering
- **🚦 Rate limiting**: Configurable limits to prevent abuse
- **🔑 Secure IDs**: Cryptographically secure paste identifiers
- **🗑️ Manual deletion**: Recipients can delete pastes before expiration

### 📋 User Experience
- **📋 One-click copy**: Simple, reliable copy button that works everywhere
- **💾 Multiple download formats**: Auto-detect, TXT, and Markdown with metadata
- **🎨 Beautiful UI**: Modern purple gradient design with responsive layout
- **📱 Mobile-friendly**: Works perfectly on all device sizes
- **⚡ Progressive enhancement**: Full functionality with or without JavaScript
- **🖱️ Click-to-select**: Click content area to select all text
- **⌨️ Keyboard shortcuts**: Quick actions for power users

### 🌈 Language Support
- **🎯 Auto-detection**: Smart language detection from content patterns
- **25+ languages**: JavaScript, Python, Java, Go, Rust, SQL, and more
- **📝 Syntax highlighting**: Beautiful code formatting (planned)
- **📊 Language analytics**: Track most popular programming languages

### 📊 Analytics & Monitoring
- **📈 Usage tracking**: Views, shares, and errors with privacy-focused hashing
- **🌍 Geographic insights**: Optional IP-based location tracking
- **📅 Time-based statistics**: Hourly and daily usage patterns
- **📊 Trend analysis**: Growth metrics and popular usage times
- **🔍 Health monitoring**: Built-in health checks and error tracking

### 🏗️ Architecture
- **⚡ Edge computing**: Cloudflare Workers for global performance
- **🗄️ KV Storage**: Distributed key-value storage with automatic TTL
- **📦 Zero dependencies**: Minimal attack surface, maximum security
- **🔧 TypeScript**: Full type safety and excellent developer experience
- **🧩 Modular design**: Clean separation of concerns
- **🌐 API-first**: RESTful API with beautiful web interface

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### One-Click Deploy

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/your-username/secure-pastebin)

### Manual Installation

1. **Clone the repository**:
```bash
git clone https://github.com/your-username/secure-pastebin.git
cd secure-pastebin
npm install
```

2. **Create Cloudflare KV namespaces**:
```bash
# Create production namespaces
wrangler kv namespace create PASTES_KV
wrangler kv namespace create ANALYTICS_KV

# Create preview namespaces for development
wrangler kv namespace create PASTES_KV --preview
wrangler kv namespace create ANALYTICS_KV --preview
```

3. **Update `wrangler.toml`** with your namespace IDs:
```toml
[[kv_namespaces]]
binding = "PASTES_KV"
id = "your-pastes-namespace-id"
preview_id = "your-pastes-preview-id"

[[kv_namespaces]]
binding = "ANALYTICS_KV"
id = "your-analytics-namespace-id"
preview_id = "your-analytics-preview-id"
```

4. **Start development**:
```bash
npm run dev
# Visit http://localhost:8787
```

5. **Deploy to production**:
```bash
npm run deploy
```

## 🎯 Usage

### Web Interface

1. **Visit your deployed URL**
2. **Paste your content** (code, text, logs, etc.)
3. **Choose settings**:
   - **Title**: Optional descriptive title
   - **Language**: Auto-detected or manually selected
   - **Expiry**: 5 minutes to 30 days
   - **View mode**: One-time or multiple views
4. **Share the link** - recipients can view and copy content
5. **One-click copy** - Simple copy button that works everywhere

### API Usage

#### Create a Paste
```bash
curl -X POST https://your-domain.workers.dev/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Code Snippet",
    "content": "console.log(\"Hello, World!\");",
    "language": "javascript",
    "expires": "24h",
    "oneTimeView": false
  }'
```

#### View a Paste
```bash
curl https://your-domain.workers.dev/s/abc123def456 \
  -H "Accept: application/json"
```

## 📖 API Documentation

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Web interface |
| `POST` | `/create` | Create new paste |
| `GET` | `/s/{id}` | View paste |
| `POST` | `/s/{id}` | Delete paste (form) |
| `DELETE` | `/s/{id}` | Delete paste (API) |
| `GET` | `/download/{id}` | Download paste |
| `HEAD` | `/download/{id}` | Check download availability |
| `GET` | `/api/stats` | Get analytics |
| `GET` | `/api/health` | Health check |

### Create Paste Request

```typescript
interface CreatePasteRequest {
  title?: string;           // Optional title
  content: string;          // Paste content (required)
  language?: string;        // Programming language
  expires?: string;         // Expiry time (5m, 1h, 24h, 7d, 30d)
  oneTimeView?: boolean;    // One-time view mode (default: true)
}
```

### Create Paste Response

```typescript
interface CreatePasteResponse {
  success: true;
  id: string;               // Paste ID
  shareUrl: string;         // Full sharing URL
  title?: string;           // Paste title
  language: string;         // Detected/specified language
  expiresAt: string;        // ISO expiration date
  size: number;             // Content size in bytes
  createdAt: string;        // ISO creation date
  oneTimeView: boolean;     // View mode
}
```

## ⚙️ Configuration

### Environment Variables

```toml
# wrangler.toml
[vars]
ENVIRONMENT = "production"
MAX_PASTE_SIZE = "1048576"        # 1MB max paste size
MAX_TITLE_LENGTH = "200"          # Maximum title length
DEFAULT_EXPIRY_HOURS = "24"       # Default expiry time
RATE_LIMIT_CREATE = "10"          # Max pastes per minute per IP
RATE_LIMIT_VIEW = "100"           # Max views per minute per IP
ANALYTICS_ENABLED = "true"        # Enable usage analytics
```

### Expiry Options

| Option | Duration | Use Case |
|--------|----------|----------|
| `5m` | 5 minutes | Quick sharing |
| `1h` | 1 hour | Temporary data |
| `24h` | 24 hours | Daily sharing (default) |
| `7d` | 7 days | Weekly projects |
| `30d` | 30 days | Long-term storage |

### Supported Languages

**25+ programming languages with auto-detection:**

- **Web**: JavaScript, TypeScript, HTML, CSS, JSON
- **Backend**: Python, Java, Go, Rust, C/C++, C#, PHP, Ruby
- **Data**: SQL, YAML, XML, Markdown
- **DevOps**: Shell, Bash, PowerShell, Dockerfile
- **And more**: Swift, Kotlin, Scala, R

## 🏛️ Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web UI        │    │   REST API      │    │   KV Storage    │
│                 │    │                 │    │                 │
│ • Form handling │    │ • Create paste  │    │ • Paste data    │
│ • Copy buttons  │    │ • View paste    │    │ • Analytics     │
│ • Downloads     │    │ • Delete paste  │    │ • Auto-expiry   │
│ • Responsive    │    │ • Analytics     │    │ • TTL cleanup   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Cloudflare Edge │
                    │                 │
                    │ • Rate limiting │
                    │ • Security      │
                    │ • Caching       │
                    │ • Global CDN    │
                    └─────────────────┘
```

### File Structure

```
src/
├── core/                    # Core business logic
│   ├── storage.ts          # KV storage operations
│   ├── security.ts         # Security & validation
│   ├── analytics.ts        # Usage analytics
│   └── utils.ts            # Utilities & helpers
├── handlers/               # Request handlers
│   ├── create.ts          # Paste creation logic
│   └── view.ts            # Paste viewing & deletion
├── ui/templates/           # HTML templates
│   ├── error.ts           # Error pages
│   └── view.ts            # Paste view template
├── config/                 # Configuration
│   └── constants.ts       # App constants
└── worker.ts              # Main entry point
```

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm run deploy       # Deploy to Cloudflare
npm run type-check   # Run TypeScript checks
```

### Development Workflow

1. **Start development**: `npm run dev`
2. **Make changes** to TypeScript files
3. **Test locally** at `http://localhost:8787`
4. **Build and deploy**: `npm run build && npm run deploy`

### Testing

```bash
# Test paste creation
curl -X POST http://localhost:8787/create \
  -H "Content-Type: application/json" \
  -d '{"content": "test", "expires": "1h"}'

# Test paste viewing
curl http://localhost:8787/s/PASTE_ID

# Test analytics
curl http://localhost:8787/api/stats
```

## 🛡️ Security Features

### Content Protection
- **HTML escaping**: All user content is escaped to prevent XSS
- **Content validation**: Detects suspicious patterns and potential security issues
- **Size limits**: Configurable maximum paste size (default: 1MB)
- **Rate limiting**: Per-IP limits to prevent abuse

### Privacy & Data Protection
- **Automatic cleanup**: Expired pastes are automatically deleted
- **IP hashing**: IP addresses are hashed for analytics (not stored raw)
- **No tracking**: No cookies or persistent tracking
- **Minimal logging**: Only essential error information is logged

### Access Control
- **Secure IDs**: Cryptographically secure paste identifiers
- **One-time view**: Optional automatic deletion after first view
- **Manual deletion**: Recipients can delete pastes before expiration
- **No enumeration**: Paste IDs cannot be guessed or enumerated

## 📊 Analytics & Monitoring

### Built-in Analytics

Access analytics at `/api/stats`:

```json
{
  "totalShares": 1250,
  "totalViews": 3780,
  "uniqueVisitors": 892,
  "languages": {
    "javascript": 425,
    "python": 380,
    "text": 210
  },
  "topLanguages": [
    {"language": "javascript", "count": 425, "percentage": 34}
  ],
  "trends": {
    "sharesGrowth": 15,
    "viewsGrowth": 8,
    "popularHours": [14, 15, 16]
  }
}
```

### Health Monitoring

Health check endpoint at `/api/health`:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "features": {
    "storage": true,
    "analytics": true,
    "security": true
  }
}
```

## 🚀 Deployment

### Cloudflare Workers (Recommended)

1. **Create KV namespaces** (see Quick Start)
2. **Configure `wrangler.toml`** with your settings
3. **Deploy**: `npm run deploy`
4. **Add custom domain** (optional) in Cloudflare dashboard

### Environment Setup

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
npm run deploy
```

### Custom Domain

1. Go to **Workers & Pages** → **Your Worker** → **Settings** → **Triggers**
2. **Add Custom Domain**
3. **Update base URL** in your application if needed

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Quick Contribution

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes
4. **Test** thoroughly
5. **Commit**: `git commit -m 'Add amazing feature'`
6. **Push**: `git push origin feature/amazing-feature`
7. **Open** a Pull Request

### Development Guidelines

- ✅ **TypeScript**: Use strict typing
- ✅ **Testing**: Test your changes locally
- ✅ **Documentation**: Update docs for new features
- ✅ **Code style**: Follow existing patterns
- ✅ **Security**: Consider security implications

### Feature Ideas

- 🎨 Syntax highlighting with Prism.js
- 🔍 Search functionality
- 👥 User accounts and paste management
- 🔗 Paste collections and folders
- 📧 Email notifications
- 🔒 Password protection
- 📱 Mobile app

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Cloudflare Workers](https://workers.cloudflare.com/)** - Edge computing platform
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety and developer experience
- **[Wrangler](https://developers.cloudflare.com/workers/wrangler/)** - Development and deployment tools
- **Open source community** - For inspiration and best practices

## 📞 Support & Community

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/your-username/secure-pastebin/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/your-username/secure-pastebin/discussions)
- 📖 **Documentation**: This README and inline code comments
- 🚀 **Deployment Help**: [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Made with ❤️ using Cloudflare Workers and TypeScript**

*Secure, fast, and beautiful paste sharing for developers* 