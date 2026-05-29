/* ============================================================
   兰家 - 模块六：菜品配方菜谱库 & 模块四：成本毛利核算
   ============================================================ */

const RecipeModule = (() => {
  // === 菜谱管理主页面 ===
  function renderRecipes(params) {
    App.setNavbar('菜品配方管理', true, 'admin');
    const page = document.getElementById('page-recipes');
    page.classList.add('active');

    const dishes = DB.Dishes.getAll();
    const categories = ['全部', ...new Set(dishes.map(d => d.category))];
    const selectedCat = params.category || '全部';
    const filtered = selectedCat === '全部' ? dishes : dishes.filter(d => d.category === selectedCat);

    page.innerHTML = `
      <div class="page-content">
        <div class="flex justify-between items-center mb-xl" style="flex-wrap:wrap;gap:var(--space-md)">
          <h4>📖 菜谱配方库</h4>
          <div style="display:flex;gap:var(--space-sm)">
            <button class="btn btn-outline btn-sm" id="btn-cost-overview">💰 成本总览</button>
            <button class="btn btn-primary btn-sm" id="btn-add-dish">+ 添加菜品</button>
          </div>
        </div>

        <div class="category-tabs" style="padding:0;margin-bottom:var(--space-xl)" id="recipe-cat-tabs">
          ${categories.map(cat => `
            <button class="category-tab ${cat === selectedCat ? 'active' : ''}" data-cat="${cat}">${cat}</button>
          `).join('')}
        </div>

        <div class="grid-2" id="recipe-list">
          ${filtered.map(d => {
            const cost = calcDishCost(d);
            const profit = dish.price - cost;
            const margin = dish.price > 0 ? ((profit / dish.price) * 100) : 0;
            return `
              <div class="card recipe-card" data-dish-id="${d.id}" style="cursor:pointer">
                <div class="flex justify-between items-start mb-md">
                  <div>
                    <div style="font-size:var(--text-lg);font-weight:var(--font-bold)">${d.emoji || ''} ${d.name}</div>
                    <div style="font-size:var(--text-xs);color:var(--color-text-tertiary)">${d.category} · ${d.servingSize || ''}</div>
                  </div>
                  <span class="tag ${margin >= 60 ? 'tag-success' : margin >= 40 ? 'tag-warning' : 'tag-danger'}">${margin.toFixed(1)}%</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-md);margin-bottom:var(--space-md)">
                  <div>
                    <div style="font-size:var(--text-xs);color:var(--color-text-tertiary)">售价</div>
                    <div style="font-weight:var(--font-bold);color:var(--color-danger)">${App.formatMoney(d.price)}</div>
                  </div>
                  <div>
                    <div style="font-size:var(--text-xs);color:var(--color-text-tertiary)">食材成本</div>
                    <div style="font-weight:var(--font-semibold)">${App.formatMoney(cost)}</div>
                  </div>
                  <div>
                    <div style="font-size:var(--text-xs);color:var(--color-text-tertiary)">毛利</div>
                    <div style="font-weight:var(--font-semibold);color:var(--color-success)">${App.formatMoney(profit)}</div>
                  </div>
                </div>
                <div style="font-size:var(--text-xs);color:var(--color-text-tertiary)">
                  配方：${d.recipe ? d.recipe.length + '种食材' : '未设置配方'}
                </div>
              </div>
            `;
          }).join('')}
          ${filtered.length === 0 ? '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📋</div><div class="empty-state-title">暂无菜品</div></div>' : ''}
        </div>
      </div>
    `;

    bindRecipeEvents(page, dishes);
  }

  function calcDishCost(dish) {
    if (!dish.recipe || dish.recipe.length === 0) return 0;
    return dish.recipe.reduce((sum, ri) => {
      const ing = DB.Ingredients.getById(ri.ingredientId);
      const unitPrice = ing ? ing.purchasePrice : 0;
      return sum + unitPrice * ri.quantity;
    }, 0);
  }

  function bindRecipeEvents(page, dishes) {
    // 分类切换
    page.querySelectorAll('#recipe-cat-tabs .category-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        App.navigate('admin/recipes', { category: tab.dataset.cat });
      });
    });

    // 添加菜品
    page.querySelector('#btn-add-dish').addEventListener('click', () => {
      showDishForm(null);
    });

    // 成本总览
    page.querySelector('#btn-cost-overview').addEventListener('click', () => {
      renderCostOverview();
    });

    // 菜品详情/编辑
    page.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => {
        const dish = DB.Dishes.getById(parseInt(card.dataset.dishId));
        if (dish) showDishDetail(dish);
      });
    });
  }

  // === 菜品表单 ===
  function showDishForm(dish) {
    const isEdit = !!dish;
    const categories = ['热菜', '凉菜', '主食', '汤品', '酒水'];
    const allIngredients = DB.Ingredients.getAll();

    let recipeHtml = '';
    if (dish && dish.recipe) {
      recipeHtml = dish.recipe.map((ri, idx) => `
        <div class="recipe-item-row" style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-sm)">
          <select class="form-select" style="flex:2" name="recipe-ing-${idx}">
            <option value="">选择食材</option>
            ${allIngredients.map(ing => `<option value="${ing.id}" ${ing.id === ri.ingredientId ? 'selected' : ''}>${ing.name} (${App.formatMoney(ing.purchasePrice)}/${ing.unit})</option>`).join('')}
          </select>
          <input class="form-input" type="number" style="flex:1" name="recipe-qty-${idx}" value="${ri.quantity}" step="0.1" min="0" placeholder="用量">
          <input class="form-input" style="flex:1" name="recipe-unit-${idx}" value="${ri.unit}" placeholder="单位">
          <button class="btn btn-icon btn-ghost btn-remove-recipe" style="color:var(--color-danger)">✕</button>
        </div>
      `).join('');
    }

    const content = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">
        <div class="form-group">
          <label class="form-label">菜品名称 *</label>
          <input class="form-input" id="dish-name" value="${dish ? dish.name : ''}" placeholder="例如：鱼香肉丝">
        </div>
        <div class="form-group">
          <label class="form-label">分类 *</label>
          <select class="form-select" id="dish-category">
            ${categories.map(c => `<option value="${c}" ${dish && dish.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-lg)">
        <div class="form-group">
          <label class="form-label">售价 (¥) *</label>
          <input class="form-input" type="number" id="dish-price" value="${dish ? dish.price : 0}" step="0.01" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">出品份量</label>
          <input class="form-input" id="dish-serving" value="${dish ? dish.servingSize || '' : ''}" placeholder="例如：1份/350g">
        </div>
        <div class="form-group">
          <label class="form-label">图标Emoji</label>
          <input class="form-input" id="dish-emoji" value="${dish ? dish.emoji || '' : ''}" placeholder="例如：🥩">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" style="display:flex;justify-content:space-between;align-items:center">
          <span>食材配方（用量标准）</span>
          <button class="btn btn-ghost btn-sm" id="btn-add-recipe-row" type="button">+ 添加食材</button>
        </label>
        <div id="recipe-rows">
          ${recipeHtml || '<div class="recipe-item-row" style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-sm)"><select class="form-select" style="flex:2" name="recipe-ing-0"><option value="">选择食材</option>' + allIngredients.map(ing => `<option value="${ing.id}">${ing.name} (${App.formatMoney(ing.purchasePrice)}/${ing.unit})</option>`).join('') + '</select><input class="form-input" type="number" style="flex:1" name="recipe-qty-0" value="0" step="0.1" min="0" placeholder="用量"><input class="form-input" style="flex:1" name="recipe-unit-0" value="克" placeholder="单位"><button class="btn btn-icon btn-ghost btn-remove-recipe" style="color:var(--color-danger)">✕</button></div>'}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">制作流程</label>
        <textarea class="form-textarea" id="dish-process" placeholder="描述制作步骤">${dish ? dish.process || '' : ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">口味标准</label>
        <input class="form-input" id="dish-taste" value="${dish ? dish.taste || '' : ''}" placeholder="例如：酸甜微辣，肉质嫩滑">
      </div>
    `;

    const footer = `
      <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">取消</button>
      ${isEdit ? '<button class="btn btn-danger" id="btn-delete-dish">删除</button>' : ''}
      <button class="btn btn-primary" id="btn-save-dish">${isEdit ? '保存修改' : '添加菜品'}</button>
    `;

    const modal = App.showModal(isEdit ? '编辑菜品配方' : '添加新菜品', content, footer);

    // 添加食材行
    modal.querySelector('#btn-add-recipe-row').addEventListener('click', () => {
      const rows = modal.querySelector('#recipe-rows');
      const idx = rows.children.length;
      const row = document.createElement('div');
      row.className = 'recipe-item-row';
      row.style.cssText = 'display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-sm)';
      row.innerHTML = `
        <select class="form-select" style="flex:2" name="recipe-ing-${idx}">
          <option value="">选择食材</option>
          ${allIngredients.map(ing => `<option value="${ing.id}">${ing.name} (${App.formatMoney(ing.purchasePrice)}/${ing.unit})</option>`).join('')}
        </select>
        <input class="form-input" type="number" style="flex:1" name="recipe-qty-${idx}" value="0" step="0.1" min="0" placeholder="用量">
        <input class="form-input" style="flex:1" name="recipe-unit-${idx}" value="克" placeholder="单位">
        <button class="btn btn-icon btn-ghost btn-remove-recipe" style="color:var(--color-danger)" type="button">✕</button>
      `;
      row.querySelector('.btn-remove-recipe').addEventListener('click', () => row.remove());
      rows.appendChild(row);
    });

    // 删除食材行
    modal.querySelectorAll('.btn-remove-recipe').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.recipe-item-row').remove());
    });

    // 保存
    modal.querySelector('#btn-save-dish').addEventListener('click', () => {
      const name = modal.querySelector('#dish-name').value.trim();
      const price = parseFloat(modal.querySelector('#dish-price').value) || 0;

      if (!name || price <= 0) {
        App.showToast('请填写菜品名称和有效售价', 'warning');
        return;
      }

      // 收集配方
      const recipe = [];
      modal.querySelectorAll('#recipe-rows .recipe-item-row').forEach(row => {
        const ingSelect = row.querySelector('select');
        const qtyInput = row.querySelector('input[type="number"]');
        const unitInput = row.querySelectorAll('input')[1];
        const ingId = parseInt(ingSelect.value);
        const qty = parseFloat(qtyInput.value) || 0;

        if (ingId && qty > 0) {
          const ing = DB.Ingredients.getById(ingId);
          recipe.push({
            ingredientId: ingId,
            ingredientName: ing ? ing.name : '',
            quantity: qty,
            unit: unitInput ? unitInput.value.trim() : '克'
          });
        }
      });

      const data = {
        name,
        category: modal.querySelector('#dish-category').value,
        price,
        servingSize: modal.querySelector('#dish-serving').value.trim(),
        emoji: modal.querySelector('#dish-emoji').value.trim(),
        recipe,
        process: modal.querySelector('#dish-process').value.trim(),
        taste: modal.querySelector('#dish-taste').value.trim()
      };

      if (isEdit) {
        DB.Dishes.update(dish.id, data);
        App.showToast('菜品配方已更新，成本数据已同步', 'success');
      } else {
        DB.Dishes.insert(data);
        App.showToast('新菜品已添加', 'success');
      }

      Sync.broadcast(Sync.EVENTS.DISH_UPDATE, data);
      modal.remove();
      renderRecipes({});
    });

    // 删除
    if (isEdit) {
      modal.querySelector('#btn-delete-dish').addEventListener('click', () => {
        App.confirm('删除菜品', `确定删除「${dish.name}」吗？此操作不可恢复。`, () => {
          DB.Dishes.remove(dish.id);
          Sync.broadcast(Sync.EVENTS.DATA_CHANGED, {});
          modal.remove();
          renderRecipes({});
          App.showToast('菜品已删除', 'success');
        });
      });
    }
  }

  // === 菜品详情 ===
  function showDishDetail(dish) {
    const cost = calcDishCost(dish);
    const profit = dish.price - cost;
    const margin = dish.price > 0 ? ((profit / dish.price) * 100) : 0;

    const recipeDetails = dish.recipe && dish.recipe.length > 0
      ? dish.recipe.map(ri => {
          const ing = DB.Ingredients.getById(ri.ingredientId);
          const itemCost = (ing ? ing.purchasePrice : 0) * ri.quantity;
          return `
            <tr>
              <td>${ri.ingredientName}</td>
              <td>${ri.quantity} ${ri.unit}</td>
              <td>${ing ? App.formatMoney(ing.purchasePrice) + '/' + ing.unit : '-'}</td>
              <td>${App.formatMoney(itemCost)}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="4" style="text-align:center">未设置配方</td></tr>';

    const content = `
      <div style="text-align:center;margin-bottom:var(--space-xl)">
        <div style="font-size:48px;margin-bottom:var(--space-sm)">${dish.emoji || '🍽️'}</div>
        <h4>${dish.name}</h4>
        <div style="color:var(--color-text-tertiary);font-size:var(--text-sm)">${dish.category} · ${dish.servingSize || ''}</div>
      </div>

      <div class="dashboard-grid" style="margin-bottom:var(--space-xl)">
        <div class="stat-card" style="text-align:center">
          <div class="stat-card-label">售价</div>
          <div class="stat-card-value" style="font-size:var(--text-2xl);color:var(--color-danger)">${App.formatMoney(dish.price)}</div>
        </div>
        <div class="stat-card" style="text-align:center">
          <div class="stat-card-label">食材成本</div>
          <div class="stat-card-value" style="font-size:var(--text-2xl)">${App.formatMoney(cost)}</div>
        </div>
        <div class="stat-card" style="text-align:center">
          <div class="stat-card-label">毛利</div>
          <div class="stat-card-value" style="font-size:var(--text-2xl);color:var(--color-success)">${App.formatMoney(profit)}</div>
        </div>
        <div class="stat-card" style="text-align:center">
          <div class="stat-card-label">毛利率</div>
          <div class="stat-card-value" style="font-size:var(--text-2xl);color:${margin >= 60 ? 'var(--color-success)' : margin >= 40 ? 'var(--color-warning)' : 'var(--color-danger)'}">${margin.toFixed(1)}%</div>
        </div>
      </div>

      <h6 style="margin-bottom:var(--space-md)">食材配方明细</h6>
      <div class="table-wrapper" style="margin-bottom:var(--space-xl)">
        <table>
          <thead><tr><th>食材</th><th>标准用量</th><th>单价</th><th>小计</th></tr></thead>
          <tbody>${recipeDetails}</tbody>
        </table>
      </div>

      ${dish.process ? `<div style="margin-bottom:var(--space-xl)"><h6 style="margin-bottom:var(--space-sm)">制作流程</h6><p style="color:var(--color-text-secondary);font-size:var(--text-sm);line-height:1.6">${dish.process}</p></div>` : ''}
      ${dish.taste ? `<div style="margin-bottom:var(--space-xl)"><h6 style="margin-bottom:var(--space-sm)">口味标准</h6><p style="color:var(--color-text-secondary);font-size:var(--text-sm)">${dish.taste}</p></div>` : ''}
    `;

    const footer = `
      <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">关闭</button>
      <button class="btn btn-primary" id="btn-edit-dish-detail">编辑配方</button>
    `;

    const modal = App.showModal(dish.name + ' - 配方详情', content, footer);

    modal.querySelector('#btn-edit-dish-detail').addEventListener('click', () => {
      modal.remove();
      showDishForm(dish);
    });
  }

  // === 成本总览 ===
  function renderCostOverview() {
    const dishes = DB.Dishes.getAll();
    const costData = dishes.map(d => {
      const cost = calcDishCost(d);
      const profit = d.price - cost;
      const margin = d.price > 0 ? (profit / d.price) * 100 : 0;
      return { ...d, cost, profit, margin };
    }).sort((a, b) => b.margin - a.margin);

    const avgMargin = costData.length > 0
      ? costData.reduce((s, d) => s + d.margin, 0) / costData.length
      : 0;

    const totalCost = costData.reduce((s, d) => s + d.cost, 0);
    const totalRevenue = costData.reduce((s, d) => s + d.price, 0);
    const totalProfit = totalRevenue - totalCost;
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const content = `
      <div class="dashboard-grid" style="margin-bottom:var(--space-xl)">
        <div class="stat-card">
          <div class="stat-card-label">菜品总数</div>
          <div class="stat-card-value">${dishes.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">全店总成本</div>
          <div class="stat-card-value">${App.formatMoney(totalCost)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">全店总毛利</div>
          <div class="stat-card-value" style="color:var(--color-success)">${App.formatMoney(totalProfit)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">综合毛利率</div>
          <div class="stat-card-value" style="color:${overallMargin >= 60 ? 'var(--color-success)' : 'var(--color-warning)'}">${overallMargin.toFixed(1)}%</div>
        </div>
      </div>

      <h6 style="margin-bottom:var(--space-md)">各菜品毛利排行</h6>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>排名</th><th>菜品</th><th>售价</th><th>食材成本</th><th>毛利</th><th>毛利率</th><th>评价</th></tr>
          </thead>
          <tbody>
            ${costData.map((d, idx) => `
              <tr>
                <td>#${idx + 1}</td>
                <td style="font-weight:var(--font-medium)">${d.emoji || ''} ${d.name}</td>
                <td>${App.formatMoney(d.price)}</td>
                <td>${App.formatMoney(d.cost)}</td>
                <td style="color:var(--color-success)">${App.formatMoney(d.profit)}</td>
                <td><span class="tag ${d.margin >= 60 ? 'tag-success' : d.margin >= 40 ? 'tag-warning' : 'tag-danger'}">${d.margin.toFixed(1)}%</span></td>
                <td style="font-size:var(--text-xs)">${d.margin >= 65 ? '⭐ 高利润' : d.margin >= 40 ? '👍 正常' : '⚠️ 低利润'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:var(--space-xl);padding:var(--space-lg);background:var(--color-bg);border-radius:var(--radius-xl)">
        <h6 style="margin-bottom:var(--space-sm)">📊 成本分析总结</h6>
        <p style="color:var(--color-text-secondary);font-size:var(--text-sm);line-height:1.6">
          全店综合毛利率 <strong>${overallMargin.toFixed(1)}%</strong>，
          ${overallMargin >= 65 ? '盈利状况优秀，成本控制良好。' :
            overallMargin >= 50 ? '盈利状况正常，可考虑优化部分低毛利菜品。' :
            '毛利率偏低，建议重新审视菜品定价或食材采购成本。'}
          共 <strong>${costData.filter(d => d.margin < 40).length}</strong> 道菜品毛利低于40%，建议重点关注。
        </p>
      </div>
    `;

    const footer = `<button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">关闭</button>`;
    App.showModal('💰 菜品成本与毛利总览', content, footer);
  }

  // === 注册路由 ===
  App.registerRoute('admin/recipes', renderRecipes);

  return { renderRecipes, calcDishCost, renderCostOverview };
})();
