# No backend — SimpleFIN accessed directly from the frontend

Spearmint has no backend server; the SimpleFIN access-layer service calls the SimpleFIN Bridge API directly from the browser. This was validated empirically before committing to it — a CORS check confirmed SimpleFIN returns proper CORS headers on both success and error responses, so no proxy is needed. The one gap: re-authentication (`con.auth`) has no API-level fix, so the app links the user out to SimpleFIN Bridge's own site when a connection needs reconnecting.
