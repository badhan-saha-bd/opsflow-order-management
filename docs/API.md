# OpsFlow REST API reference

All JSON APIs are served by Express on port `8080` by default. Requests should use `Content-Type: application/json`.

## Health, release and metrics

| Method | URL | Description |
|---|---|---|
| GET | `/health/live` | Process liveness. 200 if the HTTP process responds. |
| GET | `/health/ready` | DB readiness. Returns 503 if MySQL is unavailable. |
| GET | `/api/version` | `APP_VERSION` and `APP_ENV` release details. |
| GET | `/metrics` | Prometheus-formatted process, HTTP and business metrics. |

**Prometheus metrics:** `opsflow_http_requests_total`, `opsflow_http_request_duration_seconds`, `opsflow_orders_created_total`, `opsflow_order_status_changes_total`, `opsflow_process_*`.

## Dashboard and products

| Method | URL | Description |
|---|---|---|
| GET | `/api/dashboard` | Revenue, counts, recent orders, low stock and daily activity. |
| GET | `/api/products?q=desk` | Search products (also supports `lowStock=true` and `limit`). |
| POST | `/api/products` | Create product. |
| PATCH | `/api/products/:id/restock` | Add available stock. |

Example product creation:

```json
{
  "sku": "TEC-ADP-013",
  "name": "USB-C Travel Adapter",
  "category": "Electronics",
  "price": 34.99,
  "stock": 20,
  "reorderLevel": 5
}
```

Example restock request:

```json
{ "quantity": 10 }
```

## Orders

| Method | URL | Description |
|---|---|---|
| GET | `/api/orders` | List orders; supports `status`, `q` and `limit`. |
| GET | `/api/orders/:id` | Detail, items, status history and allowed next statuses. |
| POST | `/api/orders` | Create an order; MySQL transaction adjusts stock. |
| PATCH | `/api/orders/:id/status` | Advance through the valid lifecycle. |

Example order creation (replace product ID with a real ID from GET `/api/products`):

```json
{
  "customerName": "Taylor Morgan",
  "customerEmail": "taylor@example.test",
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 3, "quantity": 1 }
  ]
}
```

Example status update:

```json
{ "status": "processing" }
```

Allowed state transitions:

```text
pending → processing → shipped → delivered
   └───────────────→ cancelled (also from processing)
```

Attempts to skip stages return HTTP `409`. Insufficient stock returns `409`. Bad input returns `400`.

## Manual smoke test

1. `GET /health/ready` — should show the DB connected.
2. `GET /api/products` — should show seeded inventory.
3. `POST /api/orders` — should return an order code.
4. `GET /api/products` — stock should be reduced for purchased items.
5. `PATCH /api/orders/:id/status` — advance the order to processing.
6. Restart the backend — the order should still exist in MySQL.
7. `GET /metrics` — look for `opsflow_http_requests_total` and `opsflow_orders_created_total`.

