# Vehicle Finance / Roar Cars Guide

## Supported Workflows

- Vehicle Finance dashboard.
- Applications, customers, reports, certificates.
- Roar inventory and listings.
- Vehicle detail pages.
- Inventory connector health, sync, validate, retry.

## Connector Notes

The connector currently uses the existing Roar inventory ingestion path. Vercel Connect token retrieval is not installed in the repo and must plug into `src/lib/vehicle-finance/inventory/roarCarsConnector.ts` later.

## QA Checks

- Log in as ROAR_CARS_STAFF.
- Open inventory and listing pages.
- Open internal vehicle detail page.
- Confirm external listing is secondary.
- Confirm connector errors are readable and raw API snapshots are not exposed.

