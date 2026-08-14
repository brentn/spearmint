Type: research
Status: resolved
Blocked by: 09

## Question

Does the SimpleFIN Bridge allow direct browser (CORS) requests to its setup-token claim URL and to `GET {accessUrl}/accounts`, or does it only support server-to-server calls? What exactly do the claim response, account response, and transaction response shapes look like (field names, amount sign convention, date formats, org/institution info per account)? What does an auth/rate-limit error response look like? This directly validates or invalidates [No backend for SimpleFIN](03-no-backend-simplefin.md).

## Answer

**CORS is supported for direct browser calls, confirmed empirically** — see full findings and response-shape reference in [10-research-notes.md](10-research-notes.md). Both the claim endpoint and `/accounts` return proper `Access-Control-Allow-Origin`/`-Credentials`/`-Headers` on success *and* error responses, and an `Authorization`-header preflight to `/accounts` succeeds. This validates [No backend for SimpleFIN](03-no-backend-simplefin.md) as written — no proxy needed.

Key details for [SimpleFIN access-layer design](11-simplefin-access-layer-design.md): amounts are decimal strings (not floats), dates are Unix-epoch seconds, errors are structured `{code, msg, conn_id?, account_id?}` and must be shown to the user per SimpleFIN's own guidance. Re-authentication (a `con.auth` error) has **no API-level fix** — the access-layer must detect it and link the user out to SimpleFIN Bridge's own hosted page to re-auth; this is a deliberate protocol boundary (third-party apps never handle bank MFA), not a gap to design around. This lines up with the "auth issues" notification trigger already decided in [Notifications scope](08-notifications-scope.md).

