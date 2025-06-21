import { PasteData } from '../../core/storage';

export class ViewTemplate {
  static render(paste: PasteData): string {
    const escapedContent = this.escapeHtml(paste.content);
    const escapedTitle = this.escapeHtml(paste.title);
    const formattedDate = new Date(paste.createdAt).toLocaleString();
    const languageLabel = this.getLanguageLabel(paste.language);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle} - Secure Paste Share</title>
  <link rel="stylesheet" href="/styles/base.css">
  <link rel="stylesheet" href="/styles/components.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css">
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="View a secure, one-time paste">
</head>
<body>
  <div class="container">
    <div class="content-container">
      <header class="paste-header">
        <div class="paste-title-section">
          <h1 class="paste-title">${escapedTitle}</h1>
          <div class="paste-badges">
            <span class="language-badge" data-language="${paste.language}">
              ${languageLabel}
            </span>
            <span class="size-badge">
              ${this.formatBytes(paste.size)}
            </span>
          </div>
        </div>
        <div class="paste-actions">
          <button id="copyBtn" class="btn btn-secondary" title="Copy to clipboard">
            📋 Copy
          </button>
          <button id="downloadBtn" class="btn btn-secondary" title="Download as file">
            💾 Download
          </button>
        </div>
      </header>

      <main class="paste-content-section">
        <div class="content-wrapper">
          <div class="content-header">
            <div class="content-info">
              <span class="content-meta">
                Created: ${formattedDate}
              </span>
              <span class="content-meta">
                Lines: ${paste.content.split('\n').length}
              </span>
            </div>
            <div class="content-controls">
              <button id="wrapToggle" class="btn-icon" title="Toggle line wrap">
                🔄
              </button>
              <button id="fullscreenBtn" class="btn-icon" title="Toggle fullscreen">
                ⛶
              </button>
            </div>
          </div>
          
          <div class="paste-display" id="pasteDisplay">
            <pre class="line-numbers"><code class="language-${paste.language}" id="pasteContent">${escapedContent}</code></pre>
          </div>
        </div>
      </main>

      <div class="destruction-notice">
        <div class="destruction-icon">🔥</div>
        <div class="destruction-text">
          <strong>This paste has been destroyed</strong>
          <p>For security reasons, this paste can only be viewed once and has now been permanently deleted from our servers.</p>
        </div>
      </div>

      <footer class="paste-footer">
        <div class="footer-actions">
          <a href="/" class="btn btn-primary">
            ✨ Create New Paste
          </a>
          <button onclick="window.print()" class="btn btn-secondary">
            🖨️ Print
          </button>
        </div>
        
        <div class="footer-info">
          <p>Secure • One-time view • Auto-expiring</p>
        </div>
      </footer>
    </div>
  </div>

  <!-- Prism.js for syntax highlighting -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.js"></script>

  <script>
    // Clipboard functionality
    document.getElementById('copyBtn')?.addEventListener('click', async () => {
      const content = document.getElementById('pasteContent')?.textContent;
      if (content) {
        try {
          await navigator.clipboard.writeText(content);
          showNotification('Content copied to clipboard!', 'success');
        } catch (err) {
          console.error('Failed to copy:', err);
          showNotification('Failed to copy content', 'error');
        }
      }
    });

    // Download functionality
    document.getElementById('downloadBtn')?.addEventListener('click', () => {
      const content = document.getElementById('pasteContent')?.textContent;
      const title = '${paste.title.replace(/'/g, "\\'")}';
      const language = '${paste.language}';
      
      if (content) {
        const extension = getFileExtension(language);
        const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + extension;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('File downloaded!', 'success');
      }
    });

    // Line wrap toggle
    document.getElementById('wrapToggle')?.addEventListener('click', () => {
      const display = document.getElementById('pasteDisplay');
      if (display) {
        display.classList.toggle('line-wrap');
        showNotification(
          display.classList.contains('line-wrap') ? 'Line wrap enabled' : 'Line wrap disabled',
          'info'
        );
      }
    });

    // Fullscreen toggle
    document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
      const display = document.getElementById('pasteDisplay');
      if (display) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          display.requestFullscreen().catch(() => {
            showNotification('Fullscreen not supported', 'error');
          });
        }
      }
    });

    // Notification system
    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = \`notification notification-\${type}\`;
      notification.textContent = message;
      notification.setAttribute('role', 'alert');
      
      document.body.appendChild(notification);
      
      // Trigger animation
      setTimeout(() => notification.classList.add('show'), 10);
      
      // Remove after 3 seconds
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }

    // File extension mapping
    function getFileExtension(language) {
      const extensions = {
        javascript: '.js',
        typescript: '.ts',
        python: '.py',
        java: '.java',
        sql: '.sql',
        shell: '.sh',
        bash: '.sh',
        css: '.css',
        html: '.html',
        xml: '.xml',
        markdown: '.md',
        yaml: '.yml',
        json: '.json',
        dockerfile: '.dockerfile',
        go: '.go',
        rust: '.rs',
        cpp: '.cpp',
        c: '.c',
        php: '.php',
        ruby: '.rb',
        swift: '.swift',
        kotlin: '.kt'
      };
      return extensions[language] || '.txt';
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c':
            if (window.getSelection()?.toString() === '') {
              e.preventDefault();
              document.getElementById('copyBtn')?.click();
            }
            break;
          case 's':
            e.preventDefault();
            document.getElementById('downloadBtn')?.click();
            break;
          case 'p':
            e.preventDefault();
            window.print();
            break;
        }
      }
      
      if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen();
      }
    });

    // Initialize syntax highlighting
    if (typeof Prism !== 'undefined') {
      Prism.highlightAll();
    }
  </script>

  <style>
    .paste-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1.5rem;
      border-bottom: 2px solid var(--border-color);
      gap: 1rem;
    }

    .paste-title-section {
      flex: 1;
      min-width: 0;
    }

    .paste-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
      color: var(--text-color);
      word-break: break-word;
    }

    .paste-badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .language-badge {
      background: linear-gradient(135deg, var(--primary-color), #6c5ce7);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .size-badge {
      background: var(--text-muted);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .paste-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .content-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: var(--light-bg);
      border-bottom: 1px solid var(--border-color);
    }

    .content-info {
      display: flex;
      gap: 1rem;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .content-controls {
      display: flex;
      gap: 0.5rem;
    }

    .btn-icon {
      background: none;
      border: 1px solid var(--border-color);
      padding: 0.5rem;
      border-radius: var(--border-radius);
      cursor: pointer;
      font-size: 0.9rem;
      transition: var(--transition);
    }

    .btn-icon:hover {
      background: var(--primary-color);
      color: white;
      transform: translateY(-1px);
    }

    .paste-display {
      position: relative;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 14px;
      line-height: 1.5;
      overflow: auto;
      max-height: 70vh;
    }

    .paste-display.line-wrap pre {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .paste-display:fullscreen {
      max-height: 100vh;
      background: white;
      padding: 2rem;
    }

    .destruction-notice {
      background: linear-gradient(135deg, #e74c3c, #c0392b);
      color: white;
      padding: 1.5rem;
      margin: 1.5rem;
      border-radius: var(--border-radius);
      display: flex;
      align-items: center;
      gap: 1rem;
      animation: glow 2s ease-in-out infinite alternate;
    }

    .destruction-icon {
      font-size: 2rem;
      animation: flicker 1.5s ease-in-out infinite;
    }

    .destruction-text strong {
      display: block;
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }

    .destruction-text p {
      margin: 0;
      opacity: 0.9;
      font-size: 0.9rem;
    }

    .paste-footer {
      padding: 1.5rem;
      border-top: 1px solid var(--border-color);
      text-align: center;
    }

    .footer-actions {
      margin-bottom: 1rem;
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .footer-info {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      border-radius: var(--border-radius);
      color: white;
      font-weight: 600;
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 300px;
    }

    .notification.show {
      transform: translateX(0);
    }

    .notification-success {
      background: var(--success-color);
    }

    .notification-error {
      background: var(--danger-color);
    }

    .notification-info {
      background: var(--primary-color);
    }

    @keyframes glow {
      from { box-shadow: 0 0 10px rgba(231, 76, 60, 0.3); }
      to { box-shadow: 0 0 20px rgba(231, 76, 60, 0.6); }
    }

    @keyframes flicker {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    @media (max-width: 768px) {
      .paste-header {
        flex-direction: column;
        align-items: stretch;
      }

      .paste-actions {
        justify-content: center;
        margin-top: 1rem;
      }

      .content-header {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .destruction-notice {
        flex-direction: column;
        text-align: center;
      }

      .footer-actions {
        flex-direction: column;
        align-items: center;
      }

      .footer-actions .btn {
        width: 100%;
        max-width: 200px;
      }
    }

    @media print {
      .paste-header, .destruction-notice, .paste-footer {
        display: none !important;
      }
      
      .paste-display {
        max-height: none !important;
        overflow: visible !important;
      }
    }
  </style>
</body>
</html>`;
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

  private static formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private static getLanguageLabel(language: string): string {
    const labels: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'sql': 'SQL',
      'shell': 'Shell',
      'bash': 'Bash',
      'css': 'CSS',
      'html': 'HTML',
      'xml': 'XML',
      'markdown': 'Markdown',
      'yaml': 'YAML',
      'json': 'JSON',
      'dockerfile': 'Dockerfile',
      'go': 'Go',
      'rust': 'Rust',
      'cpp': 'C++',
      'c': 'C',
      'php': 'PHP',
      'ruby': 'Ruby',
      'swift': 'Swift',
      'kotlin': 'Kotlin',
      'text': 'Plain Text'
    };
    
    return labels[language] || language.toUpperCase();
  }
} 