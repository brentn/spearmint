import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { Observable, Subscription, map } from 'rxjs';
import { AppState } from 'src/app/app.module';
import { categories } from 'src/app/data/state/selectors';
import { Category } from 'src/app/data/types/category.type';

@Component({
  selector: 'category-picker',
  templateUrl: './category-picker.component.html',
  styleUrls: ['./category-picker.component.css']
})
export class CategoryPickerComponent {
  @Input() categoryId: string | undefined;
  @Output() cancel = new EventEmitter();
  @Output() select = new EventEmitter<string | undefined>();
  backIcon = faArrowLeft;
  subscriptions: Subscription[] = [];
  sortedCategories: Category[] = [];
  filteredCategories: Category[] = [];
  searchText = '';

  form = new FormGroup({
    search: new FormControl(''),
  });

  categories$ = this.store.select(categories);

  constructor(private store: Store<AppState>) { };

  ngOnInit(): void {
    this.subscriptions = [
      this.store.select(categories).pipe(
        map(categories => {
          const groups = [...new Set(categories.map((a: Category) => a.group))].sort();
          this.sortedCategories = groups.reduce((acc: Category[], group) => [...acc, ...categories.filter((a: Category) => a.group === group).sort((a: Category, b: Category) => b.id < a.id ? 1 : -1)], []);
          this.filterCategories();
        }),
      ).subscribe(),
      this.form.get('search')!.valueChanges.pipe(
        map(searchText => {
          this.searchText = searchText?.toLowerCase() ?? '';
          this.filterCategories();
        })
      ).subscribe()
    ]
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(a => a.unsubscribe());
  }

  onSelect(id: string): void {
    this.select.emit(id);
  }

  onCancel(evt: Event): void {
    evt.stopPropagation();
    this.cancel.emit();
  }

  private filterCategories(): void {
    this.filteredCategories = this.sortedCategories.filter(category => {
      return ((category.id + '|' + category.name).toLowerCase()).includes(this.searchText);
    });
  }
}

