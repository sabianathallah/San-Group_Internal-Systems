# API Contract

Base URL: `http://localhost:3000/api/v1`

> Akan diisi setelah endpoint auth & module selesai dibuat.

## Conventions

- Response format: `{ success: boolean, data: T | null, message: string }`
- Auth: Bearer token via `Authorization` header atau cookie `access_token`
- Errors: HTTP status code + `success: false`
