(function initSiteBase() {
  const REPO_NAMES = ['AP-Learning-Web-01', 'AP-Learning-Web-02', 'AP-Learning-Web-03', 'AP-Learning-Web-04'];
  const isGitHubPages = window.location.hostname.endsWith('.github.io');

  let base = '';
  if (isGitHubPages) {
    if (window._b) { base = window._b; }
    else {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      base = '/' + (REPO_NAMES.includes(pathParts[0]) ? pathParts[0] : 'AP-Learning-Web');
    }
  }

  window.MOKAO_SITE_BASE = base;
  window.sitePath = function sitePath(pathname) {
    if (!pathname) return base || '/';
    if (/^(?:[a-z]+:)?\/\//i.test(pathname)) return pathname;
    const normalized = pathname.startsWith('/') ? pathname : '/' + pathname;
    return base + normalized;
  };

  // Dark Mode Theme Management
  const STORAGE_KEY = 'ap-theme';
  window.__getTheme = function() {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  };
  window.__setTheme = function(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    window.__applyTheme(theme);
  };
  window.toggleTheme = function() {
    const current = window.__getTheme();
    window.__setTheme(current === 'light' ? 'dark' : 'light');
  };
  window.__applyTheme = function(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  };

  // Fix hero image (hardcoded absolute path in CSS)
  if (isGitHubPages && base) {
    document.addEventListener('DOMContentLoaded', function() {
      var hero = document.querySelector('.hero-visual');
      if (hero) {
        var imgUrl = base + '/assets/images/home-hero.jpg';
        hero.style.backgroundImage = (
          'linear-gradient(180deg, rgba(255, 248, 241, 0.1), rgba(255, 248, 241, 0.08)), ' +
          'radial-gradient(circle at 20% 22%, rgba(255, 255, 255, 0.34), transparent 18%), ' +
          'radial-gradient(circle at 76% 24%, rgba(255, 214, 183, 0.7), transparent 20%), ' +
          'url("' + imgUrl + '")'
        );
      }
    });
  }
})();

// Apply theme BEFORE CSS loads to prevent flash
(function() {
  var theme = localStorage.getItem('ap-theme') || 'light';
  document.documentElement.dataset.theme = theme;
  window.__applyTheme(theme);
})();
