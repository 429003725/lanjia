/* ============================================================
   兰家 - 数据持久化层
   所有数据通过 localStorage 存储，支持 CRUD 操作
   ============================================================ */

const DB = (() => {
  const KEYS = {
    DISHES: 'rx_dishes',
    INGREDIENTS: 'rx_ingredients',
    TABLES: 'rx_tables',
    ORDERS: 'rx_orders',
    EXPENSES: 'rx_expenses',
    PURCHASES: 'rx_purchases',
    DAILY_REPORTS: 'rx_daily_reports',
    SETTINGS: 'rx_settings',
    COUNTERS: 'rx_counters'
  };

  // 获取下一个自增ID
  function nextId(key) {
    const counters = getData(KEYS.COUNTERS) || {};
    counters[key] = (counters[key] || 0) + 1;
    setData(KEYS.COUNTERS, counters);
    return counters[key];
  }

  function getData(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch(e) {
      console.error('DB read error:', e);
      return null;
    }
  }

  function setData(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch(e) {
      console.error('DB write error:', e);
      return false;
    }
  }

  // === 通用 CRUD ===
  function getAll(key) { return getData(key) || []; }

  function getById(key, id) {
    const list = getAll(key);
    return list.find(item => item.id === id) || null;
  }

  function insert(key, item) {
    const list = getAll(key);
    const newItem = {
      ...item,
      id: item.id || nextId(key),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    list.push(newItem);
    setData(key, list);
    return newItem;
  }

  function update(key, id, updates) {
    const list = getAll(key);
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;
    list[index] = {
      ...list[index],
      ...updates,
      id: list[index].id,
      createdAt: list[index].createdAt,
      updatedAt: new Date().toISOString()
    };
    setData(key, list);
    return list[index];
  }

  function remove(key, id) {
    const list = getAll(key);
    const filtered = list.filter(item => item.id !== id);
    if (filtered.length === list.length) return false;
    setData(key, filtered);
    return true;
  }

  function query(key, predicate) {
    return getAll(key).filter(predicate);
  }

  // === 菜品操作 ===
  const Dishes = {
    getAll: () => getAll(KEYS.DISHES),
    getById: (id) => getById(KEYS.DISHES, id),
    insert: (dish) => insert(KEYS.DISHES, dish),
    update: (id, updates) => update(KEYS.DISHES, id, updates),
    remove: (id) => remove(KEYS.DISHES, id),
    query: (pred) => query(KEYS.DISHES, pred),
    getByCategory: (cat) => query(KEYS.DISHES, d => d.category === cat)
  };

  // === 食材库存操作 ===
  const Ingredients = {
    getAll: () => getAll(KEYS.INGREDIENTS),
    getById: (id) => getById(KEYS.INGREDIENTS, id),
    insert: (ing) => insert(KEYS.INGREDIENTS, ing),
    update: (id, updates) => update(KEYS.INGREDIENTS, id, updates),
    remove: (id) => remove(KEYS.INGREDIENTS, id),
    query: (pred) => query(KEYS.INGREDIENTS, pred),
    getByCategory: (cat) => query(KEYS.INGREDIENTS, i => i.category === cat),
    // 扣减库存（点单时调用）
    deduct: (ingredientId, amount) => {
      const ing = getById(KEYS.INGREDIENTS, ingredientId);
      if (!ing) return false;
      const newStock = Math.max(0, ing.stock - amount);
      update(KEYS.INGREDIENTS, ingredientId, { stock: newStock });
      return newStock;
    },
    // 获取库存不足的食材
    getLowStock: () => query(KEYS.INGREDIENTS, i => i.stock <= i.minStock)
  };

  // === 桌台操作 ===
  const Tables = {
    getAll: () => getAll(KEYS.TABLES),
    getById: (id) => getById(KEYS.TABLES, id),
    insert: (table) => insert(KEYS.TABLES, table),
    update: (id, updates) => update(KEYS.TABLES, id, updates),
    remove: (id) => remove(KEYS.TABLES, id),
    getAvailable: () => query(KEYS.TABLES, t => t.status === 'available')
  };

  // === 订单操作 ===
  const Orders = {
    getAll: () => getAll(KEYS.ORDERS),
    getById: (id) => getById(KEYS.ORDERS, id),
    insert: (order) => insert(KEYS.ORDERS, order),
    update: (id, updates) => update(KEYS.ORDERS, id, updates),
    remove: (id) => remove(KEYS.ORDERS, id),
    query: (pred) => query(KEYS.ORDERS, pred),
    getByTable: (tableId) => query(KEYS.ORDERS, o => o.tableId === tableId && o.status === 'dining'),
    getByStatus: (status) => query(KEYS.ORDERS, o => status ? o.status === status : true),
    getTodayOrders: () => {
      const today = new Date().toISOString().split('T')[0];
      return query(KEYS.ORDERS, o => o.createdAt.startsWith(today));
    },
    // 更新订单中某个菜品项的状态
    updateItemStatus: (orderId, itemIndex, status) => {
      const order = getById(KEYS.ORDERS, orderId);
      if (!order) return null;
      order.items[itemIndex].status = status;
      order.updatedAt = new Date().toISOString();
      // 如果所有菜品都已上菜，则订单完成
      if (order.items.every(i => i.status === 'served')) {
        order.status = 'completed';
      }
      update(KEYS.ORDERS, orderId, order);
      return order;
    }
  };

  // === 支出操作 ===
  const Expenses = {
    getAll: () => getAll(KEYS.EXPENSES),
    getById: (id) => getById(KEYS.EXPENSES, id),
    insert: (exp) => insert(KEYS.EXPENSES, exp),
    update: (id, updates) => update(KEYS.EXPENSES, id, updates),
    remove: (id) => remove(KEYS.EXPENSES, id),
    query: (pred) => query(KEYS.EXPENSES, pred),
    getTodayExpenses: () => {
      const today = new Date().toISOString().split('T')[0];
      return query(KEYS.EXPENSES, e => e.date === today);
    }
  };

  // === 采购记录操作 ===
  const Purchases = {
    getAll: () => getAll(KEYS.PURCHASES),
    getById: (id) => getById(KEYS.PURCHASES, id),
    insert: (p) => insert(KEYS.PURCHASES, p),
    update: (id, updates) => update(KEYS.PURCHASES, id, updates),
    remove: (id) => remove(KEYS.PURCHASES, id),
    query: (pred) => query(KEYS.PURCHASES, pred)
  };

  // === 设置操作 ===
  const Settings = {
    get: () => getData(KEYS.SETTINGS) || {},
    set: (key, value) => {
      const s = getData(KEYS.SETTINGS) || {};
      s[key] = value;
      setData(KEYS.SETTINGS, s);
    },
    getAll: () => getData(KEYS.SETTINGS) || {}
  };

  // === 批量导入/导出 ===
  function exportAll() {
    const data = {};
    Object.values(KEYS).forEach(k => { data[k] = getData(k); });
    return JSON.stringify(data, null, 2);
  }

  function importAll(json) {
    try {
      const data = JSON.parse(json);
      Object.entries(data).forEach(([k, v]) => {
        if (Object.values(KEYS).includes(k)) {
          setData(k, v);
        }
      });
      return true;
    } catch(e) {
      return false;
    }
  }

  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  // === 初始化演示数据 ===
  function initDemoData() {
    if (getAll(KEYS.DISHES).length > 0) return; // 已有数据则跳过

    // 初始化食材
    const ingredients = [
      { id: 1, name: '猪里脊肉', category: '肉类', stock: 5000, unit: '克', minStock: 1000, supplier: '张记肉铺', purchasePrice: 36 },
      { id: 2, name: '五花肉', category: '肉类', stock: 3000, unit: '克', minStock: 800, supplier: '张记肉铺', purchasePrice: 32 },
      { id: 3, name: '鸡腿肉', category: '肉类', stock: 4000, unit: '克', minStock: 1000, supplier: '大成食品', purchasePrice: 22 },
      { id: 4, name: '鸡蛋', category: '干货调料', stock: 60, unit: '个', minStock: 20, supplier: '永辉超市', purchasePrice: 1.2 },
      { id: 5, name: '大米', category: '粮油', stock: 50000, unit: '克', minStock: 10000, supplier: '中粮集团', purchasePrice: 0.008 },
      { id: 6, name: '面粉', category: '粮油', stock: 10000, unit: '克', minStock: 3000, supplier: '中粮集团', purchasePrice: 0.006 },
      { id: 7, name: '食用油', category: '粮油', stock: 20000, unit: '毫升', minStock: 5000, supplier: '金龙鱼', purchasePrice: 0.02 },
      { id: 8, name: '盐', category: '干货调料', stock: 5000, unit: '克', minStock: 500, supplier: '永辉超市', purchasePrice: 0.005 },
      { id: 9, name: '生抽', category: '干货调料', stock: 3000, unit: '毫升', minStock: 500, supplier: '海天', purchasePrice: 0.02 },
      { id: 10, name: '老抽', category: '干货调料', stock: 2000, unit: '毫升', minStock: 300, supplier: '海天', purchasePrice: 0.025 },
      { id: 11, name: '料酒', category: '干货调料', stock: 2000, unit: '毫升', minStock: 300, supplier: '古越龙山', purchasePrice: 0.03 },
      { id: 12, name: '白糖', category: '干货调料', stock: 3000, unit: '克', minStock: 500, supplier: '永辉超市', purchasePrice: 0.012 },
      { id: 13, name: '醋', category: '干货调料', stock: 2000, unit: '毫升', minStock: 300, supplier: '恒顺', purchasePrice: 0.015 },
      { id: 14, name: '生姜', category: '蔬菜', stock: 2000, unit: '克', minStock: 300, supplier: '农贸市场', purchasePrice: 12 },
      { id: 15, name: '大葱', category: '蔬菜', stock: 3000, unit: '克', minStock: 500, supplier: '农贸市场', purchasePrice: 6 },
      { id: 16, name: '大蒜', category: '蔬菜', stock: 2000, unit: '克', minStock: 300, supplier: '农贸市场', purchasePrice: 10 },
      { id: 17, name: '青椒', category: '蔬菜', stock: 3000, unit: '克', minStock: 500, supplier: '农贸市场', purchasePrice: 8 },
      { id: 18, name: '土豆', category: '蔬菜', stock: 5000, unit: '克', minStock: 1000, supplier: '农贸市场', purchasePrice: 4 },
      { id: 19, name: '西红柿', category: '蔬菜', stock: 3000, unit: '克', minStock: 500, supplier: '农贸市场', purchasePrice: 7 },
      { id: 20, name: '豆腐', category: '蔬菜', stock: 2000, unit: '克', minStock: 400, supplier: '豆制品厂', purchasePrice: 5 },
      { id: 21, name: '干辣椒', category: '干货调料', stock: 1000, unit: '克', minStock: 200, supplier: '永辉超市', purchasePrice: 40 },
      { id: 22, name: '花椒', category: '干货调料', stock: 500, unit: '克', minStock: 100, supplier: '永辉超市', purchasePrice: 80 },
      { id: 23, name: '豆瓣酱', category: '干货调料', stock: 2000, unit: '克', minStock: 300, supplier: '郫县豆瓣', purchasePrice: 0.03 },
      { id: 24, name: '香菜', category: '蔬菜', stock: 500, unit: '克', minStock: 100, supplier: '农贸市场', purchasePrice: 15 },
      { id: 25, name: '黄瓜', category: '蔬菜', stock: 2000, unit: '克', minStock: 400, supplier: '农贸市场', purchasePrice: 5 },
      { id: 26, name: '木耳', category: '干货调料', stock: 1000, unit: '克', minStock: 200, supplier: '永辉超市', purchasePrice: 60 },
      { id: 27, name: '花生米', category: '干货调料', stock: 2000, unit: '克', minStock: 400, supplier: '永辉超市', purchasePrice: 16 },
      { id: 28, name: '啤酒', category: '酒水饮品', stock: 100, unit: '瓶', minStock: 20, supplier: '雪花啤酒', purchasePrice: 4 },
      { id: 29, name: '可乐', category: '酒水饮品', stock: 80, unit: '瓶', minStock: 15, supplier: '可口可乐', purchasePrice: 2.5 },
      { id: 30, name: '橙汁', category: '酒水饮品', stock: 40, unit: '瓶', minStock: 10, supplier: '汇源', purchasePrice: 5 }
    ];
    ingredients.forEach(i => {
      i.createdAt = new Date().toISOString();
      i.updatedAt = new Date().toISOString();
    });
    setData(KEYS.INGREDIENTS, ingredients);

    // 初始化菜品
    const dishes = [
      { id: 1, name: '鱼香肉丝', category: '热菜', price: 38, emoji: '🥩', servingSize: '1份/350g',
        recipe: [
          { ingredientId: 1, ingredientName: '猪里脊肉', quantity: 200, unit: '克' },
          { ingredientId: 26, ingredientName: '木耳', quantity: 30, unit: '克' },
          { ingredientId: 17, ingredientName: '青椒', quantity: 50, unit: '克' },
          { ingredientId: 9, ingredientName: '生抽', quantity: 15, unit: '毫升' },
          { ingredientId: 13, ingredientName: '醋', quantity: 10, unit: '毫升' },
          { ingredientId: 12, ingredientName: '白糖', quantity: 10, unit: '克' },
          { ingredientId: 23, ingredientName: '豆瓣酱', quantity: 20, unit: '克' },
          { ingredientId: 14, ingredientName: '生姜', quantity: 10, unit: '克' },
          { ingredientId: 15, ingredientName: '大葱', quantity: 15, unit: '克' },
          { ingredientId: 16, ingredientName: '大蒜', quantity: 10, unit: '克' },
          { ingredientId: 7, ingredientName: '食用油', quantity: 30, unit: '毫升' },
          { ingredientId: 8, ingredientName: '盐', quantity: 3, unit: '克' }
        ],
        process: '1.猪肉切丝腌制 2.调制鱼香汁 3.热油滑炒肉丝 4.加入配菜和调味汁翻炒均匀',
        taste: '酸甜微辣，肉质嫩滑，鱼香味浓郁' },
      { id: 2, name: '回锅肉', category: '热菜', price: 42, emoji: '🥓', servingSize: '1份/300g',
        recipe: [
          { ingredientId: 2, ingredientName: '五花肉', quantity: 250, unit: '克' },
          { ingredientId: 17, ingredientName: '青椒', quantity: 60, unit: '克' },
          { ingredientId: 15, ingredientName: '大葱', quantity: 20, unit: '克' },
          { ingredientId: 23, ingredientName: '豆瓣酱', quantity: 25, unit: '克' },
          { ingredientId: 9, ingredientName: '生抽', quantity: 10, unit: '毫升' },
          { ingredientId: 12, ingredientName: '白糖', quantity: 5, unit: '克' },
          { ingredientId: 14, ingredientName: '生姜', quantity: 10, unit: '克' },
          { ingredientId: 7, ingredientName: '食用油', quantity: 20, unit: '毫升' }
        ],
        process: '1.五花肉煮至八成熟切片 2.热锅少油煸炒肉片至卷曲 3.加入豆瓣酱炒出红油 4.加入青椒葱段翻炒',
        taste: '咸鲜微辣，肉片肥而不腻，酱香浓郁' },
      { id: 3, name: '宫保鸡丁', category: '热菜', price: 36, emoji: '🍗', servingSize: '1份/280g',
        recipe: [
          { ingredientId: 3, ingredientName: '鸡腿肉', quantity: 200, unit: '克' },
          { ingredientId: 27, ingredientName: '花生米', quantity: 30, unit: '克' },
          { ingredientId: 15, ingredientName: '大葱', quantity: 20, unit: '克' },
          { ingredientId: 21, ingredientName: '干辣椒', quantity: 10, unit: '克' },
          { ingredientId: 22, ingredientName: '花椒', quantity: 3, unit: '克' },
          { ingredientId: 9, ingredientName: '生抽', quantity: 12, unit: '毫升' },
          { ingredientId: 13, ingredientName: '醋', quantity: 8, unit: '毫升' },
          { ingredientId: 12, ingredientName: '白糖', quantity: 8, unit: '克' },
          { ingredientId: 11, ingredientName: '料酒', quantity: 10, unit: '毫升' },
          { ingredientId: 14, ingredientName: '生姜', quantity: 8, unit: '克' },
          { ingredientId: 16, ingredientName: '大蒜', quantity: 8, unit: '克' },
          { ingredientId: 7, ingredientName: '食用油', quantity: 25, unit: '毫升' },
          { ingredientId: 8, ingredientName: '盐', quantity: 2, unit: '克' }
        ],
        process: '1.鸡腿肉切丁腌制 2.调制宫保汁 3.小火炒香辣椒花椒 4.大火爆炒鸡丁 5.加调味汁和花生米翻匀',
        taste: '麻辣鲜香，鸡肉嫩滑，花生酥脆，荔枝味' },
      { id: 4, name: '麻婆豆腐', category: '热菜', price: 28, emoji: '🧈', servingSize: '1份/300g',
        recipe: [
          { ingredientId: 20, ingredientName: '豆腐', quantity: 300, unit: '克' },
          { ingredientId: 2, ingredientName: '五花肉', quantity: 50, unit: '克' },
          { ingredientId: 23, ingredientName: '豆瓣酱', quantity: 20, unit: '克' },
          { ingredientId: 22, ingredientName: '花椒', quantity: 3, unit: '克' },
          { ingredientId: 9, ingredientName: '生抽', quantity: 8, unit: '毫升' },
          { ingredientId: 15, ingredientName: '大葱', quantity: 10, unit: '克' },
          { ingredientId: 14, ingredientName: '生姜', quantity: 5, unit: '克' },
          { ingredientId: 16, ingredientName: '大蒜', quantity: 5, unit: '克' },
          { ingredientId: 7, ingredientName: '食用油', quantity: 20, unit: '毫升' },
          { ingredientId: 8, ingredientName: '盐', quantity: 2, unit: '克' }
        ],
        process: '1.豆腐切块焯水 2.肉末炒香 3.加豆瓣酱炒出红油 4.加汤烧开放入豆腐 5.小火慢炖入味 6.出锅撒花椒面',
        taste: '麻辣鲜香，豆腐嫩滑，口感丰富' },
      { id: 5, name: '西红柿炒鸡蛋', category: '热菜', price: 22, emoji: '🍅', servingSize: '1份/280g',
        recipe: [
          { ingredientId: 19, ingredientName: '西红柿', quantity: 200, unit: '克' },
          { ingredientId: 4, ingredientName: '鸡蛋', quantity: 3, unit: '个' },
          { ingredientId: 12, ingredientName: '白糖', quantity: 5, unit: '克' },
          { ingredientId: 15, ingredientName: '大葱', quantity: 10, unit: '克' },
          { ingredientId: 7, ingredientName: '食用油', quantity: 20, unit: '毫升' },
          { ingredientId: 8, ingredientName: '盐', quantity: 3, unit: '克' }
        ],
        process: '1.鸡蛋打散加盐 2.西红柿切块 3.热油炒鸡蛋盛出 4.炒西红柿出汁 5.加入鸡蛋翻炒均匀',
        taste: '酸甜适口，家常美味，营养丰富' },
      { id: 6, name: '酸辣土豆丝', category: '热菜', price: 18, emoji: '🥔', servingSize: '1份/250g',
        recipe: [
          { ingredientId: 18, ingredientName: '土豆', quantity: 250, unit: '克' },
          { ingredientId: 17, ingredientName: '青椒', quantity: 30, unit: '克' },
          { ingredientId: 21, ingredientName: '干辣椒', quantity: 5, unit: '克' },
          { ingredientId: 13, ingredientName: '醋', quantity: 15, unit: '毫升' },
          { ingredientId: 8, ingredientName: '盐', quantity: 3, unit: '克' },
          { ingredientId: 7, ingredientName: '食用油', quantity: 20, unit: '毫升' },
          { ingredientId: 16, ingredientName: '大蒜', quantity: 5, unit: '克' }
        ],
        process: '1.土豆切细丝泡水去淀粉 2.青椒切丝 3.热油爆香辣椒蒜末 4.大火快炒土豆丝 5.加醋和盐调味',
        taste: '酸辣爽脆，开胃下饭' },
      { id: 7, name: '拍黄瓜', category: '凉菜', price: 16, emoji: '🥒', servingSize: '1份/200g',
        recipe: [
          { ingredientId: 25, ingredientName: '黄瓜', quantity: 200, unit: '克' },
          { ingredientId: 16, ingredientName: '大蒜', quantity: 8, unit: '克' },
          { ingredientId: 13, ingredientName: '醋', quantity: 10, unit: '毫升' },
          { ingredientId: 9, ingredientName: '生抽', quantity: 8, unit: '毫升' },
          { ingredientId: 12, ingredientName: '白糖', quantity: 3, unit: '克' },
          { ingredientId: 8, ingredientName: '盐', quantity: 2, unit: '克' },
          { ingredientId: 24, ingredientName: '香菜', quantity: 5, unit: '克' }
        ],
        process: '1.黄瓜拍碎切段 2.调制蒜泥酱汁 3.拌匀即可',
        taste: '清爽脆嫩，蒜香浓郁' },
      { id: 8, name: '蛋炒饭', category: '主食', price: 20, emoji: '🍚', servingSize: '1份/350g',
        recipe: [
          { ingredientId: 5, ingredientName: '大米', quantity: 200, unit: '克' },
          { ingredientId: 4, ingredientName: '鸡蛋', quantity: 2, unit: '个' },
          { ingredientId: 15, ingredientName: '大葱', quantity: 10, unit: '克' },
          { ingredientId: 7, ingredientName: '食用油', quantity: 15, unit: '毫升' },
          { ingredientId: 8, ingredientName: '盐', quantity: 2, unit: '克' }
        ],
        process: '1.米饭提前煮好晾凉 2.鸡蛋打散 3.热油炒鸡蛋 4.加入米饭翻炒 5.加葱花盐调味',
        taste: '粒粒分明，葱香蛋香交融' },
      { id: 9, name: '紫菜蛋花汤', category: '汤品', price: 15, emoji: '🍜', servingSize: '1份/400ml',
        recipe: [
          { ingredientId: 4, ingredientName: '鸡蛋', quantity: 1, unit: '个' },
          { ingredientId: 8, ingredientName: '盐', quantity: 2, unit: '克' },
          { ingredientId: 15, ingredientName: '大葱', quantity: 5, unit: '克' },
          { ingredientId: 24, ingredientName: '香菜', quantity: 3, unit: '克' }
        ],
        process: '1.水烧开 2.淋入蛋液 3.加紫菜 4.加盐调味 5.撒葱花香菜',
        taste: '清淡鲜美，营养暖胃' },
      { id: 10, name: '啤酒', category: '酒水', price: 8, emoji: '🍺', servingSize: '1瓶',
        recipe: [{ ingredientId: 28, ingredientName: '啤酒', quantity: 1, unit: '瓶' }],
        process: '直接上桌',
        taste: '冰镇啤酒' },
      { id: 11, name: '可乐', category: '酒水', price: 6, emoji: '🥤', servingSize: '1瓶',
        recipe: [{ ingredientId: 29, ingredientName: '可乐', quantity: 1, unit: '瓶' }],
        process: '直接上桌',
        taste: '冰镇可乐' },
      { id: 12, name: '橙汁', category: '酒水', price: 12, emoji: '🧃', servingSize: '1瓶',
        recipe: [{ ingredientId: 30, ingredientName: '橙汁', quantity: 1, unit: '瓶' }],
        process: '直接上桌',
        taste: '鲜榨橙汁' }
    ];
    dishes.forEach(d => {
      d.createdAt = new Date().toISOString();
      d.updatedAt = new Date().toISOString();
    });
    setData(KEYS.DISHES, dishes);

    // 初始化桌台
    const tables = [];
    for (let i = 1; i <= 12; i++) {
      tables.push({
        id: i,
        name: i + '号桌',
        capacity: i <= 4 ? 4 : i <= 8 ? 6 : 8,
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    setData(KEYS.TABLES, tables);

    // 初始化设置
    setData(KEYS.SETTINGS, {
      restaurantName: '兰家',
      dailyBudget: 3000,
      currency: '¥',
      lowStockAlert: true
    });
  }

  return {
    KEYS,
    Dishes, Ingredients, Tables, Orders, Expenses, Purchases, Settings,
    exportAll, importAll, clearAll, initDemoData,
    getData, setData, getAll, getById, insert, update, remove
  };
})();
