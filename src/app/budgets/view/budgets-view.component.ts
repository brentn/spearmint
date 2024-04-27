import { Component, Input, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { faArrowLeft, faPlus } from '@fortawesome/free-solid-svg-icons';
import { DBStateService } from 'src/app/data/database/dbState.service';
import { Account } from 'src/app/data/models/account';
import { Transaction } from 'src/app/data/models/transaction';
import { Budget } from 'src/app/data/types/budget.type';
import { Category } from 'src/app/data/types/category.type';

@Component({
  selector: 'app-budgets',
  templateUrl: './budgets-view.component.html',
  styleUrls: ['./budgets-view.component.css']
})
export class BudgetsViewComponent {
  @Input() budgets: Budget[] | undefined;
  @Input() categories: Category[] | undefined;
  @Input() accounts: Account[] | undefined;
  @Input() transactions: Transaction[] | undefined;
  @Input() selectedBudget: string | undefined;
  month = new Date();
  incomeGroups: string[] = ['INCOME'];
  expenseGroups: string[] = [];
  editCategory: string | undefined;
  budgetAmount = new FormControl<number>(0, { updateOn: 'blur' });
  backIcon = faArrowLeft;
  addIcon = faPlus;

  constructor(private db: DBStateService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories']) {
      this.expenseGroups = (this.categories || [])
        .reduce((groups, item) => groups.includes(item.group) ? groups : [...groups, item.group], [] as string[])
        .filter(group => !['INCOME', 'TRANSFER_IN', 'TRANSFER_OUT'].includes(group));
    }
  }

  get incomeBudgets(): Budget[] {
    return this.incomeGroups.map(group => {
      const budget = this.budgets?.find(a => a.categoryId === group);
      return budget || { categoryId: group, amount: 0 }
    })
  }

  get expenseBudgets(): Budget[] {
    return this.expenseGroups.map(group => {
      const budget = this.budgets?.find(a => a.categoryId === group);
      return budget || { categoryId: group, amount: 0 }
    })
  }

  get otherBudget(): Budget {
    const otherBudget = this.budgets?.find(a => a.categoryId === undefined);
    return otherBudget || { categoryId: undefined, amount: 0 };
  }

  transactionsForCategory(categoryId: string): Transaction[] {
    const earliest = new Date(this.month.getFullYear(), this.month.getMonth(), 1).getTime();
    const latest = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 0, 23, 59, 59).getTime();
    return (this.transactions || []).filter(transaction =>
      transaction.date >= earliest && transaction.date <= latest && transaction.categoryId?.startsWith(categoryId)
    );
  }

  get otherBudgetTransactions(): Transaction[] {
    const budgetCategories = (this.budgets || []).filter(a => !!a.categoryId);
    const earliest = new Date(this.month.getFullYear(), this.month.getMonth(), 1).getTime();
    const latest = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 0, 23, 59, 59).getTime();
    return (this.transactions || []).filter(transaction =>
      (transaction.date >= earliest && transaction.date <= latest)
      && (transaction.categoryId === undefined || !budgetCategories.some(budgetCategory => transaction.categoryId!.startsWith(budgetCategory.categoryId!)))
    );
  }

  onEdit(categoryId: string | undefined): void {
    this.editCategory = categoryId;
    const budget = this.budgets?.find(a => a.categoryId === categoryId);
    this.budgetAmount.setValue(budget?.amount || 0, { emitEvent: false });
  }

  onUpdateBudget(): void {
    const budget = this.budgets?.find(a => a.categoryId === this.editCategory) || {
      categoryId: this.editCategory,
      amount: 0
    };
    this.db.Budgets.upsert$({ ...budget, amount: +(this.budgetAmount.value ?? '0') }).subscribe();
    this.editCategory = undefined;
  }

  onCancelUpdate(): void {
    this.editCategory = undefined;
  }

}
