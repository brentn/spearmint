import type { Category, CategoryType } from '../data/models';
import type { SpearmintDatabase } from '../data/database.service';

/** Same flat `{name, type, parentName}` shape as Peppermint's categories.service.ts (spec §7). */
export interface CategorySeed {
  name: string;
  type: CategoryType;
  parentName: string | null;
}

function topLevel(name: string, type: CategoryType, subcategories: string[]): CategorySeed[] {
  return [
    { name, type, parentName: null },
    ...subcategories.map((subName) => ({ name: subName, type, parentName: name })),
  ];
}

/** The default 13-top-level / ~48-entry starter taxonomy, locked in the rebuild spec §7. */
export const DEFAULT_CATEGORY_SEEDS: CategorySeed[] = [
  ...topLevel('Income', 'income', [
    'Paycheck',
    'Interest Income',
    'Refunds & Reimbursements',
    'Other Income',
  ]),
  ...topLevel('Housing', 'expense', [
    'Rent',
    'Mortgage',
    'Home Insurance',
    'Home Improvement',
    'Maintenance & Repairs',
  ]),
  ...topLevel('Transportation', 'expense', [
    'Gas & Fuel',
    'Auto Payment',
    'Auto Insurance',
    'Public Transit',
    'Parking & Tolls',
    'Service & Repairs',
  ]),
  ...topLevel('Food & Dining', 'expense', ['Groceries', 'Restaurants', 'Coffee Shops', 'Fast Food']),
  ...topLevel('Bills & Utilities', 'expense', [
    'Electricity & Gas',
    'Water',
    'Internet & Cable',
    'Phone',
    'Subscriptions',
  ]),
  ...topLevel('Entertainment', 'expense', ['Movies & Shows', 'Music', 'Hobbies', 'Games']),
  ...topLevel('Shopping', 'expense', ['Clothing', 'Electronics', 'Home & Garden', 'General Merchandise']),
  ...topLevel('Health & Fitness', 'expense', [
    'Doctor & Dentist',
    'Pharmacy',
    'Health Insurance',
    'Gym & Fitness',
  ]),
  ...topLevel('Personal Care', 'expense', ['Hair & Grooming', 'Spa & Massage']),
  ...topLevel('Travel', 'expense', ['Flights', 'Hotels & Lodging', 'Rental Cars']),
  ...topLevel('Gifts & Donations', 'expense', ['Gifts', 'Charitable Donations']),
  ...topLevel('Miscellaneous', 'expense', ['Uncategorized', 'Fees & Charges']),
  ...topLevel('Transfer', 'transfer', ['Credit Card Payment', 'Account Transfer']),
];

/** No-op once any category exists — this seed only ever populates a brand-new database. */
export async function seedDefaultCategoriesIfEmpty(db: SpearmintDatabase): Promise<void> {
  const existingCount = await db.categories.count().exec();
  if (existingCount > 0) {
    return;
  }

  const idByName = new Map<string, string>();
  const categories: Category[] = DEFAULT_CATEGORY_SEEDS.map((seed) => {
    const id = crypto.randomUUID();
    idByName.set(seed.name, id);
    return {
      id,
      name: seed.name,
      type: seed.type,
      parentCategoryId: seed.parentName ? (idByName.get(seed.parentName) ?? null) : null,
    };
  });

  await db.categories.bulkInsert(categories);
}
