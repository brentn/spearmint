import { ApplicationRef, ChangeDetectorRef, Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { faEdit } from '@fortawesome/free-regular-svg-icons';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';
import { AppState } from 'src/app/app.module';
import { DBStateService } from 'src/app/data/database/dbState.service';
import { Transaction } from 'src/app/data/models/transaction';
import { selectBudget } from 'src/app/data/state/actions';
import { Budget } from 'src/app/data/types/budget.type';
import { Currency } from 'src/app/utilities/currencyUtils';

@Component({
  selector: 'app-budget',
  templateUrl: './budget.component.html',
  styleUrls: ['./budget.component.css']
})
export class BudgetComponent {
  @Input() budget: Budget | undefined;
  @Input() transactions: Transaction[] | undefined;
  @Input() isIncome: boolean = false;
  @Output() edit = new EventEmitter();

  editIcon = faEdit;

  constructor(private store: Store<AppState>, private db: DBStateService, private app: ApplicationRef) { }

  get total(): number {
    const total = Currency.round((this.transactions || []).reduce((total, item) => total + item.amount, 0));
    return this.isIncome ? -total : total;
  }

  get progress(): number {
    if (this.total === 0) return 0;
    if (!this.budget?.amount) return 100;
    return Math.round((this.total / this.budget.amount) * 100);
  }

  get isOverBudget(): boolean {
    return !this.isIncome && this.total > ((this.budget?.amount || 0) * 1.05);
  }

  onViewTransactions(): void {
    this.store.dispatch(selectBudget(this.budget?.categoryId ?? 'other'));
  }

  onEdit(evt: Event): void {
    evt.stopPropagation();
    this.edit.emit();
  }

}
