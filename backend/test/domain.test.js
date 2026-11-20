import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedNextStatuses, canTransition, parseOrder, parseProduct, positiveInt, queryLimit, orderCode } from '../src/domain.js';

test('order status transitions are forward-only', () => {
  assert.equal(canTransition('pending', 'processing'), true);
  assert.equal(canTransition('processing', 'shipped'), true);
  assert.equal(canTransition('shipped', 'delivered'), true);
  assert.equal(canTransition('delivered', 'pending'), false);
  assert.deepEqual(allowedNextStatuses('cancelled'), []);
});
test('order validation accepts a normal purchase', () => {
  const order = parseOrder({ customerName: 'Alex Tan', customerEmail: 'alex@example.com', items: [{ productId: 7, quantity: 2 }] });
  assert.equal(order.items.length, 1);
});
test('order validation rejects duplicate product IDs and invalid quantities', () => {
  assert.throws(() => parseOrder({ customerName: 'Alex Tan', items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 1 }] }), /Duplicate/);
  assert.throws(() => parseOrder({ customerName: 'Alex Tan', items: [{ productId: 1, quantity: 0 }] }), /quantity/);
});
test('product validation rejects unsafe values', () => {
  assert.equal(parseProduct({ name: 'Desk Lamp', sku: 'LAM-1', category: 'Lighting', price: 15.99, stock: 5 }).sku, 'LAM-1');
  assert.throws(() => parseProduct({ name: 'Lamp', sku: 'a', category: 'Lighting', price: -2, stock: 2 }), /SKU/);
});
test('pagination limits stay bounded', () => {
  assert.equal(queryLimit('999999'), 40);
  assert.equal(queryLimit('20'), 20);
  assert.equal(positiveInt('-2'), null);
});
test('generated order codes are distinct and formatted', () => {
  const a = orderCode(); const b = orderCode();
  assert.match(a, /^OF-[A-Z0-9]+-[A-F0-9]{6}$/);
  assert.notEqual(a, b);
});
