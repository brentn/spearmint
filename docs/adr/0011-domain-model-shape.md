# Domain model: SimpleFIN-only transactions, narrower CategorizationRule

> Superseded in part by ADR-0016: a narrow, deliberate exception now exists for Manual
> Accounts, populated via Statement Import rather than SimpleFIN sync. This is a scoped
> bridge for one unsupported bank, not a reversal of the reasoning below for the general
> case.

`Transaction` is modeled as SimpleFIN-sourced only — there's no manual transaction entry path, and none is planned; every transaction in the system came from a sync.

`CategorizationRule` is deliberately narrower than old Spearmint's "Transformation" concept: it only does category matching, with no merchant-rename or exclusion-from-budget memory carried over.
