/**
 * AP Learning — 统一导航栏组件
 * 所有页面引入此文件，导航链接自动归一
 * 
 * 使用方法：
 *   <script src="/assets/nav.js" defer></script>
 *   <nav id="ap-nav"></nav>
 *   或任何 <nav> / .site-header 元素
 */

(function () {
  'use strict';

  // 统一路径配置 — 改这里一处，全站生效
  var ROUTES = {
    home:      '/',
    mock:      '/mock/',
    training:  '/training/',
    wrong:     '/wrong-notebook/',
    dashboard: '/dashboard/'
  };

  // 页面标识：用于高亮当前页
  var path = location.pathname.replace(/\/+$/, '') + '/';
  var active = 'home';
  if (path.indexOf('/mock/') !== -1)       active = 'mock';
  else if (path.indexOf('/training/') !== -1) active = 'training';
  else if (path.indexOf('wrong-notebook') !== -1) active = 'wrong';
  else if (path.indexOf('/dashboard/') !== -1 || path.indexOf('/v2/dashboard/') !== -1) active = 'dashboard';

  // sitePath helper
  var baseMatch = location.pathname.match(/^\/(AP-Learning-Web-0\d)(?:\/|$)/);
  var base = baseMatch ? '/' + baseMatch[1] : '';
  function sitePath(p) {
    if (/^(?:[a-z]+:)?\/\//i.test(p)) return p;
    return base + (p.startsWith('/') ? p : '/' + p);
  }

  function buildNav() {
    var items = [
      { id: 'home',      label: '首页' },
      { id: 'mock',      label: '套题模考' },
      { id: 'training',  label: '专项训练' },
      { id: 'wrong',     label: '错题本' },
      { id: 'dashboard', label: 'Dashboard' }
    ];

    return items.map(function (item) {
      var cls = item.id === active ? 'is-active' : '';
      return '<a class="' + cls + '" href="' + sitePath(ROUTES[item.id]) + '">' + item.label + '</a>';
    }).join('\n');
  }

  // 注入到已有 nav 元素，或 .site-header，或创建新的
  function inject() {
    var container =
      document.getElementById('ap-nav') ||
      document.querySelector('.site-header .nav-main') ||
      document.querySelector('.nav-main') ||
      document.querySelector('nav.nav-main');

    if (!container) {
      // 没找到容器 — 找 .site-header 的 shell.nav
      var shell = document.querySelector('.site-header .shell.nav') ||
                  document.querySelector('.shell.nav');
      if (shell) {
        container = document.createElement('nav');
        container.className = 'nav-main';
        container.setAttribute('aria-label', 'Primary');
        shell.appendChild(container);
      }
    }

    if (container) {
      container.innerHTML = buildNav();
    }
  }

  // 同时把 sitePath 暴露给全局（兼容旧代码）
  window.sitePath = sitePath;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
