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
