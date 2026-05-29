/* ============================================================
   兰家 - 主应用控制器
   路由管理、页面切换、Toast通知、模态框、全局状态
   ============================================================ */

const App = (() => {
  // === 路由配置 ===
  const routes = {};
  let currentRoute = null;
  let currentParams = {};
  let _pendingParams = null;

  // === Toast 通知 ===
  function showToast(message, type = '', duration = 2000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-12px) scale(0.95)';
      toast.style.transition = 'all 0.2s ease-in';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  // === 模态框 ===
  function showModal(title, contentHtml, footerHtml = '') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">${contentHtml}</div>
        ${footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : ''}
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeModal(overlay) {
    if (overlay) overlay.remove();
  }

  // === 确认对话框 ===
  function confirm(title, message, onConfirm) {
    const footer = `
      <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>
      <button class="btn btn-primary" id="modal-confirm-btn">确认</button>
    `;
    const modal = showModal(title, `<p style="color:var(--color-text-secondary)">${message}</p>`, footer);
    modal.querySelector('#modal-confirm-btn').addEventListener('click', () => {
      modal.remove();
      if (onConfirm) onConfirm();
    });
  }

  // === 路由注册 ===
  function registerRoute(route, handler) {
    routes[route] = handler;
  }

  // === 路由导航 ===
  function navigate(route, params = {}) {
    // 存储额外参数供 handleRoute 使用
    _pendingParams = params;
    const hash = route.replace(/:\w+/g, (match) => params[match.slice(1)] || '');
    window.location.hash = hash;
  }

  function getCurrentParams() {
    return currentParams;
  }

  // === 获取 hash 参数 ===
  function parseHash() {
    const hash = window.location.hash.slice(1) || 'home';
    const parts = hash.split('/');
    return {
      fullPath: hash,
      baseRoute: parts[0],
      subPath: parts.slice(1).join('/'),
      parts: parts
    };
  }

  // === 处理路由变化 ===
  function handleRoute() {
    const { fullPath, baseRoute, parts } = parseHash();
    console.log('[Router] handleRoute:', { fullPath, baseRoute, parts, pendingParams: _pendingParams });

    // 尝试匹配路由：先匹配完整路径，再回退到基础路径
    let handler = routes[fullPath];
    let matchedRoute = fullPath;
    if (!handler) {
      handler = routes[baseRoute];
      matchedRoute = baseRoute;
    }
    console.log('[Router] handler found:', !!handler, 'matchedRoute:', matchedRoute);

    // 构建参数（合并 pending params）
    const params = {};
    if (_pendingParams) {
      Object.assign(params, _pendingParams);
      _pendingParams = null;
    }
    if (parts.length > 1 && baseRoute === 'ordering') {
      params.tableId = parts[1];
    }
    if (parts.length > 1 && baseRoute === 'admin' && parts[1]) {
      // admin子路由通过navigate传参
    }
    currentParams = params;
    console.log('[Router] params:', JSON.stringify(params));

    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // 更新底部导航 - 匹配基础路由
    document.querySelectorAll('.tabbar-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.route === baseRoute) item.classList.add('active');
    });

    // 处理首页
    if (baseRoute === 'home' || (!handler && baseRoute === 'home')) {
      document.getElementById('page-home').classList.add('active');
      setNavbar('兰家', false);
      return;
    }

    // 查找并执行路由处理器
    if (handler) {
      try {
        handler(params);
      } catch(e) {
        console.error('[Router] Error rendering route:', fullPath, e);
        showToast('页面加载失败', 'error');
      }
    } else {
      navigate('home');
    }
  }

  // === 应用初始化 ===
  function init() {
    // 初始化数据
    DB.initDemoData();

    // 初始化同步
    Sync.init();

    // 初始化路由监听
    window.addEventListener('hashchange', handleRoute);

    // 底部Tab导航
    document.querySelectorAll('.tabbar-item').forEach(item => {
      item.addEventListener('click', () => {
        const route = item.dataset.route;
        if (route) navigate(route);
      });
    });

    // 全局返回按钮
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-back]')) {
        const target = e.target.closest('[data-back]').dataset.back;
        navigate(target);
      }
    });

    // 处理初始路由
    handleRoute();

    // 监听同步事件 - 订单变更时自动刷新页面
    Sync.on(Sync.EVENTS.ORDER_NEW, () => {
      showToast('收到新订单', 'success');
      handleRoute(); // 刷新当前页面
    });

    Sync.on(Sync.EVENTS.ORDER_STATUS, () => {
      handleRoute();
    });

    Sync.on(Sync.EVENTS.INVENTORY_LOW, (payload) => {
      showToast('⚠️ 库存不足：' + payload.name, 'warning', 4000);
    });

    Sync.on(Sync.EVENTS.DATA_CHANGED, () => {
      handleRoute();
    });

    console.log('[App] 兰家 餐饮管理系统已启动');
  }

  // === 工具函数：格式化金额 ===
  function formatMoney(amount) {
    return '¥' + (amount || 0).toFixed(2);
  }

  // === 工具函数：格式化日期 ===
  function formatDate(dateStr, withTime = false) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('zh-CN');
    if (withTime) {
      const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      return date + ' ' + time;
    }
    return date;
  }

  // === 工具函数：获取今日日期 YYYY-MM-DD ===
  function today() {
    return new Date().toISOString().split('T')[0];
  }

  // === 工具函数：过去N天的日期范围 ===
  function dateRange(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  // === 全局面包屑导航 ===
  function setNavbar(title, showBack = false, backRoute = 'home') {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    navbar.querySelector('.navbar-title').textContent = title;
    const backBtn = navbar.querySelector('.navbar-back');
    if (showBack) {
      backBtn.style.display = 'flex';
      backBtn.dataset.back = backRoute;
    } else {
      backBtn.style.display = 'none';
    }
  }

  return {
    init, navigate, registerRoute, getCurrentParams,
    showToast, showModal, closeModal, confirm,
    setNavbar,
    formatMoney, formatDate, today, dateRange,
    KEYS: DB.KEYS
  };
})();

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => App.init());
