import { Component, Input, SimpleChanges } from '@angular/core';
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
  incomeGroups: string[] = ['INCOME', 'TRANSFER_IN'];
  editBudget: Category | undefined;
  addBudget = false;
  backIcon = faArrowLeft;
  addIcon = faPlus;

  constructor(private db: DBStateService) { }

  ngOnChanges(changes: SimpleChanges): void {
  }

  get incomeBudgets(): Budget[] {
    const incomeBudgets = (this.budgets || []).filter(budget => {
      const budgetGroup = this.categories?.find(a => a.group === budget.categoryId || a.id === budget.categoryId)?.group;
      return budgetGroup && this.incomeGroups.includes(budgetGroup);
    });
    return (incomeBudgets.length > 0) ? incomeBudgets : [{ categoryId: 'INCOME', amount: 0 }];
  }

  get expenseBudgets(): Budget[] {
    return (this.budgets || []).filter(budget => {
      const budgetGroup = this.categories?.find(a => a.group === budget.categoryId || a.id === budget.categoryId)?.group;
      return !(budgetGroup && this.incomeGroups.includes(budgetGroup));
    });
  }

  get otherBudget(): Budget {
    const otherBudget = this.budgets?.find(a => a.categoryId === undefined);
    return otherBudget || { categoryId: undefined, amount: 0 };
  }

  transactionsForCategory(categoryId: string): Transaction[] {
    const earliest = new Date(this.month.getFullYear(), this.month.getMonth(), 1, 0, 0, 0).getTime();
    const latest = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 0, 23, 59, 59).getTime();
    return (this.transactions || []).filter(transaction =>
      (transaction.date >= earliest && transaction.date <= latest)
      && transaction.categoryId?.startsWith(categoryId)
    );
  }

  get otherBudgetTransactions(): Transaction[] {
    const budgetCategories = (this.budgets || []).reduce((acc, budget) => (!budget.categoryId || acc.includes(budget.categoryId)) ? acc : [...acc, budget.categoryId], [] as string[]);
    const earliest = new Date(this.month.getFullYear(), this.month.getMonth(), 1).getTime();
    const latest = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 0, 23, 59, 59).getTime();
    return (this.transactions || []).filter(transaction =>
      (transaction.date >= earliest && transaction.date <= latest)
      && (transaction.categoryId === undefined || !budgetCategories.some(budgetCategory => transaction.categoryId!.startsWith(budgetCategory)))
    );
  }

  onAddBudget(): void {
    this.addBudget = true;
  }

  onEdit(categoryId: string | undefined): void {
    if (categoryId === 'other') {
      this.editBudget = { id: 'other', group: 'other', name: 'Other' };
    } else {
      this.editBudget = this.categories?.find(a => a.id === categoryId);
      // Allow budgets for category group headings
      if (categoryId && !this.editBudget) {
        if (this.categories?.find(a => a.group === categoryId)) {
          this.editBudget = { id: categoryId, group: categoryId, name: categoryId };
        }
      }
    }
  }

}
