/* ============================================================
   兰家 - 多端实时同步模块
   使用 BroadcastChannel + Storage Event 实现跨Tab实时通信
   ============================================================ */

const Sync = (() => {
  let channel = null;
  let listeners = {};
  const CHANNEL_NAME = 'lanjia-sync';

  // 初始化 BroadcastChannel
  function init() {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        const { type, payload } = event.data;
        emit(type, payload);
      };
      console.log('[Sync] BroadcastChannel initialized');
    } catch(e) {
      console.warn('[Sync] BroadcastChannel not available, using storage fallback');
    }

    // 监听其他tab的storage变化（兼容旧浏览器/微信）
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith('rx_')) return;
      try {
        const type = 'data-changed';
        const payload = { key: e.key, newValue: e.newValue, oldValue: e.oldValue };
        // 如果BroadcastChannel可用则跳过（避免重复通知）
        if (!channel) {
          emit(type, payload);
        }
      } catch(ex) {}
    });

    return true;
  }

  // 广播消息到其他Tab
  function broadcast(type, payload) {
    const message = { type, payload, timestamp: Date.now() };
    if (channel) {
      channel.postMessage(message);
    }
    // 手动触发storage事件以兼容
    try {
      const tempKey = '__rx_sync_trigger__';
      localStorage.setItem(tempKey, JSON.stringify(message));
      localStorage.removeItem(tempKey);
    } catch(e) {}
  }

  // 事件监听
  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    return () => off(event, callback);
  }

  function off(event, callback) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  }

  function emit(event, payload) {
    if (!listeners[event]) return;
    listeners[event].forEach(cb => {
      try { cb(payload); } catch(e) { console.error('[Sync] callback error:', e); }
    });
  }

  // 预定义的同步事件类型
  const EVENTS = {
    ORDER_NEW: 'order:new',           // 新订单
    ORDER_STATUS: 'order:status',     // 订单状态变更
    ORDER_ITEM_STATUS: 'order:item-status', // 菜品状态变更
    INVENTORY_UPDATE: 'inventory:update',   // 库存更新
    INVENTORY_LOW: 'inventory:low',   // 库存不足告警
    DISH_UPDATE: 'dish:update',       // 菜品更新
    TABLE_STATUS: 'table:status',     // 桌台状态变更
    DATA_CHANGED: 'data-changed',     // 通用数据变更
    REFRESH: 'refresh'                // 请求所有端刷新
  };

  return { init, broadcast, on, off, EVENTS };
})();
