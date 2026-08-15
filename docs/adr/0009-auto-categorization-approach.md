# Auto-categorization: pure local heuristic, no external classification service

Incoming transactions are categorized with a pure local heuristic — normalized-description similarity weighted against amount, account, and recurrence — producing a three-tier outcome (auto-apply / suggest / no-match). A user correction is stored as a `CategorizationRule` scoped to `(accountId, normalizedDescription)`.

When this was designed, a survey of merchant-classification vendors (Plaid Enrich, Ntropy, Akahu, MX) found none supported safe browser-direct calls without a backend proxy — which the project doesn't have (see [No backend for SimpleFIN](0002-no-backend-simplefin.md)) — so local heuristics were used instead. This isn't a standing prohibition on external services; one remains an option if a vendor with a safe direct-from-browser integration turns up.
