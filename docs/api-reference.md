# API Documentation (Postman Friendly)

Base URL: `http://localhost:3000`

All responses are JSON unless noted. Rate limiting: 100 requests/min on `/api/*` and `/graphql`.

## Authentication Cheat Sheet
- Obtain user token: `POST /auth/login`
- Obtain admin token: `POST /auth/admin-token`
- Include tokens via `Authorization: Bearer <token>` header
- Tokens expire after 2 hours

## Auth Endpoints

### POST /auth/signup (no auth)
**Purpose**: create a credentialed user.
- Content-Type: `multipart/form-data`
- Fields: `username`, `email`, `password`, optional `firstName`, `lastName`, `avatar` file.

**Sample (Postman Form-Data)**
```
Key: username (text)  Value: demo
Key: email (text)     Value: demo@example.com
Key: password (text)  Value: demo123
Key: avatar (file)    Value: choose file
```

**Response 201**
```json
{
  "token": "<jwt>",
  "user": {
    "id": "...",
    "username": "demo",
    "email": "demo@example.com",
    "role": "user",
    "name": "demo"
  }
}
```

### POST /auth/login (no auth)
**Purpose**: log in with username/email + password or simulated OAuth fallback.
- Body JSON example:
```json
{
  "username": "demo",
  "password": "demo123"
}
```

**Response 200**: `{ "token": "<jwt>", "user": { ... } }`
- `401` if credentials invalid.

### POST /auth/admin-token (no auth)
**Purpose**: exchange `ADMIN_SECRET` for admin JWT.
- Body JSON:
```json
{
  "adminSecret": "<ADMIN_SECRET>"
}
```
- Response 200:
```json
{
  "token": "<jwt>",
  "user": { "role": "admin", "username": "admin" }
}
```
- `403` if secret mismatched.

### GET /auth/me (auth required)
- Header: `Authorization: Bearer <token>`
- Response 200: `{ "user": { ... } }`
- `401` if token missing/invalid.

### DELETE /auth/users/:id (admin)
- Headers: `Authorization: Bearer <admin-token>`
- Response 200:
```json
{
  "ok": true,
  "removedAuthUsers": 1,
  "removedUsers": 1
}
```
- Cleans analytics and unassigns owned packages.
- `404` if user id not found.

## Package Endpoints

### GET /api/track/:trackingNumber (public)
- No auth required.
- Response 200:
```json
{
  "trackingNumber": "PKG12345678",
  "carrier": "Sundarban Courier Service",
  "status": "In Transit",
  "lastLocationLat": 23.8103,
  "lastLocationLng": 90.4125,
  "lastUpdated": 1757834349354,
  "ownerUserId": "6c0848df-531a-4109-8a74-c94ade054cba"
}
```
- `404` if unknown tracking number.

### POST /api/track (auth required)
- Headers: `Authorization: Bearer <token>`
- Body JSON (standard user):
```json
{
  "trackingNumber": "PKG90000000",
  "carrier": "Sundarban Courier Service",
  "status": "Created",
  "lastLocationLat": 23.78,
  "lastLocationLng": 90.41
}
```
- Admin variant requires `ownerUserId`.
- Response 201: stored package row.
- `400` for validation errors, `404` if admin provides missing owner id.

### PUT /api/track/:trackingNumber (auth required)
- Headers: `Authorization: Bearer <token>`
- Body JSON with any subset of `carrier`, `status`, `lastLocationLat`, `lastLocationLng`.
- Response 200: updated package.
- `404` if tracking number not found.

### PATCH /api/track/:trackingNumber/owner (admin)
- Headers: `Authorization: Bearer <admin-token>`
- Body JSON to assign:
```json
{
  "ownerUserId": "1c2eabed-44fb-4191-b525-afb39904feab"
}
```
- Body JSON to unassign:
```json
{
  "ownerUserId": null
}
```
- Response 200: updated package.
- `404` if package or owner (when provided) missing.

### DELETE /api/track/:trackingNumber (auth required)
- Headers: `Authorization: Bearer <token>`
- Response 200: `{ "ok": true }`
- `404` if package missing.

### GET /api/my-packages (auth required)
- Headers: `Authorization: Bearer <token>`
- Response 200: `[]` or array of packages owned by current user.

### POST /api/dev/create-demo-packages?username=demo (public)
- Query parameter `username` required.
- Response 200: `{ "ok": true, "created": ["BDDEMO001", ...] }`
- `404` if username not found.

## GraphQL Endpoint

### POST /graphql
- Query example (public):
```json
{
  "query": "query FindPackage($tn: ID!) { package(trackingNumber: $tn) { trackingNumber status } }",
  "variables": { "tn": "PKG12345678" }
}
```

- Mutation example (auth required):
```json
{
  "query": "mutation Update($tn: ID!, $status: String!) { updateStatus(trackingNumber: $tn, status: $status) { trackingNumber status } }",
  "variables": { "tn": "PKG12345678", "status": "Delivered" }
}
```
- Include `Authorization: Bearer <token>` for mutations.

## Postman Tips
- Set environment variables in Postman for `baseUrl`, `userToken`, `adminToken`.
- Use Authorization tab  ->  Bearer Token for easier reuse.
- Save requests in a collection; leverage the Collection Runner for scripted flows.

## Error Codes Summary
- `400` – validation/format errors
- `401` – missing/invalid token
- `403` – admin secret or role failure
- `404` – resource not found (package/user/owner)
- `500` – database or unexpected error

## Postman Collection Snapshot
- **POST Login Admin** : `/auth/admin-token`
- **PUT Assign Package** : `/api/track/:trackingNumber/owner`
- **PATCH Unassign Package** : `/api/track/:trackingNumber/owner` with `{ "ownerUserId": null }`
- **POST Create a Package** : `/api/track`
- **GET Track a Package** : `/api/track/:trackingNumber`
- **PUT Update Package** : `/api/track/:trackingNumber`
- **DELETE Delete User** : `/auth/users/:id`
- **DELETE Delete Package** : `/api/track/:trackingNumber`



