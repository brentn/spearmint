Type: task
Status: resolved

## Question

Draft the actual default category list content per [Category taxonomy approach](07-category-taxonomy-approach.md): ~10-15 top-level categories (including Income as first-class), each with a handful of sensible subcategories, in the mint.com mold. Should mirror the shape of Peppermint's existing seed (`categories.service.ts`) but with fuller mint.com-style coverage than its current ~12 entries.

## Answer

13 top-level categories (the exact set named in [Category taxonomy approach](07-category-taxonomy-approach.md)), each with 2-6 subcategories, ~48 entries total — same flat `DEFAULT_CATEGORY_SEEDS` shape as Peppermint's `categories.service.ts` (`{name, type, parentName}`), just fuller:

- **Income** — Paycheck, Interest Income, Refunds & Reimbursements, Other Income
- **Housing** — Rent, Mortgage, Home Insurance, Home Improvement, Maintenance & Repairs
- **Transportation** — Gas & Fuel, Auto Payment, Auto Insurance, Public Transit, Parking & Tolls, Service & Repairs
- **Food & Dining** — Groceries, Restaurants, Coffee Shops, Fast Food
- **Bills & Utilities** — Electricity & Gas, Water, Internet & Cable, Phone, Subscriptions
- **Entertainment** — Movies & Shows, Music, Hobbies, Games
- **Shopping** — Clothing, Electronics, Home & Garden, General Merchandise
- **Health & Fitness** — Doctor & Dentist, Pharmacy, Health Insurance, Gym & Fitness
- **Personal Care** — Hair & Grooming, Spa & Massage
- **Travel** — Flights, Hotels & Lodging, Rental Cars
- **Gifts & Donations** — Gifts, Charitable Donations
- **Miscellaneous** — Uncategorized, Fees & Charges
- **Transfer** — Credit Card Payment, Account Transfer

Every subcategory takes its parent's type (Peppermint's `validateCategory` already enforces parent/child type match, kept as-is).

**Open question carried to [Domain model reconciliation](16-domain-model-reconciliation.md):** Peppermint's `CategoryType` is only `'expense' | 'income'`, with no `'transfer'` — but a top-level Transfer category (for credit-card payments and account-to-account moves that shouldn't count as real spend) doesn't cleanly fit either. The domain-model ticket needs to decide: add a third `'transfer'` type, or keep Transfer as an `'expense'`-typed category that budget/reporting logic knows to exclude. Not decided here since it's a modeling question, not a content one.
