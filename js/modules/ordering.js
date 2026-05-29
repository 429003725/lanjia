/* ============================================================
   兰家 - 模块一：堂食看菜点菜 + 多端订单同步系统
   ============================================================ */

const OrderingModule = (() => {
  let currentTable = null;
  let cart = [];
  let selectedCategory = '全部';

  // === 主点菜页面 ===
  function renderOrdering(params) {
    console.log('[Ordering] renderOrdering called, params:', JSON.stringify(params));
    App.setNavbar('堂食点菜', true, 'home');

    const tableId = params.tableId || null;
    const page = document.getElementById('page-ordering');
    console.log('[Ordering] page element:', page);
    page.classList.add('active');

    // 如果指定了桌台，直接加载菜单
    if (tableId) {
      console.log('[Ordering] tableId from params:', tableId);
      currentTable = DB.Tables.getById(parseInt(tableId));
      console.log('[Ordering] currentTable:', currentTable);
      if (currentTable) {
        renderMenuPage(page);
      }
    } else {
      console.log('[Ordering] no tableId, showing table selection');
      // 先显示选桌页面
      renderTableSelection(page);
    }
  }

  // === 选桌页面 ===
  function renderTableSelection(container) {
    const tables = DB.Tables.getAll();
    const activeOrders = DB.Orders.query(o => o.status === 'dining');
    console.log('[Ordering] renderTableSelection: tables=' + tables.length + ', activeOrders=' + activeOrders.length);

    // 把函数暴露到全局，让内联onclick能调用
    window.__selectTable = function(tid) {
      const table = DB.Tables.getById(tid);
      const isOccupied = activeOrders.some(o => o.tableId === tid);
      if (isOccupied) {
        App.showToast('该桌台正在用餐中', 'warning');
        return;
      }
      currentTable = table;
      location.hash = 'ordering/' + tid;
    };

    container.innerHTML = `
      <div class="page-content">
        <div style="text-align:center;padding:var(--space-3xl) 0;">
          <div style="font-size:56px;margin-bottom:var(--space-lg)">🍽️</div>
          <h4>请选择桌台</h4>
          <p style="color:var(--color-text-tertiary);margin-top:var(--space-sm)">选择桌台后开始点菜</p>
        </div>
        <div class="grid-3" id="table-grid">
          ${tables.map(t => {
            const isOccupied = activeOrders.some(o => o.tableId === t.id);
            return `
              <div class="card table-card" data-table-id="${t.id}" onclick="__selectTable(${t.id})" style="text-align:center;cursor:pointer;${isOccupied ? 'opacity:0.5' : ''}">
                <div style="font-size:36px;margin-bottom:var(--space-sm)">🪑</div>
                <div style="font-weight:var(--font-semibold);font-size:var(--text-md)">${t.name}</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-tertiary)">${t.capacity}人桌</div>
                <span class="tag ${isOccupied ? 'tag-warning' : 'tag-success'}" style="margin-top:var(--space-sm)">${isOccupied ? '用餐中' : '空闲'}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // 同时也绑定事件（作为备份）
    const cards = container.querySelectorAll('.table-card');
    console.log('[Ordering] Found table cards:', cards.length);
  }

  // === 菜单页面 ===
  function renderMenuPage(container) {
    const dishes = DB.Dishes.getAll();
    const categories = ['全部', ...new Set(dishes.map(d => d.category))];

    container.innerHTML = `
      <div class="page-content">
        <!-- 桌台信息 -->
        <div class="card-glass" style="padding:var(--space-lg) var(--space-xl);margin-bottom:var(--space-xl);display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:var(--text-sm);color:var(--color-text-tertiary)">当前桌台</div>
            <div style="font-size:var(--text-xl);font-weight:var(--font-bold)">${currentTable.name}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:var(--text-sm);color:var(--color-text-tertiary)">已选菜品</div>
            <div style="font-size:var(--text-xl);font-weight:var(--font-bold);color:var(--color-primary)" id="cart-count-top">${cart.length} 道</div>
          </div>
        </div>

        <!-- 分类标签 -->
        <div class="category-tabs" id="category-tabs">
          ${categories.map(cat => `
            <button class="category-tab ${cat === selectedCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>
          `).join('')}
        </div>

        <!-- 菜品网格 -->
        <div class="menu-grid" id="menu-grid">
          ${renderDishCards(dishes, selectedCategory)}
        </div>

        <!-- 已选购物车浮动按钮 -->
        ${cart.length > 0 ? `
        <div style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:140">
          <button class="btn btn-primary btn-lg" id="btn-view-cart" style="box-shadow:var(--shadow-xl)">
            🛒 查看已选 (${cart.length}) - ${App.formatMoney(calcCartTotal())}
          </button>
        </div>
        ` : ''}
      </div>

      <!-- 购物车面板 -->
      <div class="cart-panel" id="cart-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg)">
          <h5>已选菜品</h5>
          <button class="btn btn-ghost btn-sm" id="btn-clear-cart">清空</button>
        </div>
        <div id="cart-items" style="max-height:300px;overflow-y:auto;margin-bottom:var(--space-lg)">
          ${renderCartItems()}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:var(--space-lg);border-top:1px solid var(--color-separator)">
          <div>
            <div style="font-size:var(--text-sm);color:var(--color-text-tertiary)">合计</div>
            <div style="font-size:var(--text-2xl);font-weight:var(--font-bold);color:var(--color-danger)">${App.formatMoney(calcCartTotal())}</div>
          </div>
          <button class="btn btn-primary btn-lg" id="btn-submit-order">确认下单</button>
        </div>
      </div>
    `;

    // 绑定事件
    bindMenuEvents(container, dishes);
  }

  function renderDishCards(dishes, category) {
    const filtered = category === '全部' ? dishes : dishes.filter(d => d.category === category);
    if (filtered.length === 0) {
      return `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">暂无菜品</div></div>`;
    }
    return filtered.map(d => `
      <div class="menu-card" data-dish-id="${d.id}">
        <div class="menu-card-image">
          <span class="emoji">${d.emoji || '🍽️'}</span>
        </div>
        <div class="menu-card-info">
          <div class="menu-card-name">${d.name}</div>
          <div class="menu-card-price">${App.formatMoney(d.price)}</div>
        </div>
      </div>
    `).join('');
  }

  function renderCartItems() {
    if (cart.length === 0) {
      return `<div style="text-align:center;padding:var(--space-xl);color:var(--color-text-tertiary)">购物车为空，请添加菜品</div>`;
    }
    return cart.map((item, idx) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-md) 0;border-bottom:1px solid var(--color-separator)">
        <div style="flex:1">
          <div style="font-weight:var(--font-medium)">${item.name}</div>
          <div style="font-size:var(--text-sm);color:var(--color-text-tertiary)">${App.formatMoney(item.price)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-md)">
          <button class="btn btn-icon btn-ghost cart-qty-btn" data-idx="${idx}" data-action="minus" style="width:28px;height:28px;font-size:16px">−</button>
          <span style="font-weight:var(--font-semibold);min-width:24px;text-align:center">${item.quantity}</span>
          <button class="btn btn-icon btn-ghost cart-qty-btn" data-idx="${idx}" data-action="plus" style="width:28px;height:28px;font-size:16px">+</button>
        </div>
      </div>
    `).join('');
  }

  function calcCartTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function bindMenuEvents(container, dishes) {
    // 分类切换
    container.querySelectorAll('.category-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        selectedCategory = tab.dataset.category;
        container.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        container.querySelector('#menu-grid').innerHTML = renderDishCards(dishes, selectedCategory);
        bindDishClicks(container, dishes);
      });
    });

    // 菜品点击
    bindDishClicks(container, dishes);

    // 查看购物车
    const cartPanel = container.querySelector('#cart-panel');
    const btnViewCart = container.querySelector('#btn-view-cart');
    if (btnViewCart) {
      btnViewCart.addEventListener('click', () => {
        cartPanel.classList.toggle('open');
        updateCartUI(container);
      });
    }

    // 清空购物车
    const btnClear = container.querySelector('#btn-clear-cart');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        App.confirm('清空购物车', '确定清空所有已选菜品吗？', () => {
          cart = [];
          updateCartUI(container);
          cartPanel.classList.remove('open');
          renderMenuPage(container);
        });
      });
    }

    // 购物车数量调整（使用事件委托）
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.cart-qty-btn');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;
      if (action === 'plus') {
        cart[idx].quantity++;
      } else if (action === 'minus') {
        if (cart[idx].quantity <= 1) {
          cart.splice(idx, 1);
        } else {
          cart[idx].quantity--;
        }
      }
      updateCartUI(container);
    });

    // 提交订单
    const btnSubmit = container.querySelector('#btn-submit-order');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => submitOrder(container, cartPanel));
    }
  }

  function bindDishClicks(container, dishes) {
    container.querySelectorAll('.menu-card').forEach(card => {
      card.addEventListener('click', () => {
        const dishId = parseInt(card.dataset.dishId);
        const dish = dishes.find(d => d.id === dishId);
        if (!dish) return;

        // 添加到购物车
        const existing = cart.findIndex(i => i.dishId === dishId);
        if (existing >= 0) {
          cart[existing].quantity++;
        } else {
          cart.push({
            dishId: dish.id,
            name: dish.name,
            price: dish.price,
            quantity: 1,
            emoji: dish.emoji
          });
        }
        App.showToast('已添加 ' + dish.name, 'success', 1200);
        updateCartUI(container);
      });
    });
  }

  function updateCartUI(container) {
    const cartItems = container.querySelector('#cart-items');
    const cartPanel = container.querySelector('#cart-panel');
    const cartCountTop = container.querySelector('#cart-count-top');

    if (cartItems) cartItems.innerHTML = renderCartItems();
    if (cartCountTop) cartCountTop.textContent = cart.length + ' 道';

    // 更新浮动按钮
    const oldBtn = container.querySelector('#btn-view-cart');
    if (oldBtn && cart.length === 0) {
      oldBtn.remove();
      cartPanel.classList.remove('open');
    } else if (cart.length > 0 && !oldBtn) {
      const btnDiv = document.createElement('div');
      btnDiv.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:140';
      btnDiv.innerHTML = `<button class="btn btn-primary btn-lg" id="btn-view-cart" style="box-shadow:var(--shadow-xl)">🛒 查看已选 (${cart.length}) - ${App.formatMoney(calcCartTotal())}</button>`;
      container.querySelector('.page-content').appendChild(btnDiv);
      btnDiv.querySelector('#btn-view-cart').addEventListener('click', () => {
        container.querySelector('#cart-panel').classList.toggle('open');
        updateCartUI(container);
      });
    } else if (oldBtn && cart.length > 0) {
      oldBtn.textContent = `🛒 查看已选 (${cart.length}) - ${App.formatMoney(calcCartTotal())}`;
    }

    // 更新合计
    const totalEl = cartPanel ? cartPanel.querySelector('.cart-panel .text-2xl, #cart-panel + div .text-2xl') : null;
  }

  // === 提交订单 ===
  function submitOrder(container, cartPanel) {
    if (cart.length === 0) {
      App.showToast('请先选择菜品', 'warning');
      return;
    }
    if (!currentTable) {
      App.showToast('请先选择桌台', 'warning');
      return;
    }

    const order = {
      tableId: currentTable.id,
      tableName: currentTable.name,
      items: cart.map(item => ({
        dishId: item.dishId,
        dishName: item.name,
        price: item.price,
        quantity: item.quantity,
        status: 'pending' // pending -> cooking -> ready -> served
      })),
      status: 'dining',
      totalAmount: calcCartTotal()
    };

    const savedOrder = DB.Orders.insert(order);

    // 扣减库存
    cart.forEach(item => {
      const dish = DB.Dishes.getById(item.dishId);
      if (dish && dish.recipe) {
        dish.recipe.forEach(ri => {
          DB.Ingredients.deduct(ri.ingredientId, ri.quantity * item.quantity);
        });
      }
    });

    // 更新桌台状态
    DB.Tables.update(currentTable.id, { status: 'occupied' });

    // 广播新订单
    Sync.broadcast(Sync.EVENTS.ORDER_NEW, { orderId: savedOrder.id, tableName: currentTable.name });

    // 检查库存不足
    const lowStock = DB.Ingredients.getLowStock();
    if (lowStock.length > 0) {
      Sync.broadcast(Sync.EVENTS.INVENTORY_LOW, { name: lowStock[0].name });
    }

    App.showToast('下单成功！厨房已收到订单', 'success', 2000);

    // 清空状态
    cart = [];
    currentTable = null;
    cartPanel.classList.remove('open');

    // 返回选桌页面
    setTimeout(() => App.navigate('ordering'), 1000);
  }

  // === 厨房看板页面 ===
  function renderKitchen(params) {
    App.setNavbar('厨房看板', true, 'home');
    const page = document.getElementById('page-kitchen');
    page.classList.add('active');

    const orders = DB.Orders.query(o => o.status === 'dining');
    const statuses = [
      { key: 'pending', label: '待制作', tagClass: 'tag-pending' },
      { key: 'cooking', label: '制作中', tagClass: 'tag-cooking' },
      { key: 'ready', label: '已出餐', tagClass: 'tag-ready' },
      { key: 'served', label: '已上菜', tagClass: 'tag-served' }
    ];

    page.innerHTML = `
      <div class="page-content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xl)">
          <h4>🔥 实时订单看板</h4>
          <span style="font-size:var(--text-sm);color:var(--color-text-tertiary)" id="kitchen-time"></span>
        </div>

        <div class="kanban-board" id="kanban-board">
          ${statuses.map(s => {
            const items = [];
            orders.forEach(order => {
              order.items.forEach((item, idx) => {
                if (item.status === s.key) {
                  items.push({ order, item, itemIndex: idx });
                }
              });
            });
            return `
              <div class="kanban-column" data-status="${s.key}">
                <div class="kanban-column-title">
                  ${s.key === 'pending' ? '🔴' : s.key === 'cooking' ? '🟡' : s.key === 'ready' ? '🟢' : '✅'}
                  ${s.label}
                  <span class="kanban-column-count">${items.length}</span>
                </div>
                <div class="kanban-items">
                  ${items.map(({ order, item, itemIndex }) => `
                    <div class="order-card" data-order-id="${order.id}" data-item-index="${itemIndex}">
                      <div class="order-card-header">
                        <span class="order-card-table">${order.tableName}</span>
                        <span class="order-card-time">${App.formatDate(order.createdAt, true)}</span>
                      </div>
                      <div class="order-card-item">
                        <span class="order-card-item-name">${item.quantity}x ${item.dishName}</span>
                      </div>
                      <div style="margin-top:var(--space-md);display:flex;gap:var(--space-sm);flex-wrap:wrap">
                        ${getNextStatusButtons(s.key, order.id, itemIndex)}
                      </div>
                    </div>
                  `).join('')}
                  ${items.length === 0 ? '<div style="text-align:center;padding:var(--space-xl);color:var(--color-text-quaternary);font-size:var(--text-sm)">暂无</div>' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // 更新实时时间
    function updateTime() {
      const el = document.getElementById('kitchen-time');
      if (el) el.textContent = new Date().toLocaleTimeString('zh-CN');
    }
    updateTime();
    setInterval(updateTime, 30000);

    // 绑定状态变更按钮
    bindKitchenEvents(page);
  }

  function getNextStatusButtons(currentStatus, orderId, itemIndex) {
    const transitions = {
      'pending': [{ to: 'cooking', label: '开始制作', cls: 'btn-warning' }],
      'cooking': [{ to: 'ready', label: '出餐完成', cls: 'btn-success' }],
      'ready': [{ to: 'served', label: '确认上菜', cls: 'btn-primary' }],
      'served': []
    };
    const buttons = transitions[currentStatus] || [];
    return buttons.map(b => `
      <button class="btn btn-sm ${b.cls} kitchen-action" data-order-id="${orderId}" data-item-index="${itemIndex}" data-status="${b.to}">${b.label}</button>
    `).join('');
  }

  function bindKitchenEvents(page) {
    page.querySelectorAll('.kitchen-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = parseInt(btn.dataset.orderId);
        const itemIndex = parseInt(btn.dataset.itemIndex);
        const newStatus = btn.dataset.status;

        DB.Orders.updateItemStatus(orderId, itemIndex, newStatus);
        Sync.broadcast(Sync.EVENTS.ORDER_ITEM_STATUS, { orderId, itemIndex, status: newStatus });

        // 刷新看板
        renderKitchen();
      });
    });
  }

  // === 服务员页面 ===
  function renderWaiter(params) {
    App.setNavbar('服务员看板', true, 'home');
    const page = document.getElementById('page-waiter');
    page.classList.add('active');

    const orders = DB.Orders.query(o => o.status === 'dining');

    page.innerHTML = `
      <div class="page-content">
        <h4 style="margin-bottom:var(--space-xl)">🛎️ 堂食订单管理</h4>
        <div class="grid-2" id="waiter-orders">
          ${orders.length === 0 ? `
            <div class="empty-state" style="grid-column:1/-1">
              <div class="empty-state-icon">📭</div>
              <div class="empty-state-title">暂无进行中的订单</div>
            </div>
          ` : orders.map(order => `
            <div class="card" style="cursor:default">
              <div class="flex justify-between items-center mb-md">
                <span style="font-size:var(--text-lg);font-weight:var(--font-bold)">${order.tableName}</span>
                <span class="tag tag-success">用餐中</span>
              </div>
              <div style="font-size:var(--text-xs);color:var(--color-text-tertiary);margin-bottom:var(--space-md)">
                下单时间：${App.formatDate(order.createdAt, true)}
              </div>
              <div class="order-card-items">
                ${order.items.map((item, idx) => `
                  <div class="flex justify-between items-center" style="padding:var(--space-sm) 0">
                    <span>${item.quantity}x ${item.dishName}</span>
                    <span class="tag ${getStatusTag(item.status)}">${getStatusLabel(item.status)}</span>
                  </div>
                `).join('')}
              </div>
              <div style="border-top:1px solid var(--color-separator);margin-top:var(--space-md);padding-top:var(--space-md);display:flex;justify-content:space-between;align-items:center">
                <span style="font-weight:var(--font-bold)">合计：${App.formatMoney(order.totalAmount)}</span>
                <button class="btn btn-sm btn-outline waiter-complete" data-order-id="${order.id}">结账完成</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // 结账按钮
    page.querySelectorAll('.waiter-complete').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = parseInt(btn.dataset.orderId);
        const order = DB.Orders.getById(orderId);
        App.confirm('确认结账', `${order.tableName} 合计 ${App.formatMoney(order.totalAmount)}，确认结账吗？`, () => {
          DB.Orders.update(orderId, { status: 'completed' });
          DB.Tables.update(order.tableId, { status: 'available' });
          Sync.broadcast(Sync.EVENTS.ORDER_STATUS, { orderId, status: 'completed' });
          App.showToast('结账完成', 'success');
          renderWaiter();
        });
      });
    });
  }

  function getStatusTag(status) {
    const map = { pending: 'tag-pending', cooking: 'tag-cooking', ready: 'tag-ready', served: 'tag-served' };
    return map[status] || 'tag-pending';
  }

  function getStatusLabel(status) {
    const map = { pending: '待制作', cooking: '制作中', ready: '已出餐', served: '已上菜' };
    return map[status] || status;
  }

  // === 备菜台页面 ===
  function renderPrep(params) {
    App.setNavbar('备菜台', true, 'home');
    const page = document.getElementById('page-prep');
    page.classList.add('active');

    const orders = DB.Orders.query(o => o.status === 'dining');
    // 收集所有待制作和制作中的菜品，按食材分组
    const ingredientTasks = {};
    orders.forEach(order => {
      order.items.forEach((item, idx) => {
        if (item.status === 'pending' || item.status === 'cooking') {
          const dish = DB.Dishes.getById(item.dishId);
          if (dish && dish.recipe) {
            dish.recipe.forEach(ri => {
              if (!ingredientTasks[ri.ingredientName]) {
                ingredientTasks[ri.ingredientName] = { total: 0, unit: ri.unit, items: [] };
              }
              ingredientTasks[ri.ingredientName].total += ri.quantity * item.quantity;
              ingredientTasks[ri.ingredientName].unit = ri.unit;
              ingredientTasks[ri.ingredientName].items.push({
                dishName: item.dishName,
                quantity: item.quantity,
                tableName: order.tableName,
                status: item.status
              });
            });
          }
        }
      });
    });

    const taskList = Object.entries(ingredientTasks).sort((a, b) => b[1].total - a[1].total);

    page.innerHTML = `
      <div class="page-content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xl)">
          <h4>🔪 备菜工作台</h4>
          <span style="font-size:var(--text-sm);color:var(--color-text-tertiary)" id="prep-time"></span>
        </div>

        ${taskList.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <div class="empty-state-title">暂无备菜任务</div>
            <div class="empty-state-text">所有订单食材已准备就绪</div>
          </div>
        ` : `
          <div style="margin-bottom:var(--space-lg)">
            <div class="stat-card" style="margin-bottom:var(--space-lg)">
              <div class="stat-card-label">待处理食材种类</div>
              <div class="stat-card-value">${taskList.length}</div>
            </div>
          </div>

          <div class="grid-2">
            ${taskList.map(([name, task]) => `
              <div class="card-glass">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:var(--space-md)">
                  <h6>🥬 ${name}</h6>
                  <span style="font-weight:var(--font-bold);font-size:var(--text-lg);color:var(--color-primary)">${task.total} ${task.unit}</span>
                </div>
                <div style="font-size:var(--text-sm);color:var(--color-text-tertiary);margin-bottom:var(--space-md)">
                  涉及 ${task.items.length} 道菜品
                </div>
                <div style="display:flex;flex-direction:column;gap:var(--space-xs)">
                  ${task.items.map(item => `
                    <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);padding:var(--space-xs) 0;border-bottom:1px solid var(--color-separator)">
                      <span>${item.quantity}x ${item.dishName}</span>
                      <span style="color:var(--color-text-tertiary)">${item.tableName} · <span class="tag ${item.status === 'pending' ? 'tag-pending' : 'tag-cooking'}">${item.status === 'pending' ? '待制作' : '制作中'}</span></span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    function updateTime() {
      const el = document.getElementById('prep-time');
      if (el) el.textContent = new Date().toLocaleTimeString('zh-CN');
    }
    updateTime();
    setInterval(updateTime, 30000);
  }

  // === 注册路由 ===
  App.registerRoute('ordering', (params) => {
    cart = [];
    currentTable = null;
    renderOrdering(params);
  });
  App.registerRoute('kitchen', renderKitchen);
  App.registerRoute('prep', renderPrep);
  App.registerRoute('waiter', renderWaiter);

  return { renderOrdering, renderKitchen, renderWaiter };
})();
