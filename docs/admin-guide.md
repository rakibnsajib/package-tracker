# Admin Operations Guide

## Configure the admin secret

- Set the `ADMIN_SECRET` environment variable before starting the server to override the default `dev-admin-secret` value.
- Example (PowerShell): `setx ADMIN_SECRET "your-strong-secret"`
- Restart the API server after changing the secret so it picks up the new value.

## Obtain an admin token

- Send `POST /auth/admin-token` with JSON `{ "adminSecret": "<your secret>" }`.
- Successful responses return `{ token, user }`. The `user.role` field is `admin`, and the token contains the same claim.
- Include the token in subsequent requests via `Authorization: Bearer <token>`.

## Assign a package to a user

- Endpoint: `PUT /api/track/<trackingNumber>/owner`
- Headers: `Authorization: Bearer <admin token>` and `Content-Type: application/json`
- Body: `{ "ownerUserId": "<target user id>" }`
- The target id can belong to either an `auth_users` row (email/password account) or a `users` row (simulated OAuth account).
- On success the API returns the updated package record.

## Create a package for a specific user

- Endpoint: `POST /api/track`
- Headers: `Authorization: Bearer <admin token>` and `Content-Type: application/json`
- Body example:
  ```json
  {
    "trackingNumber": "PKG90000000",
    "carrier": "Sundarban Courier Service",
    "status": "Created",
    "ownerUserId": "6c0848df-531a-4109-8a74-c94ade054cba"
  }
  ```
- `ownerUserId` is required when using an admin token; the API validates that the user id exists before inserting the package.

## Verify ownership changes

- Use `GET /api/track/<trackingNumber>` (no auth required) to see the current owner id stored for a package.
- Users can call `GET /api/my-packages` with their own token to confirm that newly assigned packages appear in their list.

## Fallback: manual updates

- You can still update ownership directly in SQLite if needed:
  - `sqlite3 data.sqlite "UPDATE packages SET ownerUserId = '<user id>' WHERE trackingNumber = '<code>';"`
- Prefer the API workflows above so that validation and auditing middleware run consistently.
