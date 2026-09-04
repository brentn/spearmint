import { afterEach, describe, expect, it } from 'vitest';
import type { RxDatabase } from 'rxdb';
import { createTestDatabase } from './test-database';
import { seedAccount } from './fixtures';

describe('createTestDatabase', () => {
  let db: RxDatabase | undefined;

  afterEach(async () => {
    await db?.remove();
  });

  it('registers only the requested collections', async () => {
    db = await createTestDatabase('accounts', 'institutions');

    expect(Object.keys(db.collections).sort()).toEqual(['accounts', 'institutions']);
  });

  it('lets a caller read and write through the collection it asked for', async () => {
    db = await createTestDatabase('accounts');

    await db['accounts'].insert(seedAccount());

    const found = await db['accounts'].findOne('acc-1').exec();
    expect(found?.name).toBe('Checking');
  });

  it('validates writes against the real production schema', async () => {
    db = await createTestDatabase('accounts');

    await expect(db['accounts'].insert(seedAccount({ type: 'savings' as never }))).rejects.toThrow();
  });

  it('gives every call its own isolated, empty database', async () => {
    const first = await createTestDatabase('accounts');
    await first['accounts'].insert(seedAccount());

    db = await createTestDatabase('accounts');

    expect(await db['accounts'].findOne('acc-1').exec()).toBeNull();
    await first.remove();
  });
});
