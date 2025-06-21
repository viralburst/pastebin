# Security Policy

## 🛡️ Supported Versions

We actively support the following versions of Secure Pastebin with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Fully supported |
| < 1.0   | ❌ Not supported   |

## 🚨 Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### 📧 Private Disclosure

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please email us directly at:
- **Email**: security@your-domain.com (replace with your actual email)
- **Subject**: [SECURITY] Brief description of the vulnerability

### 📋 What to Include

Please include the following information in your report:

1. **Vulnerability Description**: Clear description of the security issue
2. **Impact Assessment**: What could an attacker achieve?
3. **Reproduction Steps**: Step-by-step instructions to reproduce the issue
4. **Proof of Concept**: Code, screenshots, or examples (if applicable)
5. **Suggested Fix**: If you have ideas for how to fix it
6. **Your Contact Info**: How we can reach you for follow-up questions

### ⏰ Response Timeline

We are committed to responding quickly to security reports:

- **Initial Response**: Within 24 hours
- **Status Update**: Within 72 hours
- **Fix Timeline**: Within 7 days for critical issues, 30 days for others

### 🏆 Recognition

Security researchers who responsibly disclose vulnerabilities will be:

- **Credited** in our security advisories (if desired)
- **Listed** in our hall of fame
- **Thanked** publicly (with permission)

## 🔒 Security Measures

### Current Protections

Secure Pastebin implements multiple layers of security:

#### Input Validation & Sanitization
- **HTML Escaping**: All user content is escaped to prevent XSS attacks
- **Content Validation**: Suspicious patterns are detected and flagged
- **Size Limits**: Configurable maximum paste size (default: 1MB)
- **Character Encoding**: Proper UTF-8 handling and validation

#### Access Control
- **Secure IDs**: Cryptographically secure paste identifiers (12+ characters)
- **No Enumeration**: Paste IDs cannot be guessed or brute-forced
- **One-Time View**: Optional automatic deletion after first access
- **Manual Deletion**: Recipients can delete pastes before expiration

#### Rate Limiting
- **Creation Limits**: Configurable per-IP paste creation limits
- **View Limits**: Configurable per-IP paste viewing limits
- **Abuse Prevention**: Automatic blocking of suspicious activity

#### Data Protection
- **Automatic Cleanup**: Expired pastes are automatically deleted
- **No Persistent Storage**: No permanent data storage beyond expiry
- **IP Hashing**: IP addresses are hashed for analytics (not stored raw)
- **Minimal Logging**: Only essential error information is logged

#### Infrastructure Security
- **Edge Computing**: Runs on Cloudflare's secure global network
- **TLS Encryption**: All traffic is encrypted in transit
- **KV Storage**: Distributed storage with automatic TTL cleanup
- **Zero Dependencies**: Minimal external dependencies reduce attack surface

### Known Limitations

We are transparent about current limitations:

1. **KV TTL Precision**: Cloudflare KV TTL is approximate, not exact
2. **Rate Limiting**: Current implementation is basic; consider Durable Objects for stricter enforcement
3. **Content Scanning**: Pattern detection is heuristic-based, not comprehensive
4. **Analytics Privacy**: While IP addresses are hashed, consider disabling for maximum privacy

## 🚫 Out of Scope

The following are generally considered out of scope for security reports:

### Expected Behavior
- **Public Pastes**: Pastes are designed to be publicly accessible via their URLs
- **No Authentication**: The service is intentionally anonymous
- **Temporary Storage**: Data is not permanently stored

### Low-Impact Issues
- **Social Engineering**: Issues requiring user interaction beyond normal usage
- **Physical Access**: Issues requiring physical access to user devices
- **Browser Extensions**: Issues specific to third-party browser extensions
- **Denial of Service**: Basic DoS attacks (rate limiting handles this)

### Third-Party Services
- **Cloudflare Issues**: Security issues in Cloudflare's infrastructure
- **Browser Bugs**: Security issues in specific browsers
- **Network Issues**: Issues with user's network or ISP

## 🔧 Security Configuration

### Recommended Settings

For production deployments, we recommend:

```toml
# wrangler.toml
[vars]
MAX_PASTE_SIZE = "524288"        # 512KB max (reduce for tighter security)
RATE_LIMIT_CREATE = "5"          # 5 pastes per minute per IP
RATE_LIMIT_VIEW = "50"           # 50 views per minute per IP
ANALYTICS_ENABLED = "false"      # Disable for maximum privacy
```

### Security Headers

The application automatically sets security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'` (planned)

### Environment Security

- **Secrets Management**: Use Wrangler secrets for sensitive configuration
- **Environment Separation**: Use separate KV namespaces for dev/staging/prod
- **Access Control**: Limit Cloudflare account access to necessary personnel

## 🔍 Security Auditing

### Self-Assessment

Regularly review your deployment:

1. **Check KV Storage**: Monitor for unusual paste patterns
2. **Review Analytics**: Look for suspicious usage patterns
3. **Monitor Logs**: Check Wrangler logs for errors or attacks
4. **Test Rate Limits**: Verify rate limiting is working correctly

### Third-Party Audits

We welcome security audits from:

- **Security Researchers**: Independent security reviews
- **Bug Bounty Platforms**: Coordinated disclosure programs
- **Enterprise Users**: Internal security assessments

## 📚 Security Resources

### Documentation
- [Cloudflare Workers Security](https://developers.cloudflare.com/workers/platform/security/)
- [OWASP Web Security](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

### Tools
- [Wrangler Security Scanning](https://developers.cloudflare.com/workers/wrangler/)
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) for dependency scanning
- [TypeScript strict mode](https://www.typescriptlang.org/tsconfig#strict) for type safety

## 📞 Contact

For security-related questions or concerns:

- **Security Email**: security@your-domain.com
- **General Issues**: [GitHub Issues](https://github.com/viralburst/pastebin/issues)
- **Documentation**: This SECURITY.md file

---

**Thank you for helping keep Secure Pastebin secure!** 🔒 