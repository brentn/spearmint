import { TestBed } from '@angular/core/testing';
import type { RxDatabase } from 'rxdb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseService } from '../data/database.service';
import type { Account } from '../data/models';
import { seedAccount, seedCategorizationRule } from '../testing/fixtures';
import { createTestDatabase } from '../testing/test-database';
import { StatementImportService } from './statement-import.service';
import { StatementImportError } from './ofx-parser.util';

const SGML_OFX = (opts: { amount?: string; balance?: string; balanceDate?: string } = {}) => `<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260810
<TRNAMT>${opts.amount ?? '-42.50'}
<FITID>fitid-1
<NAME>Coffee Shop
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260812
<TRNAMT>1500
<FITID>fitid-2
<MEMO>Payroll deposit
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>${opts.balance ?? '3215.75'}
<DTASOF>${opts.balanceDate ?? '20260815'}
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

function seedManualAccount(overrides: Partial<Account> = {}): Account {
  return seedAccount({
    connId: 'manual:acc-1',
    externalAccountId: 'acc-1',
    originalAccountName: 'Stopgap Checking',
    name: 'Stopgap Checking',
    balance: 0,
    isManual: true,
    ...overrides,
  });
}

describe('StatementImportService', () => {
  let fakeDb: RxDatabase;
  let service: StatementImportService;

  beforeEach(async () => {
    fakeDb = await createTestDatabase('accounts', 'transactions', 'categorizationRules');

    TestBed.configureTestingModule({
      providers: [
        StatementImportService,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
      ],
    });
    service = TestBed.inject(StatementImportService);
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  it('throws when the account does not exist', async () => {
    await expect(service.importStatement('missing-acc', SGML_OFX())).rejects.toThrow(
      StatementImportError,
    );
  });

  it('throws when the account is not a Manual Account', async () => {
    await fakeDb['accounts'].insert(seedManualAccount({ isManual: false }));

    await expect(service.importStatement('acc-1', SGML_OFX())).rejects.toThrow(
      StatementImportError,
    );
  });

  it('throws when a later FITID would make the composite id too long, without writing the earlier, valid transaction', async () => {
    await fakeDb['accounts'].insert(seedManualAccount());
    // fitid-2 (the second transaction) is the one made overlong, to prove the id length is
    // validated for every transaction before any of them are written — not just the first.
    const overlong = SGML_OFX().replace('<FITID>fitid-2', `<FITID>${'x'.repeat(100)}`);

    await expect(service.importStatement('acc-1', overlong)).rejects.toThrow(StatementImportError);

    const txns = await fakeDb['transactions'].find().exec();
    expect(txns).toHaveLength(0);
    const account = await fakeDb['accounts'].findOne('acc-1').exec();
    expect(account.balance).toBe(0);
  });

  it('throws on a malformed file and writes nothing', async () => {
    await fakeDb['accounts'].insert(seedManualAccount());

    await expect(service.importStatement('acc-1', 'not a statement file')).rejects.toThrow(
      StatementImportError,
    );

    const txns = await fakeDb['transactions'].find().exec();
    expect(txns).toHaveLength(0);
    const account = await fakeDb['accounts'].findOne('acc-1').exec();
    expect(account.balance).toBe(0);
  });

  it('inserts new transactions and updates the account balance/balanceDate from the ledger balance', async () => {
    await fakeDb['accounts'].insert(seedManualAccount());

    const result = await service.importStatement('acc-1', SGML_OFX());

    expect(result).toEqual({ importedCount: 2, updatedCount: 0 });
    const txns = await fakeDb['transactions'].find().exec();
    expect(txns).toHaveLength(2);
    const coffee = await fakeDb['transactions'].findOne('acc-1:fitid-1').exec();
    expect(coffee.description).toBe('Coffee Shop');
    expect(coffee.amount).toBe(-42.5);
    expect(coffee.date).toBe('2026-08-10');
    const payroll = await fakeDb['transactions'].findOne('acc-1:fitid-2').exec();
    expect(payroll.description).toBe('Payroll deposit');

    const account = await fakeDb['accounts'].findOne('acc-1').exec();
    expect(account.balance).toBe(3215.75);
    expect(account.balanceDate).toBe('2026-08-15');
  });

  it('auto-categorizes a new transaction that matches a stored CategorizationRule', async () => {
    await fakeDb['accounts'].insert(seedManualAccount());
    await fakeDb['categorizationRules'].insert(
      seedCategorizationRule({
        normalizedDescription: 'COFFEE SHOP',
        amount: -42.5,
        dayOfMonth: 10,
        categoryId: 'cat-coffee',
        createdAtUtc: '2026-01-01T00:00:00.000Z',
        updatedAtUtc: '2026-01-01T00:00:00.000Z',
      }),
    );

    await service.importStatement('acc-1', SGML_OFX());

    const coffee = await fakeDb['transactions'].findOne('acc-1:fitid-1').exec();
    expect(coffee.categoryId).toBe('cat-coffee');
  });

  it('re-importing the same file upserts by FITID instead of duplicating rows', async () => {
    await fakeDb['accounts'].insert(seedManualAccount());
    await service.importStatement('acc-1', SGML_OFX());

    const result = await service.importStatement('acc-1', SGML_OFX());

    expect(result).toEqual({ importedCount: 0, updatedCount: 2 });
    const txns = await fakeDb['transactions'].find().exec();
    expect(txns).toHaveLength(2);
  });

  it('re-importing an overlapping statement updates a changed field without duplicating or re-categorizing', async () => {
    await fakeDb['accounts'].insert(seedManualAccount());
    await fakeDb['categorizationRules'].insert(
      seedCategorizationRule({
        normalizedDescription: 'COFFEE SHOP',
        amount: -42.5,
        dayOfMonth: 10,
        categoryId: 'cat-coffee',
        createdAtUtc: '2026-01-01T00:00:00.000Z',
        updatedAtUtc: '2026-01-01T00:00:00.000Z',
      }),
    );
    await service.importStatement('acc-1', SGML_OFX());
    const coffee = await fakeDb['transactions'].findOne('acc-1:fitid-1').exec();
    await coffee.incrementalPatch({ categoryId: 'cat-user-corrected' });

    const result = await service.importStatement('acc-1', SGML_OFX({ amount: '-45.00' }));

    expect(result).toEqual({ importedCount: 0, updatedCount: 2 });
    const txns = await fakeDb['transactions'].find().exec();
    expect(txns).toHaveLength(2);
    const updated = await fakeDb['transactions'].findOne('acc-1:fitid-1').exec();
    expect(updated.amount).toBe(-45);
    // Not re-categorized: the user's prior correction survives an overlapping re-import.
    expect(updated.categoryId).toBe('cat-user-corrected');
  });
});
