# Package Tracker - REST, GraphQL, and Admin Toolkit

Package Tracker is a compact, production-inspired demo for tracking shipment status by tracking number. It offers a chatbot-style web interface backed by REST and GraphQL APIs, role-aware authentication, validations, security hardening, lightweight analytics, and an optional map view of the last known location.

## Table of Contents
- Overview
- Features
- Architecture
- Tech Stack
- Requirements
- Quick Start
- Configuration
- API Overview
- GraphQL
- Admin Operations
- Security
- Analytics
- Frontend UX
- Project Structure
- Roles of Group Members
- Examples
- Documentation

## Overview
- Purpose: demonstrate REST vs GraphQL, auth, security, and chatbot UX in a small full-stack app.
- Scope: local development environment with seeded data; suitable for demos and coursework.

## Features
- Chatbot UI with map: conversational tracking plus Leaflet location view.
- Dual APIs: REST endpoints and a GraphQL schema over the same data.
- Role-based auth: JWTs carry `role` (user or admin) and power admin-only endpoints.
- Validation & security: express-validator, CORS, Helmet, rate limiting.
- Persistent storage: SQLite for packages, users, auth records, and analytics.

## Architecture
- Client: static HTML/CSS/JS served by Express; chat UI hits REST (and can hit GraphQL).
- Server: Express app with Apollo Server (v4) for GraphQL.
- Data: SQLite database with `users`, `auth_users`, `packages`, and `analytics` tables.

## Tech Stack
- Frontend: HTML, CSS, JavaScript, Leaflet
- Backend: Node.js, Express, @apollo/server v4
- Database: SQLite (sqlite3)
- Security: helmet, cors, express-rate-limit, jsonwebtoken, bcryptjs

## Requirements
- Node.js: v18+ (LTS recommended)
- npm: v8+
- OS: Windows, macOS, or Linux

## Quick Start
1. Install dependencies: `npm install`
2. Create a `.env` file in the project root:
   ```
   ADMIN_SECRET=<strong-random-secret>
   JWT_SECRET=<change-me>
   ```
   (Defaults exist, but overriding them is recommended.)
3. Start in development: `npm run dev`
4. Open the app: `http://localhost:3000`
5. Click "Track Your Package", then try `PKG12345678`

Seeded tracking numbers (Bangladesh)
- `PKG12345678` - Sundarban Courier Service - Dhaka (23.8103, 90.4125)
- `PKG87654321` - SteadFast - Chattogram (22.3569, 91.7832)
- `PKG11112222` - RedX - Sylhet (24.8949, 91.8687)

## Configuration
Environment variables (via `.env` or shell)
- `PORT` (default: 3000)
- `JWT_SECRET` (default: `dev-secret`)
- `ADMIN_SECRET` (default: `dev-admin-secret`; required for issuing admin tokens)

CORS
- Demo config allows all origins. Restrict `origin` in `src/server.js` for production.

Rate limiting
- Applied to `/api` and `/graphql`. Tune window/max in `src/server.js`.

## API Overview
REST endpoints (`Authorization: Bearer <token>` required unless noted)

Auth
- `POST /auth/signup` - Create credentialed user (multipart form for optional avatar).
- `POST /auth/login` - Login with username/email + password or mock OAuth fallback.
- `POST /auth/admin-token` - Exchange `ADMIN_SECRET` for a short-lived admin JWT.
- `GET /auth/me` - Inspect current user (token required).
- `DELETE /auth/users/:id` - Admin-only removal of a user; clears ownership and analytics.

Packages
- `GET /api/track/:trackingNumber` - Public lookup of a package.
- `POST /api/track` - Create package. Admins must provide `ownerUserId`; users auto-own.
- `PUT /api/track/:trackingNumber` - Update package fields.
- `PATCH /api/track/:trackingNumber/owner` - Admin assign or clear ownership (`ownerUserId` null).
- `DELETE /api/track/:trackingNumber` - Delete a package.
- `GET /api/my-packages` - List packages for the authenticated user.
- `POST /api/dev/create-demo-packages?username=` - Local helper to seed demo data.

Authentication
- Obtain a JWT via `POST /auth/login` or `POST /auth/admin-token`.
- Include `Authorization: Bearer <token>` for protected endpoints.

## GraphQL
- Endpoint: `POST /graphql`
- Queries (no auth):
  - `package(trackingNumber: ID!): Package`
  - `packages: [Package!]!`
- Mutations (require JWT):
  - `createPackage`
  - `updateStatus`
  - `deletePackage`

Example request body:
```json
{
  "query": "mutation Update($tn: ID!, $status: String!) { updateStatus(trackingNumber: $tn, status: $status) { trackingNumber status } }",
  "variables": { "tn": "PKG12345678", "status": "Delivered" }
}
```

## Admin Operations
- Generate token: `POST /auth/admin-token` with `{ "adminSecret": "<ADMIN_SECRET>" }`.
- Assign package: `PATCH /api/track/PKG12345678/owner` body `{ "ownerUserId": "<user-id>" }`.
- Unassign package: same endpoint with `{ "ownerUserId": null }`.
- Delete user: `DELETE /auth/users/<user-id>` to remove credentials and clear ownership.
- Delete package: `DELETE /api/track/<trackingNumber>`.

## Security
- CORS: permissive by default; tighten for production.
- Helmet: standard headers applied globally.
- Rate limiting: 100 req/min per IP on API and GraphQL routes.
- Input validation: tracking numbers and owner IDs via express-validator.
- Authorization: JWT middleware injects `req.user`; admin routes require `role === 'admin'`.

## Analytics
- Middleware logs each request to the `analytics` table (`ts`, `method`, `path`, `userId`).
- Inspect via SQLite CLI or your preferred viewer.

## Frontend UX
- Landing page: CTA launches chatbot.
- Chatbox: supports commands like `track PKG12345678` and `help`.
- Map: surfaces when latitude/longitude data exists.

## Project Structure
- `src/server.js` - Express bootstrap, middleware, Apollo Server wiring, dotenv.
- `src/db.js` - SQLite initialization, migrations, seed data.
- `src/auth.js` - JWT helpers, auth/admin middleware, credentials helpers.
- `src/routes/` - REST routes (`auth`, `tracking`).
- `src/graphql.js` - GraphQL schema and resolvers.
- `public/` - Static assets (landing page, chat UI, map).
- `docs/` - `admin-guide.md` and `api-reference.md` for detailed workflows.

## Examples
Login and record token
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}'
```

Create a package as admin
```bash
TOKEN=... # paste admin token
curl -s -X POST http://localhost:3000/api/track \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber":"PKG90000000","status":"Created","ownerUserId":"<user-id>"}'
```

GraphQL query
```bash
curl -s -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ packages { trackingNumber status } }"}'
```

## Documentation
- REST & GraphQL reference: `docs/api-reference.md`
- Admin operations guide: `docs/admin-guide.md`

> This repository is a teaching resource. Additional hardening, tests, and monitoring are required before production use.



## Roles of Group Members
- **Rakib Hossain Sajib** – Lead developer & coordinator; handled backend architecture, admin authentication, REST/GraphQL integration, and documentation.
- **Md Rokon Mia** – Frontend specialist; maintained chatbot UX, Leaflet map interactions, and ensured the UI leveraged the new API capabilities.
- **Md Hasanuzzaman Asif** – QA & tooling lead; validated database workflows, Postman collections, and kept operational guides accurate.

## Acknowledgement
We acknowledge thanks to Md. Shamsuzzaman, Assistant Professor, Begum Rokeya University, Rangpur for providing the task to us as part of CSE 4204 Web Engineering Lab.


