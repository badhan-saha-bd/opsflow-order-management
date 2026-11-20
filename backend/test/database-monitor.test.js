import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabaseMonitor } from '../src/database-monitor.js';

test('logs a successful first connection once, without spam', async () => {
  const info = [];
  const errors = [];
  const monitor = createDatabaseMonitor({
    probe: async () => {},
    logger: { log: v => info.push(JSON.parse(v)), error: v => errors.push(JSON.parse(v)) },
  });
  await monitor.checkOnce();
  await monitor.checkOnce();
  assert.equal(info.length, 1);
  assert.equal(errors.length, 0);
  assert.equal(info[0].status, 'connected');
  assert.match(info[0].message, /connected successfully/);
});

test('logs failed connection and recovery once each, with no leaked error message', async () => {
  const info = [];
  const errors = [];
  let available = false;
  const monitor = createDatabaseMonitor({
    probe: async () => {
      if (!available) {
        const error = new Error('SENSITIVE PASSWORD must never be logged');
        error.code = 'ECONNREFUSED';
        throw error;
      }
    },
    logger: { log: v => info.push(JSON.parse(v)), error: v => errors.push(JSON.parse(v)) },
  });
  await monitor.checkOnce();
  await monitor.checkOnce();
  available = true;
  await monitor.checkOnce();
  assert.equal(errors.length, 1);
  assert.equal(errors[0].status, 'failed');
  assert.equal(errors[0].errorCode, 'ECONNREFUSED');
  assert.equal(info.length, 1);
  assert.match(info[0].message, /connection restored/);
  assert.ok(!JSON.stringify([...info, ...errors]).includes('SENSITIVE'));
});

test('stopping monitor prevents further manual probes', async () => {
  let n = 0;
  const monitor = createDatabaseMonitor({ probe: async () => n++, logger: { log: () => {}, error: () => {} } });
  await monitor.checkOnce();
  monitor.stop();
  await monitor.checkOnce();
  assert.equal(n, 1);
});
