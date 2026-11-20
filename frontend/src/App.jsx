import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, Package, Activity, Search, Bell,
  Plus, ArrowUpRight, TrendingUp, TrendingDown, ChevronDown, ChevronRight,
  RefreshCcw, X, CheckCircle2, AlertTriangle, Boxes, Truck, Clock3,
  CircleDollarSign, Database, Server, HeartPulse, TerminalSquare, Copy,
  Layers3, LoaderCircle, Menu, ShieldCheck, PackagePlus, ChartNoAxesColumnIncreasing,
  ArrowRight, LifeBuoy, ExternalLink, CircleAlert, Zap, Check, RotateCcw,
} from 'lucide-react';

const STATUS_LABELS = { pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const STATUS_NEXT = { pending: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'system', label: 'System health', icon: Activity },
];
const MONEY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fmtDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const fmtTime = (value) => value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

async function request(path, opts) {
  let response;
  try { response = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) } }); }
  catch { throw new Error('Cannot reach API. Check that the backend and database are running.'); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function Logo() {
  return <div className="brand">
    <div className="brand-glyph"><Layers3 size={22} strokeWidth={2.6}/></div>
    <div><div className="brand-name">opsflow<span>.</span></div><div className="brand-sub">OPERATIONS HUB</div></div>
  </div>;
}
function Badge({ status, children }) { return <span className={`badge badge-${status || 'neutral'}`}><span className="badge-dot"/>{children ?? STATUS_LABELS[status] ?? status}</span>; }
function Panel({ title, subtitle, icon: Icon, action, children, className = '' }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div className="panel-heading">{Icon && <span className="panel-icon"><Icon size={17}/></span>}<div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div></div>{action}</div>{children}</section>;
}
function ErrorBanner({ message, retry }) { return <div className="error-banner"><CircleAlert size={19}/><div><strong>Unable to load data</strong><p>{message}</p></div><button className="btn btn-light btn-sm" onClick={retry}>Retry</button></div>; }
function Empty({ icon: Icon = Package, title = 'Nothing to show yet', description }) { return <div className="empty"><Icon size={27}/><strong>{title}</strong>{description && <p>{description}</p>}</div>; }
function Spinner() { return <div className="loading"><LoaderCircle size={27} className="spin"/><span>Loading your workspace…</span></div>; }
function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => { const handler = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className="modal"><div className="modal-header"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}</div></div>;
}

function Kpi({ label, value, helper, icon: Icon, tone, change }) { return <div className="kpi"><div className="kpi-upper"><span>{label}</span><span className={`kpi-icon kpi-${tone}`}><Icon size={20}/></span></div><div className="kpi-value">{value}</div><div className="kpi-footer">{change && <span className="up-small"><TrendingUp size={13}/>{change}</span>}<span>{helper}</span></div></div>; }
function OrdersChart({ rows = [] }) {
  const days = useMemo(() => {
    const values = new Map(rows.map(x => [x.day, Number(x.count)]));
    return Array.from({length:7}, (_, i) => {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (6 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { key, day: d.toLocaleDateString('en-US', { weekday: 'short' }), count: values.get(key) ?? 0 };
    });
  }, [rows]);
  const max = Math.max(3, ...days.map(x => x.count));
  return <div className="chart-body"><div className="chart-guide"><span>{max}</span><span>{Math.ceil(max / 2)}</span><span>0</span></div><div className="chart-bars">{days.map((x, i) => <div className="chart-column" key={x.key}><div className="bar-track"><div className={`bar ${i === 6 ? 'bar-active' : ''}`} style={{height: `${Math.max(3, x.count / max * 100)}%`}} title={`${x.count} orders on ${x.key}`}/></div><span>{x.day}</span></div>)}</div></div>;
}
function OrdersTable({ orders = [], onAdvance, compact = false, changing }) {
  if (!orders.length) return <Empty icon={ShoppingBag} title="No orders found" description="Try another filter or create an order."/>;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>ORDER ID</th><th>CUSTOMER</th>{!compact && <th>ITEMS</th>}<th>AMOUNT</th><th>STATUS</th>{!compact && <th>DATE</th>}<th/></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td className="mono strong">{order.orderCode}</td><td><div className="name-cell"><div className="mini-avatar">{order.customerName?.charAt(0) || '?'}</div><strong>{order.customerName}</strong></div></td>{!compact && <td>{order.itemCount ?? '—'}</td>}<td className="strong">{MONEY.format(order.total)}</td><td><Badge status={order.status}/></td>{!compact && <td className="muted">{fmtDate(order.createdAt)}</td>}<td>{!compact && STATUS_NEXT[order.status]?.filter(s => s !== 'cancelled').length ? <button className="link-btn" disabled={changing === order.id} onClick={() => onAdvance(order)}>{changing === order.id ? 'Saving…' : 'Advance'} <ChevronRight size={14}/></button> : <ChevronRight size={14} className="quiet-icon"/>}</td></tr>)}</tbody></table></div>;
}

function Overview({ dashboard, orders, products, setPage, openOrder, refresh, changing, advance }) {
  const total = dashboard?.orders ?? 0;
  const active = (dashboard?.statuses?.pending ?? 0) + (dashboard?.statuses?.processing ?? 0) + (dashboard?.statuses?.shipped ?? 0);
  return <>
    <div className="greeting"><div><span className="eyebrow">YOUR OPERATIONS AT A GLANCE</span><h1>Good to see you <span className="wave">✳</span></h1><p>Here's what's happening across your store today.</p></div><button className="btn btn-primary" onClick={openOrder}><Plus size={18}/> New order</button></div>
    <div className="kpi-grid"><Kpi label="Total revenue" value={MONEY.format(dashboard?.revenue || 0)} icon={CircleDollarSign} tone="green" helper="Excluding cancelled orders"/><Kpi label="Total orders" value={total.toLocaleString()} icon={ShoppingBag} tone="blue" helper="All time"/><Kpi label="Orders in progress" value={active.toLocaleString()} icon={Truck} tone="orange" helper="Pending, processing & shipped"/><Kpi label="Low stock items" value={dashboard?.lowStockCount || 0} icon={AlertTriangle} tone="rose" helper="At or below reorder level"/></div>
    <div className="content-grid"><Panel title="Order activity" subtitle="Orders placed over the last 7 days" icon={ChartNoAxesColumnIncreasing} action={<button className="text-action" onClick={refresh}><RefreshCcw size={15}/> Refresh</button>}><OrdersChart rows={dashboard?.daily || []}/></Panel>
    <Panel title="Order pipeline" subtitle="Where your orders stand" icon={Boxes}><div className="pipeline-list">{['pending', 'processing', 'shipped', 'delivered'].map(status => { const count = dashboard?.statuses?.[status] || 0; const percent = total ? count / total * 100 : 0; return <div className="pipeline-item" key={status}><div className="pipeline-row"><span className="pipeline-name"><span className={`pipeline-indicator ${status}`}/>{STATUS_LABELS[status]}</span><strong>{count}</strong></div><div className="progress-bg"><div className={`progress-fill ${status}`} style={{width:`${percent}%`}}/></div></div>; })}</div><div className="pipeline-note"><TrendingUp size={16}/> Live counts from the MySQL database</div></Panel></div>
    <div className="content-grid bottom-grid"><Panel title="Recent orders" subtitle="Latest customer purchases" icon={ShoppingBag} action={<button className="text-action" onClick={() => setPage('orders')}>View all <ArrowUpRight size={16}/></button>}><OrdersTable orders={(dashboard?.recent || []).slice(0, 5)} compact changing={changing} onAdvance={advance}/></Panel><Panel title="Needs attention" subtitle="Inventory running low" icon={AlertTriangle} action={<button className="text-action" onClick={() => setPage('inventory')}>Inventory <ArrowUpRight size={16}/></button>}><div className="attention-list">{(dashboard?.lowStock || []).length ? dashboard.lowStock.map(p => <div className="attention-item" key={p.id}><div className="product-symbol"><Package size={18}/></div><div><strong>{p.name}</strong><span>{p.sku}</span></div><span className="stock-number">{p.stock} left</span></div>) : <Empty title="Inventory looks healthy"/>}</div></Panel></div>
  </>;
}

function OrdersView({ orders, openOrder, onAdvance, changing }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const shown = orders.filter(o => (filter === 'all' || o.status === filter) && [o.orderCode, o.customerName].some(v => v?.toLowerCase().includes(search.toLowerCase())));
  return <><div className="page-heading"><div><span className="eyebrow">CUSTOMER OPERATIONS</span><h1>Orders</h1><p>Manage customer orders and track fulfillment progress.</p></div><button className="btn btn-primary" onClick={openOrder}><Plus size={17}/> Create order</button></div><Panel title="All orders" subtitle={`${orders.length} total orders`} icon={ShoppingBag}><div className="filter-bar"><div className="search-box"><Search size={17}/><input aria-label="Search orders" placeholder="Search orders or customers…" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="tab-filters">{['all', 'pending', 'processing', 'shipped', 'delivered'].map(k => <button key={k} className={filter === k ? 'tab-filter active' : 'tab-filter'} onClick={() => setFilter(k)}>{k === 'all' ? 'All' : STATUS_LABELS[k]}</button>)}</div></div><OrdersTable orders={shown} onAdvance={onAdvance} changing={changing}/></Panel></>;
}

function InventoryView({ products, openProduct, openRestock }) {
  const [search, setSearch] = useState(''); const [lowOnly, setLowOnly] = useState(false);
  const shown = products.filter(p => (!lowOnly || p.stock <= p.reorderLevel) && [p.name, p.sku, p.category].some(v => v?.toLowerCase().includes(search.toLowerCase())));
  return <><div className="page-heading"><div><span className="eyebrow">PRODUCT OPERATIONS</span><h1>Inventory</h1><p>Manage your catalog, stock levels, and replenishment.</p></div><button className="btn btn-primary" onClick={openProduct}><Plus size={17}/> Add product</button></div><Panel title="Product catalog" subtitle={`${products.length} products available`} icon={Package}><div className="filter-bar"><div className="search-box"><Search size={17}/><input aria-label="Search products" placeholder="Search products or SKU…" value={search} onChange={e => setSearch(e.target.value)}/></div><button className={`pill-toggle ${lowOnly ? 'selected' : ''}`} onClick={() => setLowOnly(v => !v)}><AlertTriangle size={15}/> Low stock only</button></div>{shown.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>PRICE</th><th>IN STOCK</th><th/></tr></thead><tbody>{shown.map(p => <tr key={p.id}><td><div className="product-cell"><div className="product-icon"><Package size={18}/></div><strong>{p.name}</strong></div></td><td className="mono">{p.sku}</td><td className="muted">{p.category}</td><td className="strong">{MONEY.format(p.price)}</td><td><span className={`stock-pill ${p.stock <= p.reorderLevel ? 'low' : ''}`}>{p.stock <= p.reorderLevel ? <AlertTriangle size={12}/> : <CheckCircle2 size={12}/>} {p.stock} units</span></td><td><button className="link-btn" onClick={() => openRestock(p)}>Restock <ChevronRight size={14}/></button></td></tr>)}</tbody></table></div> : <Empty title="No matching products" description="Try changing your search or filter."/>}</Panel></>;
}
function SystemView({ version, health, reload }) {
  const live = health?.live?.status === 'alive'; const ready = health?.ready?.status === 'ready';
  const metricsUrl = new URL('/metrics', window.location.origin).toString();
  const copyMetrics = async () => { try { await navigator.clipboard.writeText(metricsUrl); } catch { /* Clipboard permissions vary by browser. */ } };
  return <><div className="page-heading"><div><span className="eyebrow">DEVOPS OBSERVABILITY</span><h1>System health</h1><p>Live service checks and deployment metadata for OpsFlow.</p></div><button className="btn btn-outline" onClick={reload}><RefreshCcw size={16}/> Recheck</button></div><div className="health-grid"><div className="health-card"><div className="health-icon green"><HeartPulse size={22}/></div><h3>Backend API</h3><p>Process liveness check</p><Badge status={live ? 'delivered' : 'cancelled'}>{live ? 'Healthy' : 'Unavailable'}</Badge></div><div className="health-card"><div className="health-icon blue"><Database size={22}/></div><h3>MySQL database</h3><p>Readiness & connectivity</p><Badge status={ready ? 'delivered' : 'cancelled'}>{ready ? 'Connected' : 'Unavailable'}</Badge></div><div className="health-card"><div className="health-icon purple"><Server size={22}/></div><h3>Release info</h3><p>API version and environment</p><span className="version-pill">v{version?.version || '—'} · {version?.environment || '—'}</span></div></div><div className="system-grid"><Panel title="Operational endpoints" subtitle="Probes for Kubernetes and Prometheus" icon={TerminalSquare}><div className="endpoint-list">{[['Liveness','/health/live','Used by Kubernetes liveness probes'],['Readiness','/health/ready','Checks MySQL availability'],['Metrics','/metrics','Prometheus scrape endpoint'],['Version','/api/version','Release identity & environment']].map(x => <div className="endpoint-row" key={x[1]}><div><strong>{x[0]}</strong><span>{x[2]}</span></div><code>{x[1]}</code></div>)}</div></Panel><Panel title="Deployment checklist" subtitle="What your DevOps team will implement" icon={ShieldCheck}><div className="checklist">{['Docker images for frontend and backend','Kubernetes workloads + MySQL persistence','Jenkins build, test and security scans','Terraform + AWS K3s production cluster','Prometheus/Grafana monitoring integration','CloudWatch metrics and selected logs'].map(x => <div key={x}><span><Check size={14}/></span>{x}</div>)}</div><div className="note-box"><LifeBuoy size={18}/> This starter includes application code only. Infrastructure and deployment are trainee responsibilities.</div></Panel></div><div className="metrics-tip"><div><Activity size={20}/><span><strong>Prometheus metrics</strong><small>Ready for your centralized monitoring server</small></span></div><button className="btn btn-outline btn-sm" onClick={copyMetrics}><Copy size={14}/> Copy URL</button></div></>;
}

function NewOrderModal({ products, close, submit, busy }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [productId, setProductId] = useState(String(products.find(p => p.stock > 0)?.id || '')); const [quantity, setQuantity] = useState(1);
  const selected = products.find(p => String(p.id) === productId);
  const total = (selected?.price || 0) * Number(quantity);
  return <Modal title="Create new order" subtitle="Add an order to your live MySQL database." onClose={close}><form onSubmit={e => { e.preventDefault(); submit('/api/orders', { customerName: name, customerEmail: email, items: [{ productId: Number(productId), quantity: Number(quantity) }] }, 'Order created successfully'); }} className="modal-form"><label>Customer name <input required minLength={2} maxLength={100} placeholder="e.g. Jamie Parker" value={name} onChange={e => setName(e.target.value)}/></label><label>Email address <span className="optional">Optional</span><input type="email" placeholder="jamie@example.com" value={email} onChange={e => setEmail(e.target.value)}/></label><div className="form-2col"><label>Product<select required value={productId} onChange={e => setProductId(e.target.value)}>{products.filter(p => p.stock > 0).map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock} available)</option>)}</select></label><label>Quantity<input required type="number" min={1} max={Math.min(20,selected?.stock || 20)} value={quantity} onChange={e => setQuantity(e.target.value)}/></label></div><div className="modal-total"><span>Order total</span><strong>{MONEY.format(total)}</strong></div><div className="modal-actions"><button className="btn btn-outline" type="button" onClick={close}>Cancel</button><button className="btn btn-primary" disabled={busy || !productId || !selected?.stock} type="submit">{busy ? <LoaderCircle className="spin" size={16}/> : <Plus size={16}/>} Create order</button></div></form></Modal>;
}
function NewProductModal({ close, submit, busy }) {
  const [form, setForm] = useState({ name: '', sku: '', category: 'Accessories', price: '', stock: '20', reorderLevel: '10' });
  const edit = (k,v) => setForm(f => ({ ...f, [k]: v }));
  return <Modal title="Add a product" subtitle="Create a new item in the live product catalog." onClose={close}><form className="modal-form" onSubmit={e => { e.preventDefault(); submit('/api/products', { ...form, price: Number(form.price), stock: Number(form.stock), reorderLevel: Number(form.reorderLevel) }, 'Product added successfully'); }}><label>Product name<input required minLength={2} maxLength={100} placeholder="e.g. USB-C Travel Adapter" value={form.name} onChange={e => edit('name',e.target.value)}/></label><div className="form-2col"><label>SKU<input required minLength={3} placeholder="TEC-ADP-013" value={form.sku} onChange={e => edit('sku',e.target.value)}/></label><label>Category<input required value={form.category} onChange={e => edit('category',e.target.value)}/></label></div><div className="form-2col"><label>Price (USD)<input required type="number" min="0.01" step="0.01" value={form.price} onChange={e => edit('price',e.target.value)}/></label><label>Initial stock<input required type="number" min="0" value={form.stock} onChange={e => edit('stock',e.target.value)}/></label></div><label>Low-stock threshold<input required type="number" min="0" value={form.reorderLevel} onChange={e => edit('reorderLevel',e.target.value)}/></label><div className="modal-actions"><button className="btn btn-outline" type="button" onClick={close}>Cancel</button><button className="btn btn-primary" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={16}/> : <Plus size={16}/>} Add product</button></div></form></Modal>;
}
function RestockModal({ product, close, submit, busy }) {
  const [quantity, setQuantity] = useState(10);
  return <Modal title="Restock inventory" subtitle={`Add stock to ${product.name}`} onClose={close}><form className="modal-form" onSubmit={e => { e.preventDefault(); submit(`/api/products/${product.id}/restock`, {quantity: Number(quantity)}, 'Inventory updated successfully', 'PATCH'); }}><div className="restock-current"><span>Current stock</span><strong>{product.stock} units</strong></div><label>Units to add<input required type="number" min="1" max="500" value={quantity} onChange={e => setQuantity(e.target.value)}/></label><div className="modal-total"><span>New stock</span><strong>{product.stock + Number(quantity || 0)} units</strong></div><div className="modal-actions"><button className="btn btn-outline" type="button" onClick={close}>Cancel</button><button className="btn btn-primary" disabled={busy} type="submit"><PackagePlus size={16}/> Restock</button></div></form></Modal>;
}

export default function App() {
  const [page, setPage] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [version, setVersion] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(null);
  const [toast, setToast] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [d,o,p,v] = await Promise.all([request('/api/dashboard'), request('/api/orders'), request('/api/products'), request('/api/version')]);
      setDashboard(d); setOrders(o.orders); setProducts(p.products); setVersion(v); setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  const reloadHealth = useCallback(async () => {
    const [l,r] = await Promise.allSettled([request('/health/live'), request('/health/ready')]);
    setHealth({ live: l.status === 'fulfilled' ? l.value : null, ready: r.status === 'fulfilled' ? r.value : null });
  }, []);
  useEffect(() => { refresh(true); reloadHealth(); }, [refresh, reloadHealth]);
  useEffect(() => { if (page === 'system') reloadHealth(); }, [page, reloadHealth]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  async function submit(path, body, success, method = 'POST') {
    setBusy(true);
    try { await request(path, { method, body: JSON.stringify(body) }); setModal(null); setToast(success); await refresh(); }
    catch (err) { setToast(`Error: ${err.message}`); }
    finally { setBusy(false); }
  }
  async function advance(order) {
    const next = (STATUS_NEXT[order.status] || []).find(x => x !== 'cancelled');
    if (!next) return;
    setChanging(order.id);
    try { await request(`/api/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({status: next}) }); setToast(`Order moved to ${STATUS_LABELS[next]}`); await refresh(); }
    catch (err) { setToast(`Error: ${err.message}`); }
    finally { setChanging(null); }
  }
  const navigate = (id) => { setPage(id); setSidebarOpen(false); };
  const title = NAV_ITEMS.find(n => n.id === page)?.label ?? 'Overview';
  return <div className="app-shell">
    {sidebarOpen && <button aria-label="Close navigation" className="mobile-shade" onClick={() => setSidebarOpen(false)}/>}
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}><Logo/><div className="nav-section-label">WORKSPACE</div><nav className="nav-items">{NAV_ITEMS.map(({id,label,icon:Icon}) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)}><Icon size={19} strokeWidth={1.9}/><span>{label}</span>{page === id && <span className="active-mark"/>}</button>)}</nav><div className="sidebar-spacer"/><div className="sidebar-help"><div className="sidebar-help-icon"><Zap size={17}/></div><strong>Built for delivery.</strong><p>Your operations, organized in one place.</p><span>DEVOPS TRAINING EDITION</span></div><div className="sidebar-footer"><div className="side-avatar">BJ</div><div><strong>BJIT Academy</strong><span>YSD Batch 6</span></div><ChevronDown size={16}/></div></aside>
    <div className="main-area"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={20}/></button><span>Workspace</span><ChevronRight size={15}/><strong>{title}</strong></div><div className="topbar-right"><div className="env-label"><span className="live-dot"/>{version?.environment || 'DEV'} ENVIRONMENT</div><button className="icon-btn top-refresh" onClick={() => { refresh(); reloadHealth(); }} title="Refresh data"><RefreshCcw size={17}/></button><div className="profile-bubble">BA</div></div></header>
      <main className="main-content">{error && <ErrorBanner message={error} retry={() => refresh(true)}/>} {loading && !dashboard ? <Spinner/> : <>{page === 'overview' && <Overview dashboard={dashboard} orders={orders} products={products} setPage={navigate} openOrder={() => setModal({type: 'order'})} refresh={() => refresh()} changing={changing} advance={advance}/>} {page === 'orders' && <OrdersView orders={orders} openOrder={() => setModal({type:'order'})} onAdvance={advance} changing={changing}/>} {page === 'inventory' && <InventoryView products={products} openProduct={() => setModal({type:'product'})} openRestock={p => setModal({type:'restock', product:p})}/>} {page === 'system' && <SystemView version={version} health={health} reload={reloadHealth}/>}</>}
        <footer className="main-footer"><span>© 2026 OpsFlow · BJIT Academy training application</span><span>Frontend · API · MySQL</span></footer>
      </main>
    </div>
    {modal?.type === 'order' && <NewOrderModal products={products} close={() => setModal(null)} submit={submit} busy={busy}/>}
    {modal?.type === 'product' && <NewProductModal close={() => setModal(null)} submit={submit} busy={busy}/>}
    {modal?.type === 'restock' && <RestockModal product={modal.product} close={() => setModal(null)} submit={submit} busy={busy}/>}
    {toast && <div role="status" className={`toast ${toast.startsWith('Error:') ? 'toast-error' : ''}`}><CheckCircle2 size={17}/>{toast}<button onClick={() => setToast('')} aria-label="Dismiss toast"><X size={15}/></button></div>}
  </div>;
}
