# Domain model: SimpleFIN-only transactions, narrower CategorizationRule

`Transaction` is modeled as SimpleFIN-sourced only — there's no manual transaction entry path, and none is planned; every transaction in the system came from a sync.

`CategorizationRule` is deliberately narrower than old Spearmint's "Transformation" concept: it only does category matching, with no merchant-rename or exclusion-from-budget memory carried over.
