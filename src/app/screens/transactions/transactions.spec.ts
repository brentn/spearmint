import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Account, Category, Transaction } from '../../data/models';
import { TransactionsStore } from './transactions.store';
import { Transactions } from './transactions';

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: '2026-08-14',
    description: "Trader Joe's",
    amount: -64.2,
    pending: false,
    categoryId: null,
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

function category(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Groceries', type: 'expense', parentCategoryId: null, ...overrides };
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    institutionId: 'org-1',
    connId: 'CON-1',
    externalAccountId: 'ext-1',
    originalAccountName: 'Checking',
    name: 'Checking',
    type: 'bank',
    currencyCode: 'USD',
    balance: 100,
    balanceDate: '2026-08-01',
    needsReconnect: false,
    syncIssue: null,
    missing: false,
    ...overrides,
  };
}

/**
 * Component-level tests exercise Transactions' template wiring only — the underlying grouping/
 * filtering math is already covered by transaction-grouping.util.spec.ts. A fake, synchronous
 * store keeps this deterministic without driving a real RxDB-backed store through this screen,
 * following budget-detail.spec.ts's FakeXStore pattern (issue #19's first component spec here).
 */
class FakeTransactionsStore {
  readonly loading = signal(false);
  readonly transactions = signal<Transaction[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly accounts = signal<Account[]>([]);

  accountName(accountId: string): string {
    return this.accounts().find((a) => a.id === accountId)?.name ?? '';
  }

  categoryName(categoryId: string | null): string {
    if (!categoryId) {
      return 'Uncategorized';
    }
    return this.categories().find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
  }

  suggestionFor(_transactionId: string): { categoryId: string; categoryName: string } | null {
    return null;
  }

  readonly assignCategory = vi.fn(async (_transactionId: string, _categoryId: string | null) => {});
  readonly setNotes = vi.fn(async (_transactionId: string, _notes: string | null) => {});
  readonly setExcludeFromBudget = vi.fn(async (_transactionId: string, _excludeFromBudget: boolean) => {});
  readonly acceptSuggestion = vi.fn(async (_transactionId: string) => {});
}

describe('Transactions', () => {
  let fakeStore: FakeTransactionsStore;

  function createFixture() {
    TestBed.configureTestingModule({
      imports: [Transactions],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
      ],
    });
    fakeStore = new FakeTransactionsStore();
    TestBed.overrideComponent(Transactions, { set: { providers: [{ provide: TransactionsStore, useValue: fakeStore }] } });
    const fixture = TestBed.createComponent(Transactions);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('clicking a transaction row opens the edit dialog', () => {
    const fixture = createFixture();
    fakeStore.accounts.set([account()]);
    fakeStore.transactions.set([txn()]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-transaction-edit-dialog')).toBeNull();

    root.querySelector<HTMLElement>('.transactions__row')?.click();
    fixture.detectChanges();

    expect(root.querySelector('app-transaction-edit-dialog')).toBeTruthy();
  });

  it('clicking the category-picker trigger does not open the edit dialog', () => {
    const fixture = createFixture();
    fakeStore.accounts.set([account()]);
    fakeStore.categories.set([category()]);
    fakeStore.transactions.set([txn()]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.category-picker__trigger')?.click();
    fixture.detectChanges();

    expect(root.querySelector('app-transaction-edit-dialog')).toBeNull();
  });

  it('clicking a suggestion Apply button does not open the edit dialog', () => {
    const fixture = createFixture();
    fakeStore.accounts.set([account()]);
    fakeStore.categories.set([category()]);
    fakeStore.transactions.set([txn()]);
    vi.spyOn(fakeStore, 'suggestionFor').mockReturnValue({ categoryId: 'cat-1', categoryName: 'Groceries' });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.transactions__suggestion-accept')?.click();
    fixture.detectChanges();

    expect(root.querySelector('app-transaction-edit-dialog')).toBeNull();
    expect(fakeStore.acceptSuggestion).toHaveBeenCalledWith('txn-1');
  });

  it("the dialog's save output calls the store's mutation methods and closes the dialog", async () => {
    const fixture = createFixture();
    fakeStore.accounts.set([account()]);
    fakeStore.categories.set([category()]);
    fakeStore.transactions.set([txn()]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLElement>('.transactions__row')?.click();
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.transaction-edit-dialog__save')?.click();
    fixture.detectChanges();

    await vi.waitFor(() => expect(fakeStore.assignCategory).toHaveBeenCalledWith('txn-1', null));
    await vi.waitFor(() => expect(fakeStore.setNotes).toHaveBeenCalledWith('txn-1', null));
    await vi.waitFor(() => expect(fakeStore.setExcludeFromBudget).toHaveBeenCalledWith('txn-1', false));
    fixture.detectChanges();
    expect(root.querySelector('app-transaction-edit-dialog')).toBeNull();
  });

  it("the dialog's close output closes the dialog without calling any mutation method", () => {
    const fixture = createFixture();
    fakeStore.accounts.set([account()]);
    fakeStore.transactions.set([txn()]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLElement>('.transactions__row')?.click();
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.transaction-edit-dialog__cancel')?.click();
    fixture.detectChanges();

    expect(root.querySelector('app-transaction-edit-dialog')).toBeNull();
    expect(fakeStore.assignCategory).not.toHaveBeenCalled();
  });
});
