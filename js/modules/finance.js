/* ============================================================
   兰家 - 模块二：每日营收收支记账系统
   ============================================================ */

const FinanceModule = (() => {
  function renderFinance(params) {
    App.setNavbar('营收记账', true, 'admin');
    const page = document.getElementById('page-finance');
    page.classList.add('active');

    const today = App.today();
    const todayOrders = DB.Orders.query(o => {
      return o.createdAt.startsWith(today) && o.status === 'completed';
    });
    const todayRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);

    const todayExpenses = DB.Expenses.query(e => e.date === today);
    const totalExpenses = todayExpenses.reduce((s, e) => s + e.amount, 0);

    // 食材成本（今日已消耗 - 通过订单推算）
    const ingredientCost = calcTodayIngredientCost(today);

    const allExpenses = [...todayExpenses];
    const totalAllExpenses = allExpenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = todayRevenue - totalAllExpenses - ingredientCost;

    page.innerHTML = `
      <div class="page-content">
        <div style="text-align:center;padding:var(--space-xl) 0">
          <div style="font-size:var(--text-sm);color:var(--color-text-tertiary);margin-bottom:var(--space-xs)">${today} 今日净收益</div>
          <div style="font-size:var(--text-4xl);font-weight:var(--font-bold);color:${netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};letter-spacing:-1px">
            ${netProfit >= 0 ? '+' : ''}${App.formatMoney(netProfit)}
          </div>
        </div>

        <div class="dashboard-grid" style="margin-bottom:var(--space-xl)">
          <div class="stat-card">
            <div class="stat-card-label">堂食营收</div>
            <div class="stat-card-value" style="font-size:var(--text-2xl)">${App.formatMoney(todayRevenue)}</div>
            <div class="stat-card-change">${todayOrders.length} 笔订单</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">食材成本</div>
            <div class="stat-card-value" style="font-size:var(--text-2xl)">${App.formatMoney(ingredientCost)}</div>
            <div class="stat-card-change">预估消耗</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">其他支出</div>
            <div class="stat-card-value" style="font-size:var(--text-2xl)">${App.formatMoney(totalExpenses)}</div>
            <div class="stat-card-change">${todayExpenses.length} 笔记录</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">食材成本率</div>
            <div class="stat-card-value" style="font-size:var(--text-2xl);color:${todayRevenue > 0 && (ingredientCost/todayRevenue) < 0.4 ? 'var(--color-success)' : 'var(--color-warning)'}">
              ${todayRevenue > 0 ? ((ingredientCost / todayRevenue) * 100).toFixed(1) : '0'}%
            </div>
          </div>
        </div>

        <!-- 收入明细 -->
        <div class="flex justify-between items-center mb-lg">
          <h5>📋 今日堂食收入明细</h5>
        </div>
        ${todayOrders.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div class="empty-state-title">今日暂无已完成订单</div>
          </div>
        ` : `
          <div class="table-wrapper" style="margin-bottom:var(--space-xl)">
            <table>
              <thead><tr><th>桌台</th><th>菜品数</th><th>金额</th><th>下单时间</th></tr></thead>
              <tbody>
                ${todayOrders.map(o => `
                  <tr>
                    <td style="font-weight:var(--font-medium)">${o.tableName}</td>
                    <td>${o.items.length} 道</td>
                    <td style="font-weight:var(--font-semibold)">${App.formatMoney(o.totalAmount)}</td>
                    <td>${App.formatDate(o.createdAt, true)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}

        <!-- 支出管理 -->
        <div class="flex justify-between items-center mb-lg">
          <h5>💸 支出管理</h5>
          <button class="btn btn-primary btn-sm" id="btn-add-expense">+ 记录支出</button>
        </div>

        ${todayExpenses.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-title">今日暂无支出记录</div>
            <div class="empty-state-text">点击上方按钮记录各类支出</div>
          </div>
        ` : `
          <div class="table-wrapper">
            <table>
              <thead><tr><th>类别</th><th>金额</th><th>备注</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                ${todayExpenses.map(e => `
                  <tr>
                    <td><span class="tag tag-warning">${e.category}</span></td>
                    <td style="font-weight:var(--font-semibold);color:var(--color-danger)">-${App.formatMoney(e.amount)}</td>
                    <td>${e.note || '-'}</td>
                    <td>${App.formatDate(e.createdAt, true)}</td>
                    <td><button class="btn btn-ghost btn-sm btn-del-expense" data-id="${e.id}" style="color:var(--color-danger)">删除</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;

    bindFinanceEvents(page);
  }

  function calcTodayIngredientCost(today) {
    const todayOrders = DB.Orders.query(o => o.createdAt.startsWith(today));
    let totalCost = 0;
    todayOrders.forEach(order => {
      order.items.forEach(item => {
        const dish = DB.Dishes.getById(item.dishId);
        if (dish && dish.recipe) {
          dish.recipe.forEach(ri => {
            const ing = DB.Ingredients.getById(ri.ingredientId);
            if (ing) {
              totalCost += ing.purchasePrice * ri.quantity * item.quantity;
            }
          });
        }
      });
    });
    return totalCost;
  }

  function bindFinanceEvents(page) {
    page.querySelector('#btn-add-expense')?.addEventListener('click', () => {
      showExpenseForm();
    });

    page.querySelectorAll('.btn-del-expense').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        App.confirm('删除记录', '确定删除这条支出记录吗？', () => {
          DB.Expenses.remove(id);
          Sync.broadcast(Sync.EVENTS.DATA_CHANGED, {});
          renderFinance({});
          App.showToast('记录已删除', 'success');
        });
      });
    });
  }

  function showExpenseForm(expense) {
    const categories = ['食材采购', '房租', '水电', '耗材', '杂费', '人工工资', '设备维护', '其他'];
    const isEdit = !!expense;

    const content = `
      <div class="form-group">
        <label class="form-label">支出类别 *</label>
        <select class="form-select" id="exp-category">
          ${categories.map(c => `<option value="${c}" ${expense && expense.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">金额 (¥) *</label>
        <input class="form-input" type="number" id="exp-amount" value="${expense ? expense.amount : ''}" step="0.01" min="0" placeholder="0.00">
      </div>
      <div class="form-group">
        <label class="form-label">日期</label>
        <input class="form-input" type="date" id="exp-date" value="${expense ? expense.date : App.today()}">
      </div>
      <div class="form-group">
        <label class="form-label">备注</label>
        <textarea class="form-textarea" id="exp-note" placeholder="详细说明">${expense ? expense.note || '' : ''}</textarea>
      </div>
    `;

    const footer = `
      <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>
      <button class="btn btn-primary" id="btn-save-expense">${isEdit ? '保存修改' : '记录支出'}</button>
    `;

    const modal = App.showModal(isEdit ? '编辑支出' : '记录支出', content, footer);

    modal.querySelector('#btn-save-expense').addEventListener('click', () => {
      const data = {
        date: modal.querySelector('#exp-date').value || App.today(),
        category: modal.querySelector('#exp-category').value,
        amount: parseFloat(modal.querySelector('#exp-amount').value) || 0,
        note: modal.querySelector('#exp-note').value.trim()
      };

      if (data.amount <= 0) {
        App.showToast('请输入有效金额', 'warning');
        return;
      }

      if (isEdit) {
        DB.Expenses.update(expense.id, data);
      } else {
        DB.Expenses.insert(data);
      }

      Sync.broadcast(Sync.EVENTS.DATA_CHANGED, {});
      modal.remove();
      renderFinance({});
      App.showToast(isEdit ? '支出记录已更新' : '支出已记录', 'success');
    });
  }

  // === 注册路由 ===
  App.registerRoute('admin/finance', renderFinance);

  return { renderFinance, calcTodayIngredientCost };
})();
