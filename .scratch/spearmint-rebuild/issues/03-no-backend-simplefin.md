Type: grilling
Status: resolved

## Question

Today's Express+Postgres backend proxies Plaid and stores WebAuthn state. Plaid goes away with SimpleFIN. Should the SimpleFIN claim/fetch flow reuse or extend that backend (likely needed to work around the Bridge not setting CORS headers for browser calls), or should there be no backend at all?

## Answer

**No backend at all.** SimpleFIN is called directly from the frontend. It's acknowledged to be "a bit tricky to use," so a dedicated **access-layer service** in Angular absorbs its quirks (setup-token claim, access-URL storage, the 90-day-window/~24-requests-per-day limits, response normalization) — see [SimpleFIN access-layer design](11-simplefin-access-layer-design.md).

**Contingent on [SimpleFIN CORS + protocol research](10-simplefin-cors-protocol-research.md)**: this decision assumes the SimpleFIN Bridge allows direct browser fetches to its claim and `/accounts` endpoints. If that research finds otherwise, this ticket needs to be reopened and revisited (e.g. a minimal serverless proxy, which is a narrower exception than a maintained backend service, might still be compatible with the spirit of this decision — but that's a decision to make if and when the CORS research forces it).
