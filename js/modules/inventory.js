/* ============================================================
   兰家 - 模块三：食材库存管理 + 智能采购计划系统
   ============================================================ */

const InventoryModule = (() => {
  function renderInventory(params) {
    App.setNavbar('食材库存管理', true, 'admin');
    const page = document.getElementById('page-inventory');
    page.classList.add('active');

    const ingredients = DB.Ingredients.getAll();
    const categories = ['全部', ...new Set(ingredients.map(i => i.category))];
    const selectedCat = params.category || '全部';

    const filtered = selectedCat === '全部' ? ingredients : ingredients.filter(i => i.category === selectedCat);
    const lowStockItems = ingredients.filter(i => i.stock <= i.minStock);

    page.innerHTML = `
      <div class="page-content">
        <!-- 库存概览 -->
        <div class="dashboard-grid" style="margin-bottom:var(--space-xl)">
          <div class="stat-card">
            <div class="stat-card-label">食材种类</div>
            <div class="stat-card-value">${ingredients.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">库存不足</div>
            <div class="stat-card-value" style="color:${lowStockItems.length > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">${lowStockItems.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">库存总价值</div>
            <div class="stat-card-value">${App.formatMoney(calcTotalInventoryValue(ingredients))}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">食材分类</div>
            <div class="stat-card-value">${categories.length - 1}</div>
          </div>
        </div>

        <!-- 库存不足告警 -->
        ${lowStockItems.length > 0 ? `
        <div class="card-glass" style="margin-bottom:var(--space-xl);border:1px solid rgba(255,59,48,0.3)">
          <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-md)">
            <span style="font-size:20px">⚠️</span>
            <span style="font-weight:var(--font-semibold);color:var(--color-danger)">库存不足预警</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm)">
            ${lowStockItems.map(i => `
              <span class="tag tag-danger">${i.name}：剩${i.stock}${i.unit}（最低${i.minStock}${i.unit}）</span>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- 操作栏 -->
        <div class="flex justify-between items-center mb-lg" style="flex-wrap:wrap;gap:var(--space-md)">
          <div class="category-tabs" style="padding:0" id="inv-cat-tabs">
            ${categories.map(cat => `
              <button class="category-tab ${cat === selectedCat ? 'active' : ''}" data-cat="${cat}">${cat}</button>
            `).join('')}
          </div>
          <div style="display:flex;gap:var(--space-sm)">
            <button class="btn btn-outline btn-sm" id="btn-purchase-plan">📋 采购计划</button>
            <button class="btn btn-primary btn-sm" id="btn-add-ingredient">+ 添加食材</button>
          </div>
        </div>

        <!-- 食材列表 -->
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>食材名称</th>
                <th>分类</th>
                <th>当前库存</th>
                <th>单位</th>
                <th>最低预警</th>
                <th>进货价</th>
                <th>供应商</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(i => {
                const isLow = i.stock <= i.minStock;
                const stockPercent = Math.min(100, Math.round((i.stock / Math.max(i.minStock * 2, 1)) * 100));
                return `
                  <tr>
                    <td style="font-weight:var(--font-medium)">${i.name}</td>
                    <td>${i.category}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:var(--space-sm)">
                        <span style="font-weight:var(--font-semibold);${isLow ? 'color:var(--color-danger)' : ''}">${i.stock}</span>
                        <div class="progress-bar" style="width:60px" title="${stockPercent}%">
                          <div class="progress-fill ${isLow ? 'danger' : stockPercent < 30 ? 'warning' : 'success'}" style="width:${stockPercent}%"></div>
                        </div>
                      </div>
                    </td>
                    <td>${i.unit}</td>
                    <td>${i.minStock}</td>
                    <td>${App.formatMoney(i.purchasePrice)}/${i.unit}</td>
                    <td>${i.supplier || '-'}</td>
                    <td><span class="tag ${isLow ? 'tag-danger' : 'tag-success'}">${isLow ? '不足' : '正常'}</span></td>
                    <td>
                      <div style="display:flex;gap:var(--space-xs)">
                        <button class="btn btn-ghost btn-sm btn-edit-ing" data-id="${i.id}">编辑</button>
                        <button class="btn btn-ghost btn-sm btn-stock-in" data-id="${i.id}" style="color:var(--color-success)">入库</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
              ${filtered.length === 0 ? `<tr><td colspan="9" style="text-align:center;padding:var(--space-3xl);color:var(--color-text-tertiary)">暂无食材数据</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    bindInventoryEvents(page, ingredients);
  }

  function calcTotalInventoryValue(ingredients) {
    return ingredients.reduce((sum, i) => sum + i.stock * i.purchasePrice, 0);
  }

  function bindInventoryEvents(page, ingredients) {
    // 分类切换
    page.querySelectorAll('#inv-cat-tabs .category-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        App.navigate('admin/inventory', { category: tab.dataset.cat });
      });
    });

    // 添加食材
    page.querySelector('#btn-add-ingredient').addEventListener('click', () => {
      showIngredientForm(null);
    });

    // 编辑食材
    page.querySelectorAll('.btn-edit-ing').forEach(btn => {
      btn.addEventListener('click', () => {
        const ing = DB.Ingredients.getById(parseInt(btn.dataset.id));
        if (ing) showIngredientForm(ing);
      });
    });

    // 入库
    page.querySelectorAll('.btn-stock-in').forEach(btn => {
      btn.addEventListener('click', () => {
        const ing = DB.Ingredients.getById(parseInt(btn.dataset.id));
        if (ing) showStockInForm(ing);
      });
    });

    // 采购计划
    page.querySelector('#btn-purchase-plan').addEventListener('click', () => {
      renderPurchasePlan();
    });
  }

  // === 食材表单 ===
  function showIngredientForm(ingredient) {
    const isEdit = !!ingredient;
    const categories = ['肉类', '蔬菜', '干货调料', '粮油', '酒水饮品'];

    const content = `
      <div class="form-group">
        <label class="form-label">食材名称 *</label>
        <input class="form-input" id="ing-name" value="${ingredient ? ingredient.name : ''}" placeholder="例如：猪里脊肉">
      </div>
      <div class="form-group">
        <label class="form-label">分类 *</label>
        <select class="form-select" id="ing-category">
          ${categories.map(c => `<option value="${c}" ${ingredient && ingredient.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">
        <div class="form-group">
          <label class="form-label">当前库存 *</label>
          <input class="form-input" type="number" id="ing-stock" value="${ingredient ? ingredient.stock : 0}" step="0.1" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">单位 *</label>
          <input class="form-input" id="ing-unit" value="${ingredient ? ingredient.unit : '克'}" placeholder="克/毫升/个/瓶">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">
        <div class="form-group">
          <label class="form-label">最低预警库存 *</label>
          <input class="form-input" type="number" id="ing-min-stock" value="${ingredient ? ingredient.minStock : 100}" step="0.1" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">进货单价 (¥) *</label>
          <input class="form-input" type="number" id="ing-price" value="${ingredient ? ingredient.purchasePrice : 0}" step="0.01" min="0">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">供应商</label>
        <input class="form-input" id="ing-supplier" value="${ingredient ? ingredient.supplier || '' : ''}" placeholder="供应商名称">
      </div>
    `;

    const footer = `
      <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>
      ${isEdit ? '<button class="btn btn-danger" id="btn-delete-ing">删除</button>' : ''}
      <button class="btn btn-primary" id="btn-save-ing">${isEdit ? '保存修改' : '添加食材'}</button>
    `;

    const modal = App.showModal(isEdit ? '编辑食材' : '添加食材', content, footer);

    modal.querySelector('#btn-save-ing').addEventListener('click', () => {
      const data = {
        name: modal.querySelector('#ing-name').value.trim(),
        category: modal.querySelector('#ing-category').value,
        stock: parseFloat(modal.querySelector('#ing-stock').value) || 0,
        unit: modal.querySelector('#ing-unit').value.trim(),
        minStock: parseFloat(modal.querySelector('#ing-min-stock').value) || 0,
        purchasePrice: parseFloat(modal.querySelector('#ing-price').value) || 0,
        supplier: modal.querySelector('#ing-supplier').value.trim()
      };

      if (!data.name || !data.unit) {
        App.showToast('请填写必填字段', 'warning');
        return;
      }

      if (isEdit) {
        DB.Ingredients.update(ingredient.id, data);
        App.showToast('食材已更新', 'success');
      } else {
        DB.Ingredients.insert(data);
        App.showToast('食材已添加', 'success');
      }

      Sync.broadcast(Sync.EVENTS.INVENTORY_UPDATE, data);
      modal.remove();
      renderInventory({});
    });

    if (isEdit) {
      modal.querySelector('#btn-delete-ing').addEventListener('click', () => {
        App.confirm('删除食材', `确定删除「${ingredient.name}」吗？此操作不可恢复。`, () => {
          DB.Ingredients.remove(ingredient.id);
          Sync.broadcast(Sync.EVENTS.DATA_CHANGED, {});
          modal.remove();
          renderInventory({});
          App.showToast('食材已删除', 'success');
        });
      });
    }
  }

  // === 入库表单 ===
  function showStockInForm(ingredient) {
    const content = `
      <p style="margin-bottom:var(--space-lg);color:var(--color-text-secondary)">
        当前库存：<strong>${ingredient.stock} ${ingredient.unit}</strong>
      </p>
      <div class="form-group">
        <label class="form-label">入库数量 (${ingredient.unit})</label>
        <input class="form-input" type="number" id="stock-in-qty" value="0" step="0.1" min="0" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">采购单价 (¥ / ${ingredient.unit})</label>
        <input class="form-input" type="number" id="stock-in-price" value="${ingredient.purchasePrice}" step="0.01" min="0">
      </div>
      <div class="form-group">
        <label class="form-label">供应商</label>
        <input class="form-input" id="stock-in-supplier" value="${ingredient.supplier || ''}">
      </div>
    `;

    const footer = `
      <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>
      <button class="btn btn-primary" id="btn-confirm-stock-in">确认入库</button>
    `;

    const modal = App.showModal(`入库 - ${ingredient.name}`, content, footer);

    modal.querySelector('#btn-confirm-stock-in').addEventListener('click', () => {
      const qty = parseFloat(modal.querySelector('#stock-in-qty').value) || 0;
      const price = parseFloat(modal.querySelector('#stock-in-price').value) || 0;
      const supplier = modal.querySelector('#stock-in-supplier').value.trim();

      if (qty <= 0) {
        App.showToast('请输入有效入库数量', 'warning');
        return;
      }

      const newStock = ingredient.stock + qty;
      DB.Ingredients.update(ingredient.id, {
        stock: newStock,
        purchasePrice: price,
        supplier: supplier || ingredient.supplier
      });

      // 记录采购
      DB.Purchases.insert({
        date: App.today(),
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        quantity: qty,
        unit: ingredient.unit,
        price: price,
        totalCost: qty * price,
        supplier: supplier || ingredient.supplier || ''
      });

      Sync.broadcast(Sync.EVENTS.INVENTORY_UPDATE, { id: ingredient.id, stock: newStock });
      modal.remove();
      renderInventory({});
      App.showToast(`入库成功：+${qty} ${ingredient.unit}`, 'success');
    });
  }

  // === 智能采购计划 ===
  function renderPurchasePlan() {
    const ingredients = DB.Ingredients.getAll();
    const dishes = DB.Dishes.getAll();

    // 计算每种食材的建议采购量
    // 基于：当前库存、最低预警、最近订单消耗预估
    const recentOrders = DB.Orders.query(o => {
      const orderDate = o.createdAt.split('T')[0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return orderDate >= sevenDaysAgo.toISOString().split('T')[0];
    });

    // 计算近7天每种食材的日均消耗
    const dailyConsumption = {};
    recentOrders.forEach(order => {
      order.items.forEach(item => {
        const dish = DB.Dishes.getById(item.dishId);
        if (dish && dish.recipe) {
          dish.recipe.forEach(ri => {
            if (!dailyConsumption[ri.ingredientId]) dailyConsumption[ri.ingredientId] = 0;
            dailyConsumption[ri.ingredientId] += ri.quantity * item.quantity;
          });
        }
      });
    });

    // 日均消耗
    Object.keys(dailyConsumption).forEach(k => {
      dailyConsumption[k] = dailyConsumption[k] / 7;
    });

    // 生成采购建议
    const purchaseItems = ingredients.map(ing => {
      const dailyUse = dailyConsumption[ing.id] || 0;
      const suggestedPurchase = Math.max(0, (ing.minStock * 2) - ing.stock + (dailyUse * 3));
      const urgency = ing.stock <= ing.minStock ? 'urgent' :
                      ing.stock <= ing.minStock * 1.5 ? 'warning' : 'normal';
      return {
        ...ing,
        dailyUse: Math.round(dailyUse * 100) / 100,
        suggestedPurchase: Math.ceil(suggestedPurchase),
        urgency,
        estimatedCost: Math.ceil(suggestedPurchase) * ing.purchasePrice
      };
    }).filter(item => item.suggestedPurchase > 0 || item.urgency === 'urgent')
      .sort((a, b) => {
        const urgOrder = { urgent: 0, warning: 1, normal: 2 };
        return urgOrder[a.urgency] - urgOrder[b.urgency];
      });

    const totalEstCost = purchaseItems.reduce((sum, i) => sum + i.estimatedCost, 0);

    const content = `
      <div style="margin-bottom:var(--space-xl)">
        <div class="dashboard-grid" style="margin-bottom:var(--space-xl)">
          <div class="stat-card">
            <div class="stat-card-label">需采购种类</div>
            <div class="stat-card-value">${purchaseItems.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">预估采购金额</div>
            <div class="stat-card-value">${App.formatMoney(totalEstCost)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">紧急采购</div>
            <div class="stat-card-value" style="color:var(--color-danger)">${purchaseItems.filter(i => i.urgency === 'urgent').length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">近7天订单</div>
            <div class="stat-card-value">${recentOrders.length}</div>
          </div>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>优先级</th>
              <th>食材名称</th>
              <th>分类</th>
              <th>当前库存</th>
              <th>最低预警</th>
              <th>日均消耗</th>
              <th>建议采购</th>
              <th>预估金额</th>
              <th>供应商</th>
            </tr>
          </thead>
          <tbody>
            ${purchaseItems.map(item => `
              <tr>
                <td>
                  <span class="tag ${item.urgency === 'urgent' ? 'tag-danger' : item.urgency === 'warning' ? 'tag-warning' : 'tag-success'}">
                    ${item.urgency === 'urgent' ? '紧急' : item.urgency === 'warning' ? '建议' : '正常'}
                  </span>
                </td>
                <td style="font-weight:var(--font-medium)">${item.name}</td>
                <td>${item.category}</td>
                <td style="color:${item.stock <= item.minStock ? 'var(--color-danger)' : 'inherit'}">${item.stock} ${item.unit}</td>
                <td>${item.minStock} ${item.unit}</td>
                <td>${item.dailyUse} ${item.unit}/天</td>
                <td style="font-weight:var(--font-bold);color:var(--color-primary)">${item.suggestedPurchase} ${item.unit}</td>
                <td>${App.formatMoney(item.estimatedCost)}</td>
                <td>${item.supplier || '-'}</td>
              </tr>
            `).join('')}
            ${purchaseItems.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:var(--space-3xl);color:var(--color-text-tertiary)">库存充足，暂不需要采购</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      <div style="margin-top:var(--space-lg);display:flex;justify-content:flex-end;gap:var(--space-md)">
        <button class="btn btn-outline" id="btn-print-plan">打印采购清单</button>
        <button class="btn btn-primary" id="btn-export-plan">导出采购清单</button>
      </div>
    `;

    const modal = App.showModal('📋 智能采购计划', content, '');

    modal.querySelector('#btn-print-plan').addEventListener('click', () => {
      window.print();
    });

    modal.querySelector('#btn-export-plan').addEventListener('click', () => {
      let csv = '食材名称,分类,当前库存,最低预警,日均消耗,建议采购,预估金额,供应商\n';
      purchaseItems.forEach(item => {
        csv += `${item.name},${item.category},${item.stock}${item.unit},${item.minStock}${item.unit},${item.dailyUse}${item.unit},${item.suggestedPurchase}${item.unit},${item.estimatedCost},${item.supplier || ''}\n`;
      });
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `采购计划_${App.today()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      App.showToast('采购清单已导出', 'success');
    });
  }

  // === 注册路由 ===
  App.registerRoute('admin/inventory', renderInventory);

  return { renderInventory, renderPurchasePlan };
})();
