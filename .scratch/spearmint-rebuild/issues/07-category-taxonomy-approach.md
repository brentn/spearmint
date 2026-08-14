Type: grilling
Status: resolved

## Question

Old Spearmint ships Plaid's ~100-entry flat (grouped, not truly hierarchical) taxonomy. Peppermint has real parent/child subcategories already built, seeded with a small ~12-category mint.com-like starter set. Given the ask is specifically "rollover budget categories/subcategories," which approach should the rebuild adopt — and is income tracking/budgeting in scope?

## Answer

**Small hierarchical starter set in the mint.com mold**, not Plaid's taxonomy — roughly 10-15 top-level categories (Income, Housing, Transportation, Food & Dining, Bills & Utilities, Entertainment, Shopping, Health & Fitness, Personal Care, Travel, Gifts & Donations, Miscellaneous, Transfer), each with a handful of subcategories, freely editable afterward. Adopts Peppermint's hierarchy validation logic (cycle detection, duplicate-name-at-sibling-level, delete-blocked-if-has-subcategories) as the mechanism.

**Income tracking/budgeting is in scope** — Income is a first-class category (with its own budget treatment), not just a transaction sign convention.

Exact list content is drafted in [Default category list](13-default-category-list.md).
