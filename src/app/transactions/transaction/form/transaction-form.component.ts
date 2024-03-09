import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { faArrowLeft, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { AppState } from 'src/app/app.module';
import { updateTransaction } from 'src/app/state/actions';
import { Account } from 'src/app/state/types/account.type';
import { Category } from 'src/app/state/types/category.type';
import { Transaction } from 'src/app/state/types/transaction.type';

@Component({
  selector: 'transaction-form',
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css']
})
export class TransactionFormComponent {
  @Input() transaction: Transaction | null = null;
  @Input() accounts: Account[] | null = null;
  @Input() categories: Category[] | null = null;
  @Output() close = new EventEmitter();
  subscriptions: Subscription[] = [];
  picking = false;
  backIcon = faArrowLeft;
  cancelIcon = faTimes;
  saveIcon = faCheck;

  form = new FormGroup({
    merchant: new FormControl<string>(''),
    date: new FormControl<Date>(new Date(), Validators.required),
    dateString: new FormControl<string>('', Validators.required),
    categoryId: new FormControl<number | undefined>(undefined),
    notes: new FormControl<string | undefined>(undefined),
    hideFromBudget: new FormControl<boolean | undefined>(undefined),
  });

  constructor(private store: Store<AppState>) { }

  ngOnInit(): void {
    this.subscriptions = [
      this.form.get('dateString')!.valueChanges.subscribe(dateString => {
        if (dateString) {
          this.form.get('date')!.setValue(new Date(dateString), { emitEvent: false });
        }
      })
    ]
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['transaction']) {
      this.updateFormFields();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  get account(): Account | undefined { return this.accounts?.find(a => a.id === this.transaction?.accountId); }
  get category(): Category | undefined { return this.categories?.find(a => a.id === this.form.get('categoryId')!.value); }
  get parentCategoryName(): string | undefined { return this.categories?.find(a => a.id === this.category?.parentId)?.name; }

  onClose(evt: Event): void {
    evt.stopPropagation();
    this.close.emit();
  }

  onSave(): void {
    this.store.dispatch(updateTransaction({ ...this.transaction, ...this.form.value } as Transaction));
    this.close.emit();
  }

  onPickCategory(): void {
    this.picking = true;
  }

  onSelectCategory(id: number | undefined): void {
    this.form.get('categoryId')!.setValue(id);
    this.form.get('categoryId')!.markAsDirty();
    this.picking = false;
  }

  onCancelCategory(): void {
    this.picking = false;
  }

  private updateFormFields(): void {
    if (this.transaction) {
      this.form.patchValue({
        merchant: this.transaction.merchant,
        date: new Date(this.transaction.date),
        dateString: new Date(this.transaction.date).toISOString().split('T')[0],
        categoryId: this.transaction.categoryId,
        notes: this.transaction.notes,
        hideFromBudget: this.transaction.hideFromBudget,
      });
    }
  }
}