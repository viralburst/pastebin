# 📦 Installation Guide

This guide provides multiple ways to install and deploy your own Secure Pastebin instance. Choose the method that works best for you!

## 🎯 Quick Overview

| Method | Time | Difficulty | Best For |
|--------|------|------------|----------|
| [🤖 Automated Script](#-automated-setup-recommended) | 2-5 min | ⭐ Easy | Everyone |
| [🚀 One-Click Deploy](#-one-click-deploy) | 1-2 min | ⭐ Easy | Quick testing |
| [🛠️ Manual Setup](#️-manual-setup) | 10-15 min | ⭐⭐ Medium | Learning/customization |

---

## 🤖 **Automated Setup (Recommended)**

**The easiest way to get your pastebin running!** Our automated scripts handle everything for you.

### **Linux/macOS Setup**

```bash
# Clone the repository
git clone https://github.com/viralburst/pastebin.git
cd pastebin

# Run the automated setup script
./setup.sh
```

### **Windows PowerShell Setup**

```powershell
# Clone the repository
git clone https://github.com/viralburst/pastebin.git
cd pastebin

# Run the automated setup script
.\setup.ps1
```

### **What the Script Does**

The automated script performs these steps:

1. **🔍 System Check**: Verifies Node.js 18+, npm, git, and curl
2. **⚡ Wrangler Installation**: Installs Cloudflare Wrangler CLI globally
3. **🔐 Authentication**: Opens browser for Cloudflare login
4. **📦 Dependencies**: Installs all npm packages
5. **🗄️ KV Namespaces**: Creates production and preview namespaces
6. **⚙️ Configuration**: Auto-configures `wrangler.toml` with your IDs
7. **🏗️ Build**: Compiles TypeScript to JavaScript
8. **🚀 Deploy**: Deploys to Cloudflare Workers
9. **🧪 Test**: Verifies deployment is working
10. **🌐 Domain Setup**: Optional custom domain configuration

### **Script Options**

#### **Linux/macOS Options:**
```bash
# Skip dependency checks (if you know they're installed)
./setup.sh --skip-deps

# Use custom project name
./setup.sh --project-name "my-pastebin"

# Verbose output for debugging
./setup.sh --verbose
```

#### **Windows PowerShell Options:**
```powershell
# Skip dependency checks
.\setup.ps1 -SkipDependencyCheck

# Skip authentication (if already logged in)
.\setup.ps1 -SkipAuth

# Use custom project name
.\setup.ps1 -ProjectName "my-pastebin"
```

### **Expected Output**

```
╔══════════════════════════════════════════════════════════════╗
║                    🚀 SECURE PASTEBIN SETUP 🚀                    ║
║                                                              ║
║   Automated setup script for your own pastebin instance     ║
║   Live demo: https://1paste.dev                             ║
║   Version: 1.0.0                                            ║
╚══════════════════════════════════════════════════════════════╝

✨ Checking System Requirements...
✅ Node.js 20.1.0 (✓ >= 18.0.0)
✅ npm 9.6.4
✅ Git 2.40.1
✅ curl available
✅ All system requirements met!

✨ Installing Wrangler CLI...
✅ Wrangler 3.20.0 already installed

✨ Setting up Cloudflare Authentication...
✅ Already authenticated with Cloudflare (your.email@example.com)

✨ Installing Project Dependencies...
✅ Dependencies installed successfully

✨ Creating Cloudflare KV Namespaces...
✅ KV namespaces created successfully!
  PASTES_KV: a1b2c3d4e5f6...
  PASTES_KV (preview): f6e5d4c3b2a1...
  ANALYTICS_KV: 9z8y7x6w5v...
  ANALYTICS_KV (preview): v5w6x7y8z9...

✨ Configuring wrangler.toml...
✅ wrangler.toml configured with your KV namespace IDs

✨ Building Project...
✅ Project built successfully

✨ Deploying to Cloudflare Workers...
✅ Deployment successful!

🚀 Your pastebin is now live at: https://secure-pastebin.your-subdomain.workers.dev

✨ Testing Deployment...
✅ Your pastebin is responding correctly!

╔══════════════════════════════════════════════════════════════╗
║                        ✅ SUCCESS! ✅                         ║
║                                                              ║
║  Your secure pastebin is now ready to use!                  ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🚀 **One-Click Deploy**

Perfect for quick testing or if you prefer web-based setup.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/viralburst/pastebin)

**Steps:**
1. Click the deploy button above
2. Connect your GitHub account
3. Select your Cloudflare account
4. Configure KV namespaces (auto-created)
5. Deploy!

---

## 🛠️ **Manual Setup**

For developers who want full control over the setup process.

### **Step 1: Prerequisites**

Ensure you have these installed:

```bash
# Check Node.js version (must be 18+)
node --version

# Check npm version
npm --version

# Check git
git --version
```

**Installation links if needed:**
- **Node.js**: https://nodejs.org/en/download/
- **Git**: https://git-scm.com/downloads

### **Step 2: Clone Repository**

```bash
git clone https://github.com/viralburst/pastebin.git
cd pastebin
```

### **Step 3: Install Dependencies**

```bash
# Install project dependencies
npm install

# Install Wrangler CLI globally
npm install -g wrangler
```

### **Step 4: Cloudflare Authentication**

```bash
# Login to Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

### **Step 5: Create KV Namespaces**

```bash
# Create production namespaces
wrangler kv namespace create PASTES_KV
wrangler kv namespace create ANALYTICS_KV

# Create preview namespaces for development
wrangler kv namespace create PASTES_KV --preview
wrangler kv namespace create ANALYTICS_KV --preview
```

**Save the namespace IDs returned by these commands!**

### **Step 6: Configure wrangler.toml**

Replace the placeholder IDs in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "PASTES_KV"
id = "your-pastes-namespace-id-here"
preview_id = "your-pastes-preview-id-here"

[[kv_namespaces]]
binding = "ANALYTICS_KV"
id = "your-analytics-namespace-id-here"
preview_id = "your-analytics-preview-id-here"
```

### **Step 7: Build and Deploy**

```bash
# Build the project
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

### **Step 8: Test Your Deployment**

Visit the URL provided after deployment to test your pastebin!

---

## 🌐 **Custom Domain Setup**

After deployment, you can set up a custom domain:

### **Method 1: Cloudflare Dashboard (Recommended)**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **Your Worker** → **Settings** → **Triggers**
3. Click **"Add Custom Domain"**
4. Enter your domain (e.g., `paste.yourdomain.com`)
5. Cloudflare automatically configures DNS

### **Method 2: Worker Routes**

1. In the same **Triggers** section
2. Click **"Add Route"**
3. Enter route pattern: `yourdomain.com/*`
4. Select your zone
5. Save

---

## 🔧 **Development Workflow**

### **Local Development**

```bash
# Start development server
npm run dev

# Visit http://localhost:8787
# Make changes and see them instantly
```

### **Deploy Updates**

```bash
# Build and deploy
npm run build
npm run deploy

# Or use the combined command
npm run deploy
```

### **View Logs**

```bash
# Real-time logs
wrangler tail

# View deployment history
wrangler deployments list
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **"Command not found: wrangler"**
```bash
# Install Wrangler globally
npm install -g wrangler

# Or use npx
npx wrangler --version
```

#### **"Authentication failed"**
```bash
# Re-login to Cloudflare
wrangler logout
wrangler login
```

#### **"KV namespace not found"**
- Check your `wrangler.toml` has the correct namespace IDs
- Ensure you've created both production and preview namespaces

#### **"Build failed"**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### **"Deployment timeout"**
- Check your internet connection
- Try deploying again: `npm run deploy`
- Verify Cloudflare status: https://www.cloudflarestatus.com/

### **Getting Help**

- **📖 Documentation**: Check README.md and other docs
- **🐛 Issues**: [GitHub Issues](https://github.com/viralburst/pastebin/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/viralburst/pastebin/discussions)
- **🌐 Live Demo**: [https://1paste.dev](https://1paste.dev)

---

## 📊 **Configuration Options**

### **Environment Variables**

Customize your pastebin by editing `wrangler.toml`:

```toml
[vars]
# Maximum paste size (bytes)
MAX_PASTE_SIZE = "1048576"  # 1MB

# Maximum title length
MAX_TITLE_LENGTH = "200"

# Default expiry time (hours)
DEFAULT_EXPIRY_HOURS = "24"

# Rate limiting (requests per minute per IP)
RATE_LIMIT_CREATE = "10"
RATE_LIMIT_VIEW = "100"

# Enable/disable analytics
ANALYTICS_ENABLED = "true"
```

### **Security Settings**

For production use, consider these security settings:

```toml
[vars]
# More conservative limits
RATE_LIMIT_CREATE = "5"
RATE_LIMIT_VIEW = "50"
MAX_PASTE_SIZE = "524288"  # 512KB

# Privacy-focused
ANALYTICS_ENABLED = "false"
```

---

## 🎉 **Success!**

Your secure pastebin is now ready! 🚀

**Next steps:**
- 📝 Create your first paste
- 🌐 Set up a custom domain
- 📊 Monitor usage in Cloudflare dashboard
- ⭐ Star the repository if you found it useful!

**Live Demo**: [https://1paste.dev](https://1paste.dev) 