# 🛠️ Repository Setup Guide

This guide helps you customize the repository after forking it to your own GitHub account.

## 📋 After Forking This Repository

When you fork this repository, you'll need to update a few placeholder values to make the deploy buttons and documentation work correctly.

### 1. Update Repository References

Replace these placeholders in the following files with your actual GitHub information:

- `YOUR_USERNAME` → your GitHub username
- `YOUR_REPO_NAME` → your repository name (probably `pastebin` or `secure-pastebin`)

### 2. Files to Update

#### README.md
```bash
# Find and replace in README.md
sed -i 's/YOUR_USERNAME/your-github-username/g' README.md
sed -i 's/YOUR_REPO_NAME/your-repo-name/g' README.md
```

#### DEPLOYMENT.md
```bash
# Find and replace in DEPLOYMENT.md  
sed -i 's/YOUR_USERNAME/your-github-username/g' DEPLOYMENT.md
sed -i 's/YOUR_REPO_NAME/your-repo-name/g' DEPLOYMENT.md
```

#### package.json
```bash
# Find and replace in package.json
sed -i 's/YOUR_USERNAME/your-github-username/g' package.json
sed -i 's/YOUR_REPO_NAME/your-repo-name/g' package.json
```

### 3. Quick Setup Script

You can run this script to update all files at once:

```bash
#!/bin/bash
# Replace with your actual values
GITHUB_USERNAME="your-github-username"
REPO_NAME="your-repo-name"

# Update all files
sed -i "s/YOUR_USERNAME/$GITHUB_USERNAME/g" README.md DEPLOYMENT.md package.json CONTRIBUTING.md SECURITY.md
sed -i "s/YOUR_REPO_NAME/$REPO_NAME/g" README.md DEPLOYMENT.md package.json CONTRIBUTING.md SECURITY.md

echo "✅ Repository customized for $GITHUB_USERNAME/$REPO_NAME"
```

### 4. Test the Deploy Button

After updating the placeholders, your deploy button should work:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/YOUR_REPO_NAME)

### 5. Commit Your Changes

```bash
git add .
git commit -m "📝 Customize repository for my GitHub account"
git push
```

## 🚀 Ready to Deploy

Once you've updated the placeholders:

1. **One-click deploy** will work from your repository
2. **Documentation links** will point to your repo
3. **Contributors** can easily find and fork your version

## 💡 Why This Approach?

This approach ensures:
- **Generic template**: Anyone can fork and use immediately
- **No hardcoded values**: Deploy buttons work for any GitHub user
- **Easy customization**: Simple find-and-replace to personalize
- **Professional appearance**: Looks polished and production-ready

---

**Need help?** Check the main [README.md](README.md) or [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions! 