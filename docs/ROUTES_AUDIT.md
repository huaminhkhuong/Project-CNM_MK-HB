# Backend routes audit

## Authoritative API entrypoint

The active API router is `services/api/src/routes/index.ts`.

## Mounted TypeScript routers

- `/auth` -> `modules/auth/auth.route.ts`
- `/users` -> `modules/users/users.route.ts`
- `/cart` -> `modules/cart/cart.route.ts`
- `/orders` -> `modules/orders/orders.route.ts`
- `/pc-builder` -> `modules/pc-builder/pc-builder.route.ts`
- `/tickets` -> `modules/tickets/tickets.route.ts`
- `/ai-advisor` -> `modules/ai-advisor/ai-advisor.route.ts`
- `/warranties` -> `modules/warranties/warranties.route.ts`
- `/chat` -> `modules/chat/chat.route.ts`
- `/` -> `modules/catalog/catalog.route.ts` for `/categories`, `/brands`, and admin catalog endpoints

## Mounted JavaScript routers kept for legacy modules

- `/admin` -> `modules/admin/admin.route.js`
- `/staff` -> `modules/staff/staff.route.js`
- `/products` -> `modules/products/products.route.js`
- `/shipments` -> `modules/shipments/shipments.route.js`
- `/payments` -> `modules/payments/payments.route.js`
- `/ai` -> `modules/ai/ai.route.js`
- `/compatibility` -> `modules/compatibility/compatibility.route.js`

## Archived legacy duplicate route files
 
The following unmounted legacy route files have been safely archived to `services/api/src/legacy/unused_routes/` to keep active module directories clean:
 
- `services/api/src/legacy/unused_routes/auth.route.js`
- `services/api/src/legacy/unused_routes/cart.route.js`
- `services/api/src/legacy/unused_routes/orders.route.js`
- `services/api/src/legacy/unused_routes/tickets.route.js`
- `services/api/src/legacy/unused_routes/users.route.js`
- `services/api/src/legacy/unused_routes/warranties.route.js`

## Current compatibility additions

- `PATCH /auth/me`
- `PATCH /auth/me/password`
- `PATCH /auth/me/addresses/:addressId`
- `DELETE /auth/me/addresses/:addressId`
- `GET /compatibility/builds/:buildId`
- `PATCH /pc-builder/:buildId/items/:componentType`

## Verification

- `npm.cmd run build -ws`
- `npm.cmd run test:api`
