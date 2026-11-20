import client from 'prom-client';

export const registry = new client.Registry();
registry.setDefaultLabels({ service: 'opsflow-api', environment: process.env.APP_ENV || 'DEV' });
client.collectDefaultMetrics({ register: registry, prefix: 'opsflow_process_' });

const requests = new client.Counter({
  name: 'opsflow_http_requests_total',
  help: 'Total API HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});
const duration = new client.Histogram({
  name: 'opsflow_http_request_duration_seconds',
  help: 'API request duration',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.03, 0.1, 0.3, 1, 2, 5],
  registers: [registry],
});
export const ordersCreated = new client.Counter({
  name: 'opsflow_orders_created_total',
  help: 'Total orders created through the API',
  registers: [registry],
});
export const orderTransitions = new client.Counter({
  name: 'opsflow_order_status_changes_total',
  help: 'Order transitions by target status',
  labelNames: ['status'],
  registers: [registry],
});

export function metricsMiddleware(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path === '/metrics') return;
    const route = req.route?.path ?? 'unmatched';
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    requests.inc(labels);
    duration.observe(labels, Number(process.hrtime.bigint() - started) / 1e9);
  });
  next();
}
