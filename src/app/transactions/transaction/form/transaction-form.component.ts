import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { faArrowLeft, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { Subject, Subscription, take, tap } from 'rxjs';
import { AppState } from 'src/app/app.module';
import { DBStateService } from 'src/app/data/database/dbState.service';
import { Account } from 'src/app/data/models/account';
import { Transaction } from 'src/app/data/models/transaction';
import { Transformation } from 'src/app/data/models/transformation';
import { updateTransaction } from 'src/app/data/state/actions';
import { Category } from 'src/app/data/types/category.type';

@Component({
  selector: 'transaction-form',
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css']
})
export class TransactionFormComponent {
  @Input() transaction: Transaction | undefined;
  @Input() accounts: Account[] | undefined;
  @Input() categories: Category[] | undefined;
  @Output() close = new EventEmitter();
  focus = new Subject();
  subscriptions: Subscription[] = [];
  picking = false;
  backIcon = faArrowLeft;
  cancelIcon = faTimes;
  saveIcon = faCheck;

  form = new FormGroup({
    name: new FormControl<string>(''),
    merchant: new FormControl<string>(''),
    date: new FormControl<Date>(new Date(), Validators.required),
    dateString: new FormControl<string>('', Validators.required),
    categoryId: new FormControl<string | undefined>(undefined),
    notes: new FormControl<string | undefined>(undefined),
    hideFromBudget: new FormControl<boolean | undefined>(undefined),
  });

  constructor(private store: Store<AppState>, private db: DBStateService) { }

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

  onClose(evt: Event): void {
    evt.stopPropagation();
    this.close.emit();
  }

  onSave(): void {
    if (this.form.get('merchant')!.dirty || this.form.get('categoryId')!.dirty || this.form.get('hideFromBudget')!.dirty) {
      this.db.Transformations.upsert$(new Transformation({
        ...this.transaction,
        newMerchant: this.form.get('merchant')!.value,
        newCategoryId: this.form.get('categoryId')!.value,
        newHideFromBudget: this.form.get('hideFromBudget')!.value,
      })).subscribe();
    }
    this.db.transformations$.pipe(
      take(1),
    ).subscribe();
    this.store.dispatch(updateTransaction({ ...this.transaction, ...this.form.value, date: this.form.value.date?.getTime() } as Transaction));
    this.close.emit();
  }

  onPickCategory(): void {
    this.picking = true;
    this.focus.next(0);
  }

  onSelectCategory(id: string | undefined): void {
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
        name: this.transaction.name,
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
