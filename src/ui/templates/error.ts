export class ErrorTemplate {
  static notFound(): string {
    return ErrorTemplate.render(
      'Paste Not Found',
      'The requested paste does not exist, has already been viewed, or has expired.',
      '404'
    );
  }

  static expired(): string {
    return ErrorTemplate.render(
      'Paste Expired',
      'This paste has expired and is no longer available. Pastes are automatically deleted after their expiration time.',
      'expired'
    );
  }

  static serverError(): string {
    return ErrorTemplate.render(
      'Server Error',
      'An unexpected error occurred while processing your request. Please try again later.',
      '500'
    );
  }

  static rateLimit(): string {
    return ErrorTemplate.render(
      'Rate Limited',
      'Too many requests. Please wait a moment before trying again.',
      'rate-limit'
    );
  }

  static forbidden(): string {
    return ErrorTemplate.render(
      'Access Forbidden',
      'You do not have permission to access this resource.',
      '403'
    );
  }

  private static render(title: string, message: string, errorType: string): string {
    const iconMap: Record<string, string> = {
      '404': '🔍',
      'expired': '⏰',
      '500': '⚠️',
      'rate-limit': '🚦',
      '403': '🔒'
    };

    const icon = iconMap[errorType] || '❌';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Secure Paste Share</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    :root {
      --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --primary-color: #667eea;
      --primary-dark: #5a67d8;
      --bg-color: #1a1b23;
      --surface-color: #2d2e3f;
      --border-color: #404155;
      --text-color: #ffffff;
      --text-muted: #a0a0a0;
      --success-color: #48bb78;
      --warning-color: #ed8936;
      --error-color: #f56565;
      --shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      --border-radius: 12px;
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .container {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .hero-section {
      background: var(--primary-gradient);
      padding: 3rem 2rem;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .hero-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="25" r="1" fill="white" opacity="0.05"/><circle cx="50" cy="50" r="1" fill="white" opacity="0.1"/><circle cx="25" cy="75" r="1" fill="white" opacity="0.05"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
      pointer-events: none;
    }

    .hero-content {
      position: relative;
      z-index: 1;
      max-width: 600px;
      margin: 0 auto;
    }

    .error-icon {
      font-size: 5rem;
      margin-bottom: 1.5rem;
      display: block;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
    }

    .hero-title {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 1rem;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .hero-subtitle {
      font-size: 1.25rem;
      opacity: 0.9;
      margin-bottom: 2rem;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }

    .main-content {
      flex: 1;
      padding: 3rem 2rem;
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
    }

    .error-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-bottom: 3rem;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.5rem;
      border: none;
      border-radius: var(--border-radius);
      font-size: 1rem;
      font-weight: 600;
      text-decoration: none;
      transition: var(--transition);
      cursor: pointer;
      min-width: 140px;
      justify-content: center;
    }

    .btn-primary {
      background: var(--primary-gradient);
      color: white;
      box-shadow: var(--shadow);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: var(--surface-color);
      color: var(--text-color);
      border: 1px solid var(--border-color);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .btn-secondary:hover {
      background: var(--border-color);
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    }

    .error-details {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .error-details summary {
      cursor: pointer;
      font-weight: 600;
      font-size: 1.1rem;
      margin-bottom: 1rem;
      color: var(--text-color);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .error-details summary:hover {
      color: var(--primary-color);
    }

    .error-details summary::marker {
      color: var(--primary-color);
    }

    .error-explanation {
      color: var(--text-muted);
      line-height: 1.7;
      margin-top: 1rem;
    }

    .error-explanation p {
      margin-bottom: 1rem;
    }

    .error-explanation ul {
      margin: 1rem 0;
      padding-left: 1.5rem;
    }

    .error-explanation li {
      margin-bottom: 0.5rem;
    }

    .error-explanation strong {
      color: var(--text-color);
    }

    @media (max-width: 768px) {
      .hero-section {
        padding: 2rem 1rem;
      }

      .hero-title {
        font-size: 2.5rem;
      }

      .hero-subtitle {
        font-size: 1.1rem;
      }

      .main-content {
        padding: 2rem 1rem;
      }

      .error-actions {
        flex-direction: column;
        align-items: center;
      }

      .btn {
        width: 100%;
        max-width: 280px;
      }

      .error-icon {
        font-size: 4rem;
      }
    }

    @media (max-width: 480px) {
      .hero-title {
        font-size: 2rem;
      }

      .hero-subtitle {
        font-size: 1rem;
      }

      .error-icon {
        font-size: 3.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero-section">
      <div class="hero-content">
        <div class="error-icon" role="img" aria-label="Error icon">${icon}</div>
        <h1 class="hero-title">${this.escapeHtml(title)}</h1>
        <p class="hero-subtitle">${this.escapeHtml(message)}</p>
      </div>
    </div>
    
    <div class="main-content">
      <div class="error-actions">
        <a href="/" class="btn btn-primary">
          🏠 Go Home
        </a>
        <button onclick="history.back()" class="btn btn-secondary">
          ← Go Back
        </button>
      </div>
      
      <div class="error-details">
        <details>
          <summary>💡 What happened?</summary>
          <div class="error-explanation">
            ${this.getExplanation(errorType)}
          </div>
        </details>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private static getExplanation(errorType: string): string {
    const explanations: Record<string, string> = {
      '404': `
        <p><strong>Paste not found:</strong> This usually means one of the following:</p>
        <ul>
          <li><strong>Already viewed:</strong> The paste was configured for one-time viewing and has already been accessed</li>
          <li><strong>Expired:</strong> The paste has reached its expiration time and was automatically deleted</li>
          <li><strong>Invalid ID:</strong> The paste ID in the URL is incorrect or malformed</li>
          <li><strong>Never existed:</strong> No paste was ever created with this ID</li>
        </ul>
        <p>🔒 <strong>Security Note:</strong> All pastes are designed to be viewed only once for maximum security. Once viewed, they are immediately deleted to prevent unauthorized access.</p>
      `,
      'expired': `
        <p><strong>Paste expired:</strong> This paste has reached its expiration time and has been automatically deleted.</p>
        <p>⏰ Pastes are automatically removed when they expire to ensure sensitive data doesn't persist longer than intended. This is a security feature to protect your information.</p>
        <p>💡 <strong>Tip:</strong> When creating a new paste, you can set a longer expiration time if you need the paste to be available for a longer period.</p>
      `,
      '500': `
        <p><strong>Server error:</strong> Something went wrong on our end while processing your request.</p>
        <p>🔧 This is usually a temporary issue. Please try again in a few moments.</p>
        <p>If the problem persists, the service may be experiencing technical difficulties. We're working to resolve any issues as quickly as possible.</p>
      `,
      'rate-limit': `
        <p><strong>Rate limited:</strong> You've made too many requests in a short time period.</p>
        <p>🚦 This protection helps prevent abuse and ensures the service remains available for everyone.</p>
        <p>⏳ Please wait a moment before making another request. The limit will reset automatically.</p>
      `,
      '403': `
        <p><strong>Access forbidden:</strong> You don't have permission to access this resource.</p>
        <p>🔒 This could be due to security restrictions, authentication requirements, or access control policies.</p>
        <p>If you believe you should have access to this resource, please check your permissions or contact support.</p>
      `
    };

    return explanations[errorType] || '<p>An unknown error occurred. Please try again or contact support if the problem persists.</p>';
  }

  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m] || m);
  }
} 