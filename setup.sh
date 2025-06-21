#!/bin/bash

# 🔐 Secure Pastebin - Automated Setup Script
# This script automates the entire setup process for your own pastebin instance

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emojis
ROCKET="🚀"
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"
GEAR="⚙️"
SPARKLES="✨"

# Script configuration
SCRIPT_VERSION="1.0.0"
PROJECT_NAME="secure-pastebin"

# Print colored output
print_status() {
    echo -e "${BLUE}${INFO}${NC} $1"
}

print_success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

print_error() {
    echo -e "${RED}${CROSS}${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}${WARNING}${NC} $1"
}

print_header() {
    echo -e "${PURPLE}${SPARKLES}${NC} $1"
}

# Print banner
print_banner() {
    echo ""
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║                    ${ROCKET} SECURE PASTEBIN SETUP ${ROCKET}                    ║${NC}"
    echo -e "${PURPLE}║                                                              ║${NC}"
    echo -e "${PURPLE}║   Automated setup script for your own pastebin instance     ║${NC}"
    echo -e "${PURPLE}║   Live demo: https://1paste.dev                             ║${NC}"
    echo -e "${PURPLE}║   Version: ${SCRIPT_VERSION}                                          ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check system requirements
check_requirements() {
    print_header "Checking System Requirements..."
    
    local missing_deps=()
    
    # Check Node.js
    if command_exists node; then
        local node_version=$(node --version | sed 's/v//')
        local required_version="18.0.0"
        if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" = "$required_version" ]; then
            print_success "Node.js $node_version (✓ >= 18.0.0)"
        else
            print_error "Node.js $node_version (✗ < 18.0.0)"
            missing_deps+=("node")
        fi
    else
        print_error "Node.js not found"
        missing_deps+=("node")
    fi
    
    # Check npm
    if command_exists npm; then
        local npm_version=$(npm --version)
        print_success "npm $npm_version"
    else
        print_error "npm not found"
        missing_deps+=("npm")
    fi
    
    # Check git
    if command_exists git; then
        local git_version=$(git --version | cut -d' ' -f3)
        print_success "Git $git_version"
    else
        print_error "Git not found"
        missing_deps+=("git")
    fi
    
    # Check curl
    if command_exists curl; then
        print_success "curl available"
    else
        print_error "curl not found"
        missing_deps+=("curl")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        echo ""
        print_status "Please install the missing dependencies and run this script again."
        
        # Provide installation instructions based on OS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "macOS installation:"
            echo "  brew install node npm git curl"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "Ubuntu/Debian installation:"
            echo "  sudo apt-get update && sudo apt-get install nodejs npm git curl"
            echo ""
            echo "CentOS/RHEL installation:"
            echo "  sudo yum install nodejs npm git curl"
        fi
        
        exit 1
    fi
    
    print_success "All system requirements met!"
    echo ""
}

# Install Wrangler CLI
install_wrangler() {
    print_header "Installing Wrangler CLI..."
    
    if command_exists wrangler; then
        local wrangler_version=$(wrangler --version | head -n1 | cut -d' ' -f2)
        print_success "Wrangler $wrangler_version already installed"
    else
        print_status "Installing Wrangler CLI globally..."
        npm install -g wrangler
        print_success "Wrangler CLI installed successfully"
    fi
    echo ""
}

# Setup Cloudflare authentication
setup_cloudflare_auth() {
    print_header "Setting up Cloudflare Authentication..."
    
    print_status "Checking Cloudflare authentication status..."
    
    if wrangler whoami >/dev/null 2>&1; then
        local cf_email=$(wrangler whoami 2>/dev/null | grep -o 'email [^,]*' | cut -d' ' -f2 || echo "unknown")
        print_success "Already authenticated with Cloudflare ($cf_email)"
    else
        print_status "Opening Cloudflare login in your browser..."
        print_warning "Please complete the authentication process in your browser"
        wrangler login
        
        if wrangler whoami >/dev/null 2>&1; then
            print_success "Cloudflare authentication successful!"
        else
            print_error "Cloudflare authentication failed"
            exit 1
        fi
    fi
    echo ""
}

# Install project dependencies
install_dependencies() {
    print_header "Installing Project Dependencies..."
    
    if [ -f "package.json" ]; then
        print_status "Installing npm dependencies..."
        npm install
        print_success "Dependencies installed successfully"
    else
        print_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
    echo ""
}

# Create KV namespaces
create_kv_namespaces() {
    print_header "Creating Cloudflare KV Namespaces..."
    
    print_status "Creating PASTES_KV namespace..."
    local pastes_output=$(wrangler kv namespace create PASTES_KV 2>/dev/null)
    local pastes_id=$(echo "$pastes_output" | grep -o 'id = "[^"]*' | cut -d'"' -f2)
    
    print_status "Creating PASTES_KV preview namespace..."
    local pastes_preview_output=$(wrangler kv namespace create PASTES_KV --preview 2>/dev/null)
    local pastes_preview_id=$(echo "$pastes_preview_output" | grep -o 'id = "[^"]*' | cut -d'"' -f2)
    
    print_status "Creating ANALYTICS_KV namespace..."
    local analytics_output=$(wrangler kv namespace create ANALYTICS_KV 2>/dev/null)
    local analytics_id=$(echo "$analytics_output" | grep -o 'id = "[^"]*' | cut -d'"' -f2)
    
    print_status "Creating ANALYTICS_KV preview namespace..."
    local analytics_preview_output=$(wrangler kv namespace create ANALYTICS_KV --preview 2>/dev/null)
    local analytics_preview_id=$(echo "$analytics_preview_output" | grep -o 'id = "[^"]*' | cut -d'"' -f2)
    
    print_success "KV namespaces created successfully!"
    
    # Store IDs for later use
    export PASTES_ID="$pastes_id"
    export PASTES_PREVIEW_ID="$pastes_preview_id"
    export ANALYTICS_ID="$analytics_id"
    export ANALYTICS_PREVIEW_ID="$analytics_preview_id"
    
    echo "  PASTES_KV: $pastes_id"
    echo "  PASTES_KV (preview): $pastes_preview_id"
    echo "  ANALYTICS_KV: $analytics_id"
    echo "  ANALYTICS_KV (preview): $analytics_preview_id"
    echo ""
}

# Configure wrangler.toml
configure_wrangler() {
    print_header "Configuring wrangler.toml..."
    
    # Create a backup of the original
    if [ -f "wrangler.toml" ]; then
        cp wrangler.toml wrangler.toml.backup
        print_status "Created backup: wrangler.toml.backup"
    fi
    
    # Create the configured wrangler.toml
    cat > wrangler.toml << EOF
name = "$PROJECT_NAME"
main = "dist/worker.js"
compatibility_date = "2024-01-01"

# KV namespaces
[[kv_namespaces]]
binding = "PASTES_KV"
id = "$PASTES_ID"
preview_id = "$PASTES_PREVIEW_ID"

[[kv_namespaces]]
binding = "ANALYTICS_KV"
id = "$ANALYTICS_ID"
preview_id = "$ANALYTICS_PREVIEW_ID"

# Environment variables
[vars]
ENVIRONMENT = "production"
MAX_PASTE_SIZE = "1048576"  # 1MB
MAX_TITLE_LENGTH = "200"
DEFAULT_EXPIRY_HOURS = "24"
RATE_LIMIT_CREATE = "10"
RATE_LIMIT_VIEW = "100"
ANALYTICS_ENABLED = "true"

# Development environment
[env.development]
[env.development.vars]
ENVIRONMENT = "development"
MAX_PASTE_SIZE = "524288"  # 512KB for development
ANALYTICS_ENABLED = "false"

# Cron triggers for cleanup
[triggers]
crons = ["0 2 * * *"]  # Daily cleanup at 2 AM UTC
EOF
    
    print_success "wrangler.toml configured with your KV namespace IDs"
    echo ""
}

# Build the project
build_project() {
    print_header "Building Project..."
    
    print_status "Running TypeScript compiler..."
    npm run build
    print_success "Project built successfully"
    echo ""
}

# Deploy to Cloudflare Workers
deploy_project() {
    print_header "Deploying to Cloudflare Workers..."
    
    print_status "Deploying your pastebin to Cloudflare..."
    local deploy_output=$(wrangler deploy 2>&1)
    
    if echo "$deploy_output" | grep -q "Deployed"; then
        local worker_url=$(echo "$deploy_output" | grep -o 'https://[^[:space:]]*\.workers\.dev' | head -1)
        print_success "Deployment successful!"
        echo ""
        echo -e "${GREEN}${ROCKET} Your pastebin is now live at: ${CYAN}$worker_url${NC}"
        export WORKER_URL="$worker_url"
    else
        print_error "Deployment failed"
        echo "$deploy_output"
        exit 1
    fi
    echo ""
}

# Test the deployment
test_deployment() {
    print_header "Testing Deployment..."
    
    if [ -n "$WORKER_URL" ]; then
        print_status "Testing your pastebin..."
        
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL" || echo "000")
        
        if [ "$response" = "200" ]; then
            print_success "Your pastebin is responding correctly!"
        else
            print_warning "Deployment test returned HTTP $response"
            print_status "Your pastebin might still be starting up. Try accessing it in a few moments."
        fi
    fi
    echo ""
}

# Setup custom domain (optional)
setup_custom_domain() {
    print_header "Custom Domain Setup (Optional)..."
    
    echo -e "${CYAN}Would you like to set up a custom domain? (y/N):${NC}"
    read -r setup_domain
    
    if [[ $setup_domain =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}Enter your domain name (e.g., paste.yourdomain.com):${NC}"
        read -r domain_name
        
        if [ -n "$domain_name" ]; then
            print_status "To set up your custom domain:"
            echo "  1. Go to your Cloudflare dashboard: https://dash.cloudflare.com"
            echo "  2. Navigate to Workers & Pages → $PROJECT_NAME → Settings → Triggers"
            echo "  3. Click 'Add Custom Domain'"
            echo "  4. Enter: $domain_name"
            echo "  5. Cloudflare will automatically configure DNS"
            echo ""
            print_status "Your pastebin will then be available at: https://$domain_name"
        fi
    else
        print_status "Skipping custom domain setup"
    fi
    echo ""
}

# Generate summary
generate_summary() {
    print_header "Setup Complete! ${ROCKET}"
    
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                        ${CHECK} SUCCESS! ${CHECK}                         ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║  Your secure pastebin is now ready to use!                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ -n "$WORKER_URL" ]; then
        echo -e "${CYAN}${ROCKET} Live URL:${NC} $WORKER_URL"
    fi
    
    echo ""
    echo -e "${YELLOW}${GEAR} Next Steps:${NC}"
    echo "  • Test your pastebin by creating a paste"
    echo "  • Customize settings in wrangler.toml if needed"
    echo "  • Set up a custom domain (optional)"
    echo "  • Monitor usage in Cloudflare dashboard"
    echo ""
    
    echo -e "${BLUE}${INFO} Useful Commands:${NC}"
    echo "  • Start development: npm run dev"
    echo "  • Deploy updates: npm run deploy"
    echo "  • View logs: wrangler tail"
    echo "  • Check status: wrangler deployments list"
    echo ""
    
    echo -e "${PURPLE}${SPARKLES} Support:${NC}"
    echo "  • Documentation: README.md"
    echo "  • Issues: https://github.com/viralburst/pastebin/issues"
    echo "  • Original: https://1paste.dev"
    echo ""
}

# Main setup function
main() {
    print_banner
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -f "src/worker.ts" ]; then
        print_error "This doesn't appear to be the secure-pastebin directory"
        print_status "Please run this script from the project root directory"
        exit 1
    fi
    
    # Run setup steps
    check_requirements
    install_wrangler
    setup_cloudflare_auth
    install_dependencies
    create_kv_namespaces
    configure_wrangler
    build_project
    deploy_project
    test_deployment
    setup_custom_domain
    generate_summary
    
    print_success "Setup completed successfully! ${ROCKET}"
}

# Handle script interruption
trap 'echo -e "\n${RED}${CROSS} Setup interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@" 