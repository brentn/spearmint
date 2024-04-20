import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterTestingHarness } from '@angular/router/testing';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/app.module';
import { Account } from 'src/app/data/models/account';
import { Transaction } from 'src/app/data/models/transaction';
import { selectedAccount } from 'src/app/data/state/selectors';
import { Category } from 'src/app/data/types/category.type';

@Component({
  selector: 'transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.css']
})
export class TransactionComponent {
  @Input() transaction: Transaction | undefined;
  @Input() categories: Category[] | undefined;
  @Input() accounts: Account[] | undefined;
  @Output() select = new EventEmitter<Transaction | undefined>();
  editing = false;

  constructor(private store: Store<AppState>) { }

  get category(): Category | undefined {
    return this.categories?.find(a => a.id === this.transaction?.categoryId)
  }

  get categoryName(): string {
    if (!this.category) { return '[UNKNOWN]' }
    return this.category.id.substring(this.category.group.length + 1);
  }

  get accountName(): string {
    return this.accounts?.find(a => a.id === this.transaction?.accountId)?.displayName || '';
  }

  onEdit(): void {
    this.select.emit(this.transaction);
  }

}
