# SimpleFIN Bridge CORS & protocol research

Empirical testing against the live `beta-bridge.simplefin.org` API (using SimpleFIN's own public demo token/credentials, no real bank data touched), 2026-08-13.

## CORS: direct browser calls work

Both the claim endpoint and `/accounts` set proper CORS headers, on **success and error responses alike**:

```
access-control-allow-credentials: true
access-control-allow-headers: authorization
access-control-allow-origin: <reflects request Origin>
access-control-max-age: 5
vary: Origin
```

- `POST {claimUrl}` — simple request (no custom headers), no preflight needed. Returns the headers above along with the access URL body.
- `OPTIONS /accounts` (simulating a preflight for a GET with an `Authorization` header) — **200**, with `access-control-allow-methods: GET` and `access-control-allow-headers: authorization`.
- `GET /accounts?version=2` — works both with Basic Auth credentials embedded in the URL and with an explicit `Authorization: Basic ...` header; both get the CORS headers.
- A deliberately bad-credentials request to `/accounts` still returns the CORS headers on its 403, so error handling in-browser isn't blocked either.

One caveat: an `OPTIONS` sent to the **claim** URL itself 404'd — but the claim POST is a CORS-simple request (no custom `Content-Type`/headers), so no preflight is triggered for it in practice; this only matters if the access-layer service ever needs to preflight that specific call.

**Conclusion: validates [No backend for SimpleFIN](03-no-backend-simplefin.md) as written.** No proxy or serverless shim is needed for CORS reasons.

## Response shapes (protocol v2, `?version=2`)

```jsonc
{
  "errlist": [ { "code": "gen.auth", "msg": "Forbidden", "conn_id": "...", "account_id": "..." } ],
  "connections": [
    { "conn_id": "CON-...", "name": "...", "org_id": "...", "org_name": "...", "org_url": "...", "sfin_url": "..." }
  ],
  "accounts": [
    {
      "id": "...", "name": "...", "currency": "USD",
      "balance": "113705.51", "available-balance": "113705.51", "balance-date": 1786665600,
      "conn_id": "CON-...",
      "transactions": [
        { "id": "...", "posted": 1786608000, "amount": "-65.50", "description": "...", "payee": "...", "memo": "...", "transacted_at": 1786608000, "pending": false, "mcc": "5812" }
      ],
      "holdings": [ { "id": "...", "symbol": "AAPL", "shares": "550.0", "market_value": "105884.8", ... } ]
    }
  ],
  "x-api-message": "..."
}
```

- **Amount sign**: positive = money deposited (matches spec). Amounts are numeric strings, not floats — access-layer should parse carefully (decimal-safe).
- **Dates**: Unix epoch seconds (`posted`, `transacted_at`, `balance-date`), not ISO strings.
- **Errors**: structured `{code, msg, conn_id?, account_id?}`; `code` prefixes are `gen` (general), `con` (connection-level), `act` (account-level). `msg` is user-displayable per SimpleFIN's own guidance ("Always show those errors to your end users").
- Holdings (brokerage) is a v2 addition beyond plain bank accounts — worth deciding whether Spearmint's domain model needs to represent it or can ignore it for v1.

## Re-authentication / MFA — no API-level path

Directly relevant to the 24-hour-MFA question raised mid-session: the SimpleFIN protocol is **read-only** and has no endpoint for a third-party app to submit an MFA/2FA code on the user's behalf. When a bank connection needs re-auth, `/accounts` returns a `con.auth`-coded error in `errlist` for that connection — the access-layer's job is to detect that code and **link the user out to the SimpleFIN Bridge's own hosted site** to re-authenticate; it cannot resolve it in-app. This is a deliberate boundary in SimpleFIN's design (the third-party app never handles bank credentials/MFA, which is the point of using an aggregator).

Consequence for [SimpleFIN access-layer design](11-simplefin-access-layer-design.md): the service needs to surface `con.auth` (and other `con.*`/`act.*`) errors distinctly from a generic fetch failure, so the UI can show a "reconnect at SimpleFIN Bridge" prompt — which lines up with the "auth issues" trigger already decided in [Notifications scope](08-notifications-scope.md).

## Rate limits (confirmed from docs, not independently re-tested to avoid burning Brent's quota)

- ~24 requests/day per access URL (with some initial setup leeway), scoped separately for all-accounts vs single-account requests.
- 90-day window per request (`start-date`/`end-date` query params).
- Exceeding quota triggers warnings before the access URL is disabled — access-layer should cache aggressively and avoid polling.

## Sources

- https://www.simplefin.org/protocol.html
- https://beta-bridge.simplefin.org/info/developers
- https://github.com/simplefin/simplefin.github.com/discussions/33 (protocol v2 changes)
- https://github.com/simplefin/bridge-issues (SimpleFIN's own issue tracker)
- Live testing against `beta-bridge.simplefin.org` with SimpleFIN's published demo credentials
