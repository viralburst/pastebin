# 🚀 Deployment Guide

This guide covers deploying Secure Pastebin to various platforms, with detailed instructions for Cloudflare Workers (recommended) and other alternatives.

## 📋 Prerequisites

Before deploying, ensure you have:

- **Node.js 18+** and npm
- **Git** for version control
- **Cloudflare account** (free tier works)
- **Domain name** (optional, for custom domains)

## ⚡ Quick Deploy (Recommended)

### One-Click Cloudflare Workers Deploy

The fastest way to get started:

1. **Click the deploy button**:
   [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/YOUR_REPO_NAME)

2. **Follow the setup wizard**:
   - Connect your GitHub account
   - Select your Cloudflare account
   - Configure KV namespaces (automatically created)
   - Deploy!

3. **Your pastebin is live** at `https://your-worker-name.your-subdomain.workers.dev`

## 🔧 Manual Deployment

### Step 1: Environment Setup

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd secure-pastebin
   npm install
   ```

### Step 2: KV Namespace Configuration

1. **Create production namespaces**:
   ```bash
   wrangler kv namespace create PASTES_KV
   wrangler kv namespace create ANALYTICS_KV
   ```

2. **Create preview namespaces** (for development):
   ```bash
   wrangler kv namespace create PASTES_KV --preview
   wrangler kv namespace create ANALYTICS_KV --preview
   ```

3. **Update `wrangler.toml`** with the namespace IDs returned from the commands above:
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

### Step 3: Configuration

1. **Review `wrangler.toml`** settings:
   ```toml
   name = "secure-pastebin"
   main = "src/worker.ts"
   compatibility_date = "2024-01-01"

   [vars]
   ENVIRONMENT = "production"
   MAX_PASTE_SIZE = "1048576"        # 1MB
   MAX_TITLE_LENGTH = "200"
   DEFAULT_EXPIRY_HOURS = "24"
   RATE_LIMIT_CREATE = "10"          # Per minute per IP
   RATE_LIMIT_VIEW = "100"           # Per minute per IP
   ANALYTICS_ENABLED = "true"
   ```

2. **Set secrets** (if needed):
   ```bash
   wrangler secret put SECRET_NAME
   # Enter the secret value when prompted
   ```

### Step 4: Build and Deploy

1. **Test locally**:
   ```bash
   npm run dev
   # Visit http://localhost:8787
   ```

2. **Build and validate**:
   ```bash
   npm run build
   npm run type-check
   ```

3. **Deploy to production**:
   ```bash
   npm run deploy
   ```

4. **Your pastebin is now live**! 🎉

## 🌐 Custom Domain Setup

### Using Cloudflare Dashboard

1. **Go to Workers & Pages** in your Cloudflare dashboard
2. **Select your worker**
3. **Go to Settings → Triggers**
4. **Add Custom Domain**:
   - Enter your domain (e.g., `paste.yourdomain.com`)
   - Cloudflare will automatically configure DNS
5. **Update your application** if needed to use the new domain

### Using Wrangler CLI

1. **Add route to `wrangler.toml`**:
   ```toml
   routes = [
     { pattern = "paste.yourdomain.com/*", zone_name = "yourdomain.com" }
   ]
   ```

2. **Deploy with custom domain**:
   ```bash
   wrangler deploy
   ```

## 🔒 Production Security

### Essential Security Settings

1. **Rate Limiting** (adjust based on your needs):
   ```toml
   [vars]
   RATE_LIMIT_CREATE = "5"    # Conservative: 5 pastes/minute
   RATE_LIMIT_VIEW = "50"     # Conservative: 50 views/minute
   ```

2. **Content Limits**:
   ```toml
   [vars]
   MAX_PASTE_SIZE = "524288"  # 512KB (more conservative)
   MAX_TITLE_LENGTH = "100"   # Shorter titles
   ```

3. **Privacy Settings**:
   ```toml
   [vars]
   ANALYTICS_ENABLED = "false"  # Disable analytics for maximum privacy
   ```

### Security Headers

The application automatically sets these security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Monitoring

1. **Set up Wrangler tail** for real-time logs:
   ```bash
   wrangler tail
   ```

2. **Monitor in Cloudflare dashboard**:
   - Go to Workers & Pages → Your Worker → Metrics
   - Monitor requests, errors, and performance

## 📊 Environment Management

### Multiple Environments

1. **Development**:
   ```bash
   # Uses preview KV namespaces
   wrangler dev
   ```

2. **Staging**:
   ```toml
   # Create staging environment in wrangler.toml
   [env.staging]
   name = "secure-pastebin-staging"
   ```
   ```bash
   wrangler deploy --env staging
   ```

3. **Production**:
   ```bash
   wrangler deploy  # Uses main configuration
   ```

### Configuration Management

Use different configurations per environment:

```toml
# Development
[env.development.vars]
ANALYTICS_ENABLED = "false"
RATE_LIMIT_CREATE = "100"

# Staging
[env.staging.vars]
ANALYTICS_ENABLED = "true"
RATE_LIMIT_CREATE = "20"

# Production
[vars]
ANALYTICS_ENABLED = "true"
RATE_LIMIT_CREATE = "10"
```

## 📈 Scaling Considerations

### Performance Optimization

1. **KV Storage Optimization**:
   - Use appropriate TTL values
   - Monitor KV usage in dashboard
   - Consider data locality for global users

2. **Worker Performance**:
   - Keep bundle size minimal
   - Use efficient algorithms
   - Monitor CPU time usage

### Cost Management

1. **Cloudflare Workers Pricing**:
   - **Free Tier**: 100,000 requests/day
   - **Paid Plan**: $5/month for 10M requests
   - **KV Storage**: $0.50/GB-month stored

2. **Cost Optimization**:
   - Set appropriate paste expiry times
   - Monitor KV storage usage
   - Use rate limiting to prevent abuse

## 🔄 Updates and Maintenance

### Updating the Application

1. **Pull latest changes**:
   ```bash
   git pull origin main
   npm install  # Update dependencies if needed
   ```

2. **Test locally**:
   ```bash
   npm run dev
   ```

3. **Deploy update**:
   ```bash
   npm run deploy
   ```

### Database Maintenance

KV storage is automatically managed:
- **Expired pastes** are automatically deleted
- **No manual cleanup** required
- **Monitor usage** in Cloudflare dashboard

### Backup Strategy

1. **Code Backup**: Stored in Git repository
2. **Configuration Backup**: `wrangler.toml` in version control
3. **Data Backup**: Pastes are temporary by design (no backup needed)

## 🚨 Troubleshooting

### Common Issues

1. **KV Namespace Errors**:
   ```bash
   # Verify namespaces exist
   wrangler kv namespace list
   
   # Check wrangler.toml configuration
   cat wrangler.toml
   ```

2. **Deployment Failures**:
   ```bash
   # Check for TypeScript errors
   npm run type-check
   
   # Validate configuration
   wrangler deploy --dry-run
   ```

3. **Runtime Errors**:
   ```bash
   # View real-time logs
   wrangler tail
   
   # Check past logs in dashboard
   ```

### Debug Mode

1. **Enable debug logging**:
   ```toml
   [vars]
   DEBUG = "true"
   ```

2. **View detailed logs**:
   ```bash
   wrangler tail --format pretty
   ```

## 🌍 Alternative Platforms

While Cloudflare Workers is recommended, you can adapt this for other platforms:

### Vercel Edge Functions

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Adapt the code** for Vercel's edge runtime
3. **Configure `vercel.json`** for routing
4. **Deploy**: `vercel --prod`

### Netlify Edge Functions

1. **Adapt worker code** for Netlify's Deno runtime
2. **Configure `netlify.toml`** for edge functions
3. **Deploy via Git** or Netlify CLI

### AWS Lambda@Edge

1. **Adapt code** for Lambda runtime
2. **Configure CloudFormation** or CDK
3. **Deploy via AWS CLI** or console

## 📞 Support

If you encounter issues during deployment:

1. **Check the troubleshooting section** above
2. **Review Cloudflare Workers documentation**
3. **Create a GitHub issue** with deployment details
4. **Join the community** for help and discussion

---

**Happy deploying!** 🚀 Your secure pastebin will be live in minutes! 