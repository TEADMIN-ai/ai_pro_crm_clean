# Roar Cars Inventory Connector

## Current Source

The connector uses the existing Roar Cars inventory ingestion path:

- Public source URL: `https://roarcarssa.com/inventory.html`
- Optional override: `ROAR_CARS_INVENTORY_BASE_URL`
- Optional token marker: `ROAR_CARS_API_TOKEN`
- Optional source type marker: `ROAR_CARS_CONNECTOR_SOURCE_TYPE`

No credentials are hard-coded. Raw source payloads are not returned to frontend APIs.

## Vercel Connect Readiness

Vercel Connect is not currently installed as an SDK/API dependency in this repository. The integration boundary is `src/lib/vehicle-finance/inventory/roarCarsConnector.ts`.

When Vercel-managed tokens are available, token retrieval should plug in before the live source fetch and replace env-token/public-source access inside the connector service. Set `ROAR_CARS_CONNECTOR_SOURCE_TYPE=VERCEL_CONNECT` only when the deployment has a real managed connector path.

Required future connector permissions:

- Inventory/listing read
- Vehicle media read
- Listing URL read
- Webhook read if webhook sync is enabled

## Firestore Collections

- `vehicleFinanceConnectors`
- `vehicleInventorySyncRuns`
- `vehicleInventoryHealth`

The existing durable vehicle records remain in `inventory`, and the existing durable sync state remains in `inventorySyncState`.

## Operations

- `GET /api/vehicle-finance/inventory/connector/config`
- `GET /api/vehicle-finance/inventory/connector/health`
- `POST /api/vehicle-finance/inventory/connector/validate`
- `POST /api/vehicle-finance/inventory/connector/sync`

Connector mutation endpoints require Vehicle Finance staff-level authorization.
