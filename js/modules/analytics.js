/* ============================================================
   兰家 - 模块五：营业数据智能统计分析
   模块七：当日经营成果智能判定
   ============================================================ */

const AnalyticsModule = (() => {
  // === 管理后台首页（仪表盘） ===
  function renderAdmin(params) {
    App.setNavbar('管理后台', false);
    const page = document.getElementById('page-admin');
    page.classList.add('active');

    const today = App.today();
    const todayOrders = DB.Orders.query(o => o.createdAt.startsWith(today));
    const completedOrders = todayOrders.filter(o => o.status === 'completed');
    const todayRevenue = completedOrders.reduce((s, o) => s + o.totalAmount, 0);

    const todayExpenses = DB.Expenses.query(e => e.date === today);
    const totalExpenses = todayExpenses.reduce((s, e) => s + e.amount, 0);

    const lowStock = DB.Ingredients.getLowStock();
    const activeOrders = DB.Orders.query(o => o.status === 'dining');

    // 食材成本
    const ingredientCost = calcTodayIngredientCost(today);
    const totalCost = totalExpenses + ingredientCost;
    const netProfit = todayRevenue - totalCost;
    const foodCostRate = todayRevenue > 0 ? (ingredientCost / todayRevenue) * 100 : 0;

    // 诊断结果
    const diagnosis = getDiagnosis(todayRevenue, totalCost, foodCostRate);

    page.innerHTML = `
      <div class="page-content">
        <!-- 今日核心指标 -->
        <div style="margin-bottom:var(--space-xl)">
          <div class="card-glass" style="text-align:center;padding:var(--space-2xl)">
            <div style="font-size:var(--text-sm);color:var(--color-text-tertiary);margin-bottom:var(--space-sm)">今日净收益</div>
            <div style="font-size:var(--text-4xl);font-weight:var(--font-bold);color:${netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};letter-spacing:-1px">
              ${netProfit >= 0 ? '+' : ''}${App.formatMoney(netProfit)}
            </div>
            <div style="margin-top:var(--space-md)">
              <span class="tag ${diagnosis.level === 'excellent' ? 'tag-success' : diagnosis.level === 'normal' ? 'tag-warning' : 'tag-danger'}" style="font-size:var(--text-base);padding:6px 16px">
                ${diagnosis.icon} ${diagnosis.label}
              </span>
            </div>
            <div style="margin-top:var(--space-md);color:var(--color-text-secondary);font-size:var(--text-sm);max-width:400px;margin-left:auto;margin-right:auto;line-height:1.6">
              ${diagnosis.message}
            </div>
          </div>
        </div>

        <!-- 核心数据卡片 -->
        <div class="dashboard-grid" style="margin-bottom:var(--space-xl)">
          <div class="stat-card" style="cursor:pointer" onclick="location.hash='admin/finance'">
            <div class="stat-card-label">📊 今日营收</div>
            <div class="stat-card-value">${App.formatMoney(todayRevenue)}</div>
            <div class="stat-card-change">${completedOrders.length} 笔完成 / ${todayOrders.length} 笔总计</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">📦 食材成本</div>
            <div class="stat-card-value">${App.formatMoney(ingredientCost)}</div>
            <div class="stat-card-change ${foodCostRate > 45 ? 'down' : 'up'}">成本率 ${foodCostRate.toFixed(1)}%</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">💸 其他支出</div>
            <div class="stat-card-value">${App.formatMoney(totalExpenses)}</div>
            <div class="stat-card-change">${todayExpenses.length} 笔记录</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">💰 综合成本率</div>
            <div class="stat-card-value" style="color:${todayRevenue > 0 && totalCost/todayRevenue < 0.7 ? 'var(--color-success)' : 'var(--color-warning)'}">
              ${todayRevenue > 0 ? ((totalCost / todayRevenue) * 100).toFixed(1) + '%' : '-'}
            </div>
          </div>
        </div>

        <!-- 快捷入口 -->
        <h5 style="margin-bottom:var(--space-lg)">快捷管理</h5>
        <div class="grid-2" style="margin-bottom:var(--space-xl)">
          ${[
            { icon: '🍽️', title: '菜品配方管理', desc: '管理菜品、配方、成本', route: 'admin/recipes', color: '#007AFF' },
            { icon: '📦', title: '食材库存管理', desc: '库存、入库、采购计划', route: 'admin/inventory', color: '#34C759' },
            { icon: '💰', title: '营收记账', desc: '收支管理、财务分析', route: 'admin/finance', color: '#FF9500' },
            { icon: '📊', title: '数据分析', desc: '多维度经营统计分析', route: 'admin/analytics', color: '#5AC8FA' }
          ].map(item => `
            <div class="card" style="cursor:pointer;display:flex;align-items:center;gap:var(--space-lg);padding:var(--space-xl)" onclick="location.hash='${item.route}'">
              <div style="width:48px;height:48px;border-radius:var(--radius-lg);background:${item.color}15;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">
                ${item.icon}
              </div>
              <div>
                <div style="font-weight:var(--font-semibold)">${item.title}</div>
                <div style="font-size:var(--text-sm);color:var(--color-text-tertiary)">${item.desc}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- 实时状态 -->
        <div class="grid-2" style="margin-bottom:var(--space-xl)">
          <div class="card-glass">
            <h6 style="margin-bottom:var(--space-md)">🔥 进行中订单</h6>
            ${activeOrders.length === 0 ? '<p style="color:var(--color-text-tertiary);font-size:var(--text-sm)">暂无进行中的订单</p>' :
              activeOrders.slice(0, 5).map(o => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm) 0;border-bottom:1px solid var(--color-separator)">
                  <span style="font-weight:var(--font-medium)">${o.tableName}</span>
                  <span style="font-size:var(--text-sm);color:var(--color-text-tertiary)">${o.items.length}道菜 · ${App.formatMoney(o.totalAmount)}</span>
                </div>
              `).join('')}
          </div>
          <div class="card-glass">
            <h6 style="margin-bottom:var(--space-md)">⚠️ 库存预警</h6>
            ${lowStock.length === 0 ? '<p style="color:var(--color-text-tertiary);font-size:var(--text-sm)">库存状态良好</p>' :
              lowStock.map(i => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm) 0;border-bottom:1px solid var(--color-separator)">
                  <span style="font-weight:var(--font-medium)">${i.name}</span>
                  <span class="tag tag-danger">剩${i.stock}${i.unit}</span>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // === 数据分析页面 ===
  function renderAnalytics(params) {
    App.setNavbar('经营分析', true, 'admin');
    const page = document.getElementById('page-analytics');
    page.classList.add('active');

    const dishes = DB.Dishes.getAll();
    const allOrders = DB.Orders.getAll();

    // 按日期统计营收
    const revenueByDate = {};
    allOrders.forEach(o => {
      const date = o.createdAt.split('T')[0];
      if (!revenueByDate[date]) revenueByDate[date] = { revenue: 0, orders: 0 };
      revenueByDate[date].revenue += o.totalAmount;
      revenueByDate[date].orders++;
    });

    const dates = Object.keys(revenueByDate).sort().reverse();
    const today = App.today();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 今日数据
    const todayData = revenueByDate[today] || { revenue: 0, orders: 0 };
    const yesterdayData = revenueByDate[yesterdayStr] || { revenue: 0, orders: 0 };
    const revChange = yesterdayData.revenue > 0
      ? ((todayData.revenue - yesterdayData.revenue) / yesterdayData.revenue * 100).toFixed(1)
      : 0;

    // 菜品销量排行
    const dishSales = {};
    allOrders.forEach(o => {
      o.items.forEach(item => {
        if (!dishSales[item.dishId]) dishSales[item.dishId] = { count: 0, revenue: 0, name: item.dishName };
        dishSales[item.dishId].count += item.quantity;
        dishSales[item.dishId].revenue += item.price * item.quantity;
      });
    });
    const topDishes = Object.values(dishSales).sort((a, b) => b.count - a.count).slice(0, 10);

    // 菜品毛利排行
    const dishMargins = dishes.map(d => {
      const cost = calcDishCostStatic(d);
      const profit = d.price - cost;
      const margin = d.price > 0 ? (profit / d.price) * 100 : 0;
      return { name: d.name, cost, price: d.price, profit, margin };
    }).sort((a, b) => a.margin - b.margin);

    // 周数据
    const weekDates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      weekDates.push(d.toISOString().split('T')[0]);
    }

    const maxRevenue = Math.max(1, ...weekDates.map(d => (revenueByDate[d] || { revenue: 0 }).revenue));

    page.innerHTML = `
      <div class="page-content">
        <div class="dashboard-grid" style="margin-bottom:var(--space-xl)">
          <div class="stat-card">
            <div class="stat-card-label">今日营收</div>
            <div class="stat-card-value">${App.formatMoney(todayData.revenue)}</div>
            <div class="stat-card-change ${parseFloat(revChange) >= 0 ? 'up' : 'down'}">
              较昨日 ${revChange >= 0 ? '+' : ''}${revChange}%
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">今日订单</div>
            <div class="stat-card-value">${todayData.orders}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">总订单数</div>
            <div class="stat-card-value">${allOrders.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">总营收</div>
            <div class="stat-card-value">${App.formatMoney(allOrders.reduce((s, o) => s + o.totalAmount, 0))}</div>
          </div>
        </div>

        <!-- 本周营收趋势图 (CSS简易图) -->
        <div class="chart-container" style="margin-bottom:var(--space-xl)">
          <div class="chart-title">📈 近7天营收趋势</div>
          <div style="display:flex;align-items:flex-end;gap:var(--space-md);height:160px;padding:var(--space-lg) 0">
            ${weekDates.map(d => {
              const val = (revenueByDate[d] || { revenue: 0 }).revenue;
              const h = maxRevenue > 0 ? (val / maxRevenue * 100) : 0;
              const dayLabel = new Date(d).toLocaleDateString('zh-CN', { weekday: 'short' });
              return `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:var(--space-sm);height:100%">
                  <span style="font-size:var(--text-xs);font-weight:var(--font-semibold);color:var(--color-text-secondary)">${App.formatMoney(val)}</span>
                  <div style="flex:1;width:100%;display:flex;align-items:flex-end">
                    <div style="width:100%;background:${d === today ? 'var(--color-primary)' : 'var(--color-primary-light)'};border-radius:var(--radius-sm) var(--radius-sm) 0 0;height:${Math.max(4, h)}%;transition:height var(--transition-slow);opacity:0.85"></div>
                  </div>
                  <span style="font-size:var(--text-xs);color:var(--color-text-tertiary)">${dayLabel}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="grid-2" style="margin-bottom:var(--space-xl)">
          <!-- 热销菜品排行 -->
          <div class="chart-container">
            <div class="chart-title">🔥 热销菜品 Top 10</div>
            ${topDishes.length === 0 ? '<div class="empty-state"><div class="empty-state-text">暂无销售数据</div></div>' :
              topDishes.map((d, idx) => `
                <div style="display:flex;align-items:center;gap:var(--space-md);padding:var(--space-sm) 0">
                  <span style="font-weight:var(--font-bold);font-size:var(--text-sm);color:${idx < 3 ? 'var(--color-warning)' : 'var(--color-text-tertiary)'};width:24px">#${idx + 1}</span>
                  <span style="flex:1;font-weight:var(--font-medium);font-size:var(--text-sm)">${d.name}</span>
                  <span style="font-size:var(--text-sm);color:var(--color-text-tertiary)">${d.count}份</span>
                  <span style="font-size:var(--text-sm);font-weight:var(--font-semibold)">${App.formatMoney(d.revenue)}</span>
                </div>
              `).join('')}
          </div>

          <!-- 低毛利菜品 -->
          <div class="chart-container">
            <div class="chart-title">⚠️ 低毛利菜品</div>
            ${dishMargins.filter(d => d.margin < 50).slice(0, 10).map((d, idx) => `
              <div style="display:flex;align-items:center;gap:var(--space-md);padding:var(--space-sm) 0">
                <span style="font-weight:var(--font-bold);font-size:var(--text-sm);color:var(--color-text-tertiary);width:24px">#${idx + 1}</span>
                <span style="flex:1;font-weight:var(--font-medium);font-size:var(--text-sm)">${d.name}</span>
                <span class="tag ${d.margin < 30 ? 'tag-danger' : 'tag-warning'}">${d.margin.toFixed(1)}%</span>
              </div>
            `).join('')}
            ${dishMargins.filter(d => d.margin < 50).length === 0 ? '<div class="empty-state"><div class="empty-state-text">所有菜品毛利率正常</div></div>' : ''}
          </div>
        </div>

        <!-- 成本结构分析 -->
        <div class="chart-container" style="margin-bottom:var(--space-xl)">
          <div class="chart-title">📊 今日成本结构</div>
          ${renderCostStructure()}
        </div>

        <!-- 每日营收明细 -->
        <div class="chart-container">
          <div class="chart-title">📋 每日营收明细（近30天）</div>
          <div class="table-wrapper">
            <table>
              <thead><tr><th>日期</th><th>订单数</th><th>营收</th></tr></thead>
              <tbody>
                ${dates.slice(0, 30).map(d => `
                  <tr>
                    <td style="font-weight:var(--font-medium)">${d}</td>
                    <td>${(revenueByDate[d] || { orders: 0 }).orders} 笔</td>
                    <td style="font-weight:var(--font-semibold)">${App.formatMoney((revenueByDate[d] || { revenue: 0 }).revenue)}</td>
                  </tr>
                `).join('')}
                ${dates.length === 0 ? '<tr><td colspan="3" style="text-align:center;padding:var(--space-3xl);color:var(--color-text-tertiary)">暂无数据</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderCostStructure() {
    const today = App.today();
    const todayOrders = DB.Orders.query(o => o.createdAt.startsWith(today));
    const ingredientCost = calcTodayIngredientCost(today);
    const expenses = DB.Expenses.query(e => e.date === today);

    // 按类别汇总支出
    const expByCategory = {};
    expenses.forEach(e => {
      if (!expByCategory[e.category]) expByCategory[e.category] = 0;
      expByCategory[e.category] += e.amount;
    });

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalCost = ingredientCost + totalExpenses;
    const totalRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);

    if (totalCost === 0) {
      return '<div class="empty-state"><div class="empty-state-text">今日暂无成本数据</div></div>';
    }

    const items = [
      { name: '食材成本', amount: ingredientCost, color: '#FF9500' },
      ...Object.entries(expByCategory).map(([cat, amt]) => ({ name: cat, amount: amt, color: getCategoryColor(cat) }))
    ].filter(i => i.amount > 0);

    const maxAmt = Math.max(...items.map(i => i.amount), 1);

    return items.map(item => {
      const pct = totalCost > 0 ? (item.amount / totalCost * 100).toFixed(1) : 0;
      const barPct = (item.amount / maxAmt * 100);
      return `
        <div style="margin-bottom:var(--space-md)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-xs)">
            <span style="font-size:var(--text-sm);font-weight:var(--font-medium)">${item.name}</span>
            <span style="font-size:var(--text-sm);color:var(--color-text-secondary)">${App.formatMoney(item.amount)} (${pct}%)</span>
          </div>
          <div class="progress-bar" style="height:8px">
            <div class="progress-fill" style="width:${barPct}%;background:${item.color};border-radius:var(--radius-full)"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getCategoryColor(cat) {
    const colors = {
      '食材采购': '#34C759', '房租': '#007AFF', '水电': '#5AC8FA',
      '耗材': '#AF52DE', '杂费': '#8E8E93', '人工工资': '#FF3B30',
      '设备维护': '#FF9500', '其他': '#C7C7CC'
    };
    return colors[cat] || '#8E8E93';
  }

  function calcTodayIngredientCost(today) {
    const orders = DB.Orders.query(o => o.createdAt.startsWith(today));
    let total = 0;
    orders.forEach(order => {
      order.items.forEach(item => {
        const dish = DB.Dishes.getById(item.dishId);
        if (dish && dish.recipe) {
          dish.recipe.forEach(ri => {
            const ing = DB.Ingredients.getById(ri.ingredientId);
            if (ing) total += ing.purchasePrice * ri.quantity * item.quantity;
          });
        }
      });
    });
    return total;
  }

  function calcDishCostStatic(dish) {
    if (!dish.recipe || dish.recipe.length === 0) return 0;
    return dish.recipe.reduce((sum, ri) => {
      const ing = DB.Ingredients.getById(ri.ingredientId);
      return sum + (ing ? ing.purchasePrice : 0) * ri.quantity;
    }, 0);
  }

  // === 经营诊断 ===
  function getDiagnosis(revenue, totalCost, foodCostRate) {
    if (revenue === 0) {
      return {
        level: 'normal',
        icon: '⏳',
        label: '等待营业',
        message: '今日暂无营收数据，开始营业后将自动分析经营状况。建议检查食材库存是否充足，做好营业准备。'
      };
    }

    const profit = revenue - totalCost;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    if (profitMargin >= 25 && foodCostRate <= 40) {
      return {
        level: 'excellent',
        icon: '🌟',
        label: '经营优秀',
        message: `今日毛利率 ${profitMargin.toFixed(1)}%，食材成本率 ${foodCostRate.toFixed(1)}%，各项指标优秀。收入稳定、成本控制得当，继续保持！`
      };
    } else if (profitMargin >= 10 && foodCostRate <= 50) {
      return {
        level: 'normal',
        icon: '👍',
        label: '经营正常',
        message: `今日毛利率 ${profitMargin.toFixed(1)}%，食材成本率 ${foodCostRate.toFixed(1)}%。可考虑优化部分成本环节，提升盈利能力。`
      };
    } else if (foodCostRate > 50) {
      return {
        level: 'warning',
        icon: '⚠️',
        label: '成本偏高',
        message: `食材成本率达 ${foodCostRate.toFixed(1)}%，明显偏高。建议：1) 检查食材采购价格 2) 优化菜品配方用量 3) 调整高成本菜品售价。`
      };
    } else {
      return {
        level: 'danger',
        icon: '📉',
        label: '盈利不足',
        message: `今日毛利率仅 ${profitMargin.toFixed(1)}%，盈利状况不佳。请重点检查：营收是否过低、支出是否超标、菜品定价是否合理。`
      };
    }
  }

  // === 注册路由 ===
  App.registerRoute('admin', renderAdmin);
  App.registerRoute('admin/analytics', renderAnalytics);

  return { renderAdmin, renderAnalytics, getDiagnosis };
})();
