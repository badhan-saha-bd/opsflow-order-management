import { randomBytes } from 'node:crypto';

export const ORDER_STATUSES = Object.freeze(['pending', 'processing', 'shipped', 'delivered', 'cancelled']);
const ALLOWED = Object.freeze({
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
});

export function allowedNextStatuses(current) { return ALLOWED[current] ?? []; }
export function canTransition(current, next) { return (ALLOWED[current] ?? []).includes(next); }
export function orderCode() { return `OF-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`; }
export function positiveInt(value, max = 1000000000) {
  const number = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= max ? number : null;
}
export function queryLimit(value, fallback = 40, maximum = 100) {
  if (value === undefined) return fallback;
  return positiveInt(value, maximum) ?? fallback;
}
export function parseProduct(body) {
  const name = String(body?.name ?? '').trim();
  const sku = String(body?.sku ?? '').trim().toUpperCase();
  const category = String(body?.category ?? 'General').trim();
  const price = Number(body?.price);
  const stock = Number(body?.stock);
  const reorderLevel = Number(body?.reorderLevel ?? 10);
  if (name.length < 2 || name.length > 100) throw new Error('Product name must have 2–100 characters');
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(sku)) throw new Error('SKU must have 3–32 letters, numbers, hyphens or underscores');
  if (category.length < 2 || category.length > 50) throw new Error('Category must have 2–50 characters');
  if (!Number.isFinite(price) || price <= 0 || price > 100000 || Math.abs(Math.round(price * 100) - price * 100) > 1e-7) throw new Error('Price must be a positive value with at most 2 decimal places');
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) throw new Error('Stock must be an integer between 0 and 100000');
  if (!Number.isInteger(reorderLevel) || reorderLevel < 0 || reorderLevel > 100000) throw new Error('Reorder level must be an integer between 0 and 100000');
  return { name, sku, category, price, stock, reorderLevel };
}
export function parseOrder(body) {
  const customerName = String(body?.customerName ?? '').trim();
  const customerEmail = String(body?.customerEmail ?? '').trim();
  if (customerName.length < 2 || customerName.length > 100) throw new Error('Customer name must have 2–100 characters');
  if (customerEmail && (customerEmail.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))) throw new Error('Enter a valid customer email');
  if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 8) throw new Error('Orders must have 1–8 items');
  const unique = new Set();
  const items = body.items.map(item => {
    const productId = positiveInt(item?.productId);
    const quantity = positiveInt(item?.quantity, 20);
    if (!productId || !quantity) throw new Error('Each item must have a valid product and quantity (1–20)');
    if (unique.has(productId)) throw new Error('Duplicate products are not allowed in an order');
    unique.add(productId);
    return { productId, quantity };
  });
  return { customerName, customerEmail, items };
}
