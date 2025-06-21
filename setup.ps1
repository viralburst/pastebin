# 🔐 Secure Pastebin - Automated Setup Script (Windows PowerShell)
# This script automates the entire setup process for your own pastebin instance

param(
    [switch]$SkipDependencyCheck,
    [switch]$SkipAuth,
    [string]$ProjectName = "secure-pastebin"
)

# Script configuration
$SCRIPT_VERSION = "1.0.0"
$ErrorActionPreference = "Stop"

# Colors and emojis
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    Magenta = "Magenta"
    Cyan = "Cyan"
}

$Emojis = @{
    Rocket = "🚀"
    Check = "✅"
    Cross = "❌"
    Warning = "⚠️"
    Info = "ℹ️"
    Gear = "⚙️"
    Sparkles = "✨"
}

# Helper functions
function Write-Status {
    param([string]$Message)
    Write-Host "$($Emojis.Info) $Message" -ForegroundColor $Colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "$($Emojis.Check) $Message" -ForegroundColor $Colors.Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "$($Emojis.Cross) $Message" -ForegroundColor $Colors.Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "$($Emojis.Warning) $Message" -ForegroundColor $Colors.Yellow
}

function Write-Header {
    param([string]$Message)
    Write-Host "$($Emojis.Sparkles) $Message" -ForegroundColor $Colors.Magenta
}

function Write-Banner {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor $Colors.Magenta
    Write-Host "║                    $($Emojis.Rocket) SECURE PASTEBIN SETUP $($Emojis.Rocket)                    ║" -ForegroundColor $Colors.Magenta
    Write-Host "║                                                              ║" -ForegroundColor $Colors.Magenta
    Write-Host "║   Automated setup script for your own pastebin instance     ║" -ForegroundColor $Colors.Magenta
    Write-Host "║   Live demo: https://1paste.dev                             ║" -ForegroundColor $Colors.Magenta
    Write-Host "║   Version: $SCRIPT_VERSION                                          ║" -ForegroundColor $Colors.Magenta
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor $Colors.Magenta
    Write-Host ""
}

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Test-Requirements {
    Write-Header "Checking System Requirements..."
    
    $missingDeps = @()
    
    # Check Node.js
    if (Test-Command "node") {
        $nodeVersion = (node --version).Replace("v", "")
        $requiredVersion = [Version]"18.0.0"
        $currentVersion = [Version]$nodeVersion
        
        if ($currentVersion -ge $requiredVersion) {
            Write-Success "Node.js $nodeVersion (✓ >= 18.0.0)"
        } else {
            Write-Error "Node.js $nodeVersion (✗ < 18.0.0)"
            $missingDeps += "node"
        }
    } else {
        Write-Error "Node.js not found"
        $missingDeps += "node"
    }
    
    # Check npm
    if (Test-Command "npm") {
        $npmVersion = npm --version
        Write-Success "npm $npmVersion"
    } else {
        Write-Error "npm not found"
        $missingDeps += "npm"
    }
    
    # Check git
    if (Test-Command "git") {
        $gitVersion = (git --version).Split(" ")[2]
        Write-Success "Git $gitVersion"
    } else {
        Write-Error "Git not found"
        $missingDeps += "git"
    }
    
    if ($missingDeps.Count -gt 0) {
        Write-Error "Missing dependencies: $($missingDeps -join ', ')"
        Write-Host ""
        Write-Status "Please install the missing dependencies:"
        Write-Host "  • Node.js: https://nodejs.org/en/download/"
        Write-Host "  • Git: https://git-scm.com/download/win"
        Write-Host "  • Or use Chocolatey: choco install nodejs git"
        Write-Host "  • Or use Winget: winget install OpenJS.NodeJS Git.Git"
        exit 1
    }
    
    Write-Success "All system requirements met!"
    Write-Host ""
}

function Install-Wrangler {
    Write-Header "Installing Wrangler CLI..."
    
    if (Test-Command "wrangler") {
        $wranglerVersion = (wrangler --version).Split(" ")[1]
        Write-Success "Wrangler $wranglerVersion already installed"
    } else {
        Write-Status "Installing Wrangler CLI globally..."
        npm install -g wrangler
        Write-Success "Wrangler CLI installed successfully"
    }
    Write-Host ""
}

function Setup-CloudflareAuth {
    Write-Header "Setting up Cloudflare Authentication..."
    
    Write-Status "Checking Cloudflare authentication status..."
    
    try {
        $whoami = wrangler whoami 2>$null
        if ($whoami) {
            $email = ($whoami | Select-String "email").ToString().Split(" ")[1]
            Write-Success "Already authenticated with Cloudflare ($email)"
        } else {
            throw "Not authenticated"
        }
    }
    catch {
        Write-Status "Opening Cloudflare login in your browser..."
        Write-Warning "Please complete the authentication process in your browser"
        wrangler login
        
        try {
            wrangler whoami | Out-Null
            Write-Success "Cloudflare authentication successful!"
        }
        catch {
            Write-Error "Cloudflare authentication failed"
            exit 1
        }
    }
    Write-Host ""
}

function Install-Dependencies {
    Write-Header "Installing Project Dependencies..."
    
    if (Test-Path "package.json") {
        Write-Status "Installing npm dependencies..."
        npm install
        Write-Success "Dependencies installed successfully"
    } else {
        Write-Error "package.json not found. Are you in the correct directory?"
        exit 1
    }
    Write-Host ""
}

function New-KVNamespaces {
    Write-Header "Creating Cloudflare KV Namespaces..."
    
    Write-Status "Creating PASTES_KV namespace..."
    $pastesOutput = wrangler kv namespace create PASTES_KV 2>$null
    $pastesId = ($pastesOutput | Select-String 'id = "([^"]*)"').Matches.Groups[1].Value
    
    Write-Status "Creating PASTES_KV preview namespace..."
    $pastesPreviewOutput = wrangler kv namespace create PASTES_KV --preview 2>$null
    $pastesPreviewId = ($pastesPreviewOutput | Select-String 'id = "([^"]*)"').Matches.Groups[1].Value
    
    Write-Status "Creating ANALYTICS_KV namespace..."
    $analyticsOutput = wrangler kv namespace create ANALYTICS_KV 2>$null
    $analyticsId = ($analyticsOutput | Select-String 'id = "([^"]*)"').Matches.Groups[1].Value
    
    Write-Status "Creating ANALYTICS_KV preview namespace..."
    $analyticsPreviewOutput = wrangler kv namespace create ANALYTICS_KV --preview 2>$null
    $analyticsPreviewId = ($analyticsPreviewOutput | Select-String 'id = "([^"]*)"').Matches.Groups[1].Value
    
    Write-Success "KV namespaces created successfully!"
    
    # Store IDs for later use
    $script:PastesId = $pastesId
    $script:PastesPreviewId = $pastesPreviewId
    $script:AnalyticsId = $analyticsId
    $script:AnalyticsPreviewId = $analyticsPreviewId
    
    Write-Host "  PASTES_KV: $pastesId"
    Write-Host "  PASTES_KV (preview): $pastesPreviewId"
    Write-Host "  ANALYTICS_KV: $analyticsId"
    Write-Host "  ANALYTICS_KV (preview): $analyticsPreviewId"
    Write-Host ""
}

function Set-WranglerConfig {
    Write-Header "Configuring wrangler.toml..."
    
    # Create a backup of the original
    if (Test-Path "wrangler.toml") {
        Copy-Item "wrangler.toml" "wrangler.toml.backup"
        Write-Status "Created backup: wrangler.toml.backup"
    }
    
    # Create the configured wrangler.toml
    $wranglerConfig = @"
name = "$ProjectName"
main = "dist/worker.js"
compatibility_date = "2024-01-01"

# KV namespaces
[[kv_namespaces]]
binding = "PASTES_KV"
id = "$($script:PastesId)"
preview_id = "$($script:PastesPreviewId)"

[[kv_namespaces]]
binding = "ANALYTICS_KV"
id = "$($script:AnalyticsId)"
preview_id = "$($script:AnalyticsPreviewId)"

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
"@
    
    Set-Content -Path "wrangler.toml" -Value $wranglerConfig
    Write-Success "wrangler.toml configured with your KV namespace IDs"
    Write-Host ""
}

function Build-Project {
    Write-Header "Building Project..."
    
    Write-Status "Running TypeScript compiler..."
    npm run build
    Write-Success "Project built successfully"
    Write-Host ""
}

function Deploy-Project {
    Write-Header "Deploying to Cloudflare Workers..."
    
    Write-Status "Deploying your pastebin to Cloudflare..."
    $deployOutput = wrangler deploy 2>&1
    
    if ($deployOutput -match "Deployed") {
        $workerUrl = ($deployOutput | Select-String "https://[^\s]*\.workers\.dev").Matches.Value
        Write-Success "Deployment successful!"
        Write-Host ""
        Write-Host "$($Emojis.Rocket) Your pastebin is now live at: " -ForegroundColor $Colors.Green -NoNewline
        Write-Host $workerUrl -ForegroundColor $Colors.Cyan
        $script:WorkerUrl = $workerUrl
    } else {
        Write-Error "Deployment failed"
        Write-Host $deployOutput
        exit 1
    }
    Write-Host ""
}

function Test-Deployment {
    Write-Header "Testing Deployment..."
    
    if ($script:WorkerUrl) {
        Write-Status "Testing your pastebin..."
        
        try {
            $response = Invoke-WebRequest -Uri $script:WorkerUrl -Method HEAD -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "Your pastebin is responding correctly!"
            } else {
                Write-Warning "Deployment test returned HTTP $($response.StatusCode)"
                Write-Status "Your pastebin might still be starting up. Try accessing it in a few moments."
            }
        }
        catch {
            Write-Warning "Could not test deployment automatically"
            Write-Status "Please test manually by visiting: $($script:WorkerUrl)"
        }
    }
    Write-Host ""
}

function Setup-CustomDomain {
    Write-Header "Custom Domain Setup (Optional)..."
    
    $setupDomain = Read-Host "Would you like to set up a custom domain? (y/N)"
    
    if ($setupDomain -match "^[Yy]$") {
        $domainName = Read-Host "Enter your domain name (e.g., paste.yourdomain.com)"
        
        if ($domainName) {
            Write-Status "To set up your custom domain:"
            Write-Host "  1. Go to your Cloudflare dashboard: https://dash.cloudflare.com"
            Write-Host "  2. Navigate to Workers & Pages → $ProjectName → Settings → Triggers"
            Write-Host "  3. Click 'Add Custom Domain'"
            Write-Host "  4. Enter: $domainName"
            Write-Host "  5. Cloudflare will automatically configure DNS"
            Write-Host ""
            Write-Status "Your pastebin will then be available at: https://$domainName"
        }
    } else {
        Write-Status "Skipping custom domain setup"
    }
    Write-Host ""
}

function Show-Summary {
    Write-Header "Setup Complete! $($Emojis.Rocket)"
    
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor $Colors.Green
    Write-Host "║                        $($Emojis.Check) SUCCESS! $($Emojis.Check)                         ║" -ForegroundColor $Colors.Green
    Write-Host "║                                                              ║" -ForegroundColor $Colors.Green
    Write-Host "║  Your secure pastebin is now ready to use!                  ║" -ForegroundColor $Colors.Green
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor $Colors.Green
    Write-Host ""
    
    if ($script:WorkerUrl) {
        Write-Host "$($Emojis.Rocket) Live URL: " -ForegroundColor $Colors.Cyan -NoNewline
        Write-Host $script:WorkerUrl
    }
    
    Write-Host ""
    Write-Host "$($Emojis.Gear) Next Steps:" -ForegroundColor $Colors.Yellow
    Write-Host "  • Test your pastebin by creating a paste"
    Write-Host "  • Customize settings in wrangler.toml if needed"
    Write-Host "  • Set up a custom domain (optional)"
    Write-Host "  • Monitor usage in Cloudflare dashboard"
    Write-Host ""
    
    Write-Host "$($Emojis.Info) Useful Commands:" -ForegroundColor $Colors.Blue
    Write-Host "  • Start development: npm run dev"
    Write-Host "  • Deploy updates: npm run deploy"
    Write-Host "  • View logs: wrangler tail"
    Write-Host "  • Check status: wrangler deployments list"
    Write-Host ""
    
    Write-Host "$($Emojis.Sparkles) Support:" -ForegroundColor $Colors.Magenta
    Write-Host "  • Documentation: README.md"
    Write-Host "  • Issues: https://github.com/viralburst/pastebin/issues"
    Write-Host "  • Original: https://1paste.dev"
    Write-Host ""
}

# Main execution
function Main {
    Write-Banner
    
    # Check if we're in the right directory
    if (-not (Test-Path "package.json") -or -not (Test-Path "src/worker.ts")) {
        Write-Error "This doesn't appear to be the secure-pastebin directory"
        Write-Status "Please run this script from the project root directory"
        exit 1
    }
    
    # Run setup steps
    if (-not $SkipDependencyCheck) { Test-Requirements }
    Install-Wrangler
    if (-not $SkipAuth) { Setup-CloudflareAuth }
    Install-Dependencies
    New-KVNamespaces
    Set-WranglerConfig
    Build-Project
    Deploy-Project
    Test-Deployment
    Setup-CustomDomain
    Show-Summary
    
    Write-Success "Setup completed successfully! $($Emojis.Rocket)"
}

# Handle Ctrl+C gracefully
try {
    Main
}
catch {
    Write-Host ""
    Write-Error "Setup interrupted or failed: $($_.Exception.Message)"
    exit 1
} 