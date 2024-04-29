import { Component, EventEmitter, Input, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Subject } from 'rxjs';
import { DBStateService } from 'src/app/data/database/dbState.service';
import { Budget } from 'src/app/data/types/budget.type';
import { Category } from 'src/app/data/types/category.type';
import { Currency } from 'src/app/utilities/currencyUtils';

@Component({
  selector: 'app-budget-form',
  templateUrl: './budget-form.component.html',
  styleUrls: ['./budget-form.component.css']
})
export class BudgetFormComponent {
  @Input() categories: Category[] | undefined;
  @Input() budgets: Budget[] | undefined;
  @Input() selectedCategory: Category | undefined;
  @Output() close = new EventEmitter();
  focus = new Subject();
  availableCategories: Category[] = [];
  picking = false;
  backIcon = faArrowLeft;

  form = new FormGroup({
    amount: new FormControl<number>(0)
  })

  constructor(private db: DBStateService) { }

  ngOnChanges(changes: SimpleChanges): void {
    const budgetCategories = (this.categories || []).filter(a => !a.group.startsWith('TRANSFER'));
    this.availableCategories = budgetCategories.filter(a => !this.budgets?.some(b => b.categoryId === a.id));
    if (this.selectedCategory && !this.availableCategories.find(a => a.id === this.selectedCategory!.id)) {
      this.availableCategories = [...this.availableCategories, this.selectedCategory];
    }
    if (changes['selectedCategory']) {
      this.form.get('amount')?.setValue(this.budgets?.find(a => a.categoryId === this.selectedCategory?.id)?.amount || 0);
    }
  }

  get totalIncomeBudget(): number {
    return Currency.round((this.budgets || []).filter(a => a.categoryId?.startsWith('INCOME')).reduce((total, a) => total + a.amount, 0));
  }

  get totalExpenseBudget(): number {
    return Currency.round((this.budgets || []).filter(a => !a.categoryId?.startsWith('INCOME')).reduce((total, a) => total + a.amount, 0));
  }

  onSelectCategory(): void {
    this.picking = true;
    this.focus.next(0);
  }

  onCategorySelected(category: string | undefined): void {
    this.picking = false;
    this.selectedCategory = this.categories?.find(a => a.id === category);
  }

  onSave(): void {
    if (this.selectedCategory) {
      const amount = this.selectedCategory.group === 'INCOME' ? -(this.form.value.amount ?? 0) : +(this.form.value.amount ?? 0);
      this.db.Budgets.upsert$({ categoryId: this.selectedCategory.id, amount }).subscribe();
      this.onClose();
    }
  }

  onClose(): void {
    this.close.emit();
  }

}
