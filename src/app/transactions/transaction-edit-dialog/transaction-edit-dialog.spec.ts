import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category, Transaction } from '../../data/models';
import { TransactionEditDialog, type TransactionEditSave } from './transaction-edit-dialog';

function category(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Groceries', type: 'expense', parentCategoryId: null, ...overrides };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    date: '2026-08-10',
    description: "Trader Joe's",
    amount: -64.2,
    pending: false,
    categoryId: null,
    excludeFromBudget: false,
    notes: null,
    ...overrides,
  };
}

describe('TransactionEditDialog', () => {
  function createFixture(inputs: { transaction?: Transaction; categories?: Category[]; accountName?: string } = {}) {
    TestBed.configureTestingModule({
      imports: [TransactionEditDialog],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(TransactionEditDialog);
    fixture.componentRef.setInput('transaction', inputs.transaction ?? transaction());
    fixture.componentRef.setInput('categories', inputs.categories ?? [category()]);
    fixture.componentRef.setInput('accountName', inputs.accountName ?? 'Checking');
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only description, amount, date and account, and the editable fields', () => {
    const fixture = createFixture({
      transaction: transaction({ description: 'Rent', amount: -1500, date: '2026-08-05', notes: 'note text' }),
      accountName: 'Main Checking',
    });
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    expect(text).toContain('Rent');
    expect(text).toContain('-$1,500.00');
    expect(text).toContain('2026-08-05');
    expect(text).toContain('Main Checking');
    expect(root.querySelector('app-category-picker')).toBeTruthy();
    expect(root.querySelector('.transaction-edit-dialog__notes')).toBeTruthy();
    expect(root.querySelector('input[type="checkbox"]')).toBeTruthy();
  });

  it('prefills the draft fields from the transaction', () => {
    const fixture = createFixture({
      transaction: transaction({ categoryId: 'cat-1', notes: 'Reimbursed by roommate', excludeFromBudget: true }),
    });
    const root = fixture.nativeElement as HTMLElement;

    const notes = root.querySelector<HTMLTextAreaElement>('.transaction-edit-dialog__notes');
    const checkbox = root.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(notes?.value).toBe('Reimbursed by roommate');
    expect(checkbox?.checked).toBe(true);
  });

  it('Save emits the edited draft with categoryId, notes and excludeFromBudget', () => {
    const fixture = createFixture({ transaction: transaction({ categoryId: null, notes: null, excludeFromBudget: false }) });
    const saveSpy = vi.fn();
    fixture.componentInstance.save.subscribe(saveSpy);
    const root = fixture.nativeElement as HTMLElement;

    const notes = root.querySelector<HTMLTextAreaElement>('.transaction-edit-dialog__notes')!;
    notes.value = 'reimbursed';
    notes.dispatchEvent(new Event('input'));
    const checkbox = root.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.transaction-edit-dialog__save')?.click();

    expect(saveSpy).toHaveBeenCalledWith({
      categoryId: null,
      notes: 'reimbursed',
      excludeFromBudget: true,
    } satisfies TransactionEditSave);
  });

  it('treats blank notes as null on save', () => {
    const fixture = createFixture({ transaction: transaction({ notes: 'old note' }) });
    const saveSpy = vi.fn();
    fixture.componentInstance.save.subscribe(saveSpy);
    const root = fixture.nativeElement as HTMLElement;

    const notes = root.querySelector<HTMLTextAreaElement>('.transaction-edit-dialog__notes')!;
    notes.value = '   ';
    notes.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.transaction-edit-dialog__save')?.click();

    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ notes: null }));
  });

  it('Cancel emits close without emitting save', () => {
    const fixture = createFixture();
    const saveSpy = vi.fn();
    const closeSpy = vi.fn();
    fixture.componentInstance.save.subscribe(saveSpy);
    fixture.componentInstance.close.subscribe(closeSpy);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('.transaction-edit-dialog__cancel')?.click();

    expect(closeSpy).toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('clicking the backdrop emits close without emitting save', () => {
    const fixture = createFixture();
    const saveSpy = vi.fn();
    const closeSpy = vi.fn();
    fixture.componentInstance.save.subscribe(saveSpy);
    fixture.componentInstance.close.subscribe(closeSpy);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLElement>('.transaction-edit-dialog')?.click();

    expect(closeSpy).toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('clicking inside the dialog card does not emit close', () => {
    const fixture = createFixture();
    const closeSpy = vi.fn();
    fixture.componentInstance.close.subscribe(closeSpy);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLElement>('.transaction-edit-dialog__card')?.click();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('Escape emits close without emitting save', () => {
    const fixture = createFixture();
    const saveSpy = vi.fn();
    const closeSpy = vi.fn();
    fixture.componentInstance.save.subscribe(saveSpy);
    fixture.componentInstance.close.subscribe(closeSpy);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closeSpy).toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('disables the editable fields and hides Save for a pending transaction', () => {
    const fixture = createFixture({ transaction: transaction({ pending: true }) });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.transaction-edit-dialog__notes')?.hasAttribute('disabled')).toBe(true);
    expect(root.querySelector('input[type="checkbox"]')?.hasAttribute('disabled')).toBe(true);
    expect(root.querySelector('.transaction-edit-dialog__save')).toBeNull();
    expect(root.textContent).toContain('PENDING');
  });
});
