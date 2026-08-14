Type: grilling
Status: resolved

## Question

Client-side persistence: keep Spearmint's existing RxDB/IndexedDB layer, or adopt Peppermint's simpler localStorage wrapper? Does the new app need a migration path from the old Spearmint database?

## Answer

**RxDB/IndexedDB, carried forward from Spearmint.** Already proven in this codebase; IndexedDB is async and not meaningfully capped the way localStorage is; RxDB's reactive collections map naturally onto Angular Signals for the store layer.

**No migration path** — the existing Spearmint database can be dropped completely. The new app starts fresh (see Out of scope on the map).
