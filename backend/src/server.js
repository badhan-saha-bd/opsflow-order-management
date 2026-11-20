import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool, dbReady } from './db.js';
import { createDatabaseMonitor } from './database-monitor.js';
import { metricsMiddleware, registry, ordersCreated, orderTransitions } from './metrics.js';
import { ORDER_STATUSES, canTransition, allowedNextStatuses, orderCode, positiveInt, queryLimit, parseProduct, parseOrder } from './domain.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '48kb' }));
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(v => v.trim());
app.use(cors({ origin(origin, callback) {
  if (!origin || origins.includes(origin)) return callback(null, true);
  return callback(new Error('CORS origin denied'));
}}));
app.use(metricsMiddleware);
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sendValidation = (res, err) => res.status(400).json({ error: err.message });

app.get('/health/live', (_req, res) => res.json({ status: 'alive', service: 'opsflow-api' }));
app.get('/health/ready', asyncRoute(async (_req, res) => {
  try { await dbReady(); res.json({ status: 'ready', database: 'connected' }); }
  catch { res.status(503).json({ status: 'not_ready', database: 'unavailable' }); }
}));
app.get('/metrics', asyncRoute(async (_req, res) => {
  res.type(registry.contentType);
  res.end(await registry.metrics());
}));
app.get('/api/version', (_req, res) => res.json({
  service: 'opsflow-api', version: process.env.APP_VERSION || '1.0.0', environment: process.env.APP_ENV || 'DEV',
}));

app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  const [[products], [orders], [statusRows], [daily], [recent], [lowStock]] = await Promise.all([
    pool.query('SELECT COUNT(*) AS total, COALESCE(SUM(stock_qty), 0) AS units, SUM(CASE WHEN stock_qty <= reorder_level THEN 1 ELSE 0 END) AS lowStock FROM products'),
    pool.query("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total_amount ELSE 0 END), 0) AS revenue FROM orders"),
    pool.query('SELECT status, COUNT(*) AS total FROM orders GROUP BY status'),
    pool.query("SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL 6 DAY GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d') ORDER BY day"),
    pool.query('SELECT id, order_code AS orderCode, customer_name AS customerName, status, total_amount AS total, created_at AS createdAt FROM orders ORDER BY created_at DESC, id DESC LIMIT 6'),
    pool.query('SELECT id, sku, name, stock_qty AS stock, reorder_level AS reorderLevel FROM products WHERE stock_qty <= reorder_level ORDER BY stock_qty ASC LIMIT 5'),
  ]);
  const statuses = Object.fromEntries(ORDER_STATUSES.map(s => [s, 0]));
  for (const r of statusRows) statuses[r.status] = Number(r.total);
  res.json({
    products: Number(products[0].total), inventoryUnits: Number(products[0].units),
    lowStockCount: Number(products[0].lowStock), orders: Number(orders[0].total),
    revenue: Number(orders[0].revenue), statuses,
    daily: daily.map(r => ({ day: r.day, count: Number(r.count) })),
    recent: recent.map(formatOrder), lowStock,
  });
}));

function formatOrder(row) {
  return { ...row, total: Number(row.total), itemCount: row.itemCount === undefined ? undefined : Number(row.itemCount) };
}

app.get('/api/products', asyncRoute(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  const low = String(req.query.lowStock ?? '') === 'true';
  const conditions = [];
  const params = [];
  if (q) { conditions.push('(name LIKE ? OR sku LIKE ? OR category LIKE ?)'); params.push(...Array(3).fill(`%${q}%`)); }
  if (low) conditions.push('stock_qty <= reorder_level');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT id, sku, name, category, price, stock_qty AS stock, reorder_level AS reorderLevel, created_at AS createdAt FROM products ${where} ORDER BY name ASC LIMIT ${queryLimit(req.query.limit, 80, 100)}`, params);
  res.json({ products: rows.map(r => ({ ...r, price: Number(r.price) })), count: rows.length });
}));

app.post('/api/products', asyncRoute(async (req, res) => {
  let data;
  try { data = parseProduct(req.body); } catch (err) { return sendValidation(res, err); }
  try {
    const [result] = await pool.execute('INSERT INTO products (sku, name, category, price, stock_qty, reorder_level) VALUES (?, ?, ?, ?, ?, ?)',
      [data.sku, data.name, data.category, data.price, data.stock, data.reorderLevel]);
    res.status(201).json({ id: result.insertId, ...data });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This SKU already exists' });
    throw err;
  }
}));

app.patch('/api/products/:id/restock', asyncRoute(async (req, res) => {
  const id = positiveInt(req.params.id);
  const quantity = positiveInt(req.body?.quantity, 500);
  if (!id || !quantity) return res.status(400).json({ error: 'Valid product ID and quantity (1–500) are required' });
  const [result] = await pool.execute('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?', [quantity, id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Product not found' });
  const [rows] = await pool.execute('SELECT stock_qty AS stock FROM products WHERE id = ?', [id]);
  return res.json({ id, stock: rows[0].stock });
}));

app.get('/api/orders', asyncRoute(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  const status = String(req.query.status ?? '');
  if (status && !ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status filter' });
  const conditions = []; const params = [];
  if (status) { conditions.push('o.status = ?'); params.push(status); }
  if (q) { conditions.push('(o.order_code LIKE ? OR o.customer_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = queryLimit(req.query.limit, 50, 100);
  const [rows] = await pool.query(`
    SELECT o.id, o.order_code AS orderCode, o.customer_name AS customerName, o.customer_email AS customerEmail,
      o.status, o.total_amount AS total, o.created_at AS createdAt,
      (SELECT COALESCE(SUM(quantity), 0) FROM order_items i WHERE i.order_id = o.id) AS itemCount
    FROM orders o ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT ${limit}`, params);
  res.json({ orders: rows.map(formatOrder), count: rows.length });
}));

app.get('/api/orders/:id', asyncRoute(async (req, res) => {
  const id = positiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid order ID' });
  const [rows] = await pool.execute('SELECT id, order_code AS orderCode, customer_name AS customerName, customer_email AS customerEmail, status, total_amount AS total, created_at AS createdAt FROM orders WHERE id = ?', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Order not found' });
  const [items] = await pool.execute('SELECT product_id AS productId, product_name AS productName, quantity, unit_price AS unitPrice FROM order_items WHERE order_id = ?', [id]);
  const [events] = await pool.execute('SELECT status, note, created_at AS createdAt FROM order_events WHERE order_id = ? ORDER BY created_at DESC', [id]);
  return res.json({ order: formatOrder(rows[0]), items, events, allowedNextStatuses: allowedNextStatuses(rows[0].status) });
}));

app.post('/api/orders', asyncRoute(async (req, res) => {
  let data;
  try { data = parseOrder(req.body); } catch (err) { return sendValidation(res, err); }
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    // Sorted locks minimize lock-order inversions between simultaneous orders.
    const sorted = [...data.items].sort((a, b) => a.productId - b.productId);
    const prepared = [];
    let totalCents = 0;
    for (const item of sorted) {
      const [rows] = await con.execute('SELECT id, name, price, stock_qty FROM products WHERE id = ? FOR UPDATE', [item.productId]);
      if (!rows.length) { const e = new Error('A selected product no longer exists'); e.httpStatus = 404; throw e; }
      const p = rows[0];
      if (p.stock_qty < item.quantity) { const e = new Error(`Insufficient stock for ${p.name}`); e.httpStatus = 409; throw e; }
      const cents = Math.round(Number(p.price) * 100);
      totalCents += cents * item.quantity;
      prepared.push({ ...item, name: p.name, cents });
    }
    const code = orderCode();
    const [result] = await con.execute("INSERT INTO orders (order_code, customer_name, customer_email, status, total_amount) VALUES (?, ?, ?, 'pending', ?)",
      [code, data.customerName, data.customerEmail || null, (totalCents / 100).toFixed(2)]);
    for (const item of prepared) {
      await con.execute('INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
        [result.insertId, item.productId, item.name, item.quantity, (item.cents / 100).toFixed(2)]);
      await con.execute('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?', [item.quantity, item.productId]);
    }
    await con.execute('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)', [result.insertId, 'pending', 'Order created']);
    await con.commit();
    ordersCreated.inc();
    return res.status(201).json({ id: result.insertId, orderCode: code, status: 'pending', total: totalCents / 100 });
  } catch (err) { await con.rollback(); if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message }); throw err; }
  finally { con.release(); }
}));

app.patch('/api/orders/:id/status', asyncRoute(async (req, res) => {
  const id = positiveInt(req.params.id);
  const target = String(req.body?.status ?? '');
  if (!id || !ORDER_STATUSES.includes(target)) return res.status(400).json({ error: 'Valid order ID and status are required' });
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    const [rows] = await con.execute('SELECT status FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) { await con.rollback(); return res.status(404).json({ error: 'Order not found' }); }
    if (!canTransition(rows[0].status, target)) { await con.rollback(); return res.status(409).json({ error: `Cannot change ${rows[0].status} to ${target}` }); }
    if (target === 'cancelled') {
      // Restore inventory atomically when a not-yet-shipped order is cancelled.
      const [items] = await con.execute('SELECT product_id AS productId, quantity FROM order_items WHERE order_id = ? ORDER BY product_id ASC', [id]);
      for (const item of items) await con.execute('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?', [item.quantity, item.productId]);
    }
    await con.execute('UPDATE orders SET status = ? WHERE id = ?', [target, id]);
    await con.execute('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)', [id, target, `Status updated to ${target}`]);
    await con.commit();
    orderTransitions.inc({ status: target });
    return res.json({ id, status: target });
  } catch (err) { await con.rollback(); throw err; } finally { con.release(); }
}));

app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((error, _req, res, _next) => {
  const forbidden = String(error.message).includes('CORS origin denied');
  console.error(JSON.stringify({ time: new Date().toISOString(), level: 'error', error: error.code || 'INTERNAL', message: error.message }));
  res.status(forbidden ? 403 : 500).json({ error: forbidden ? 'Forbidden origin' : 'Unexpected server error' });
});

const port = Number(process.env.PORT || 8080);
// Keep the HTTP liveness endpoint available when MySQL is down; /health/ready
// reports 503 until the database can be reached. Log state changes for operators.
const databaseMonitor = createDatabaseMonitor({ probe: dbReady });
const server = app.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({
    time: new Date().toISOString(), level: 'info', message: 'OpsFlow API listening',
    port, version: process.env.APP_VERSION || '1.0.0', environment: process.env.APP_ENV || 'DEV',
  }));
  databaseMonitor.start();
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  console.log(JSON.stringify({ level: 'info', message: 'Shutting down OpsFlow API', signal }));
  databaseMonitor.stop();
  server.close(async () => { await pool.end(); process.exit(0); });
});
