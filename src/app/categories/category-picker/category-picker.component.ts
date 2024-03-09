import { Component, ElementRef, EventEmitter, Input, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { Observable, Subscription, filter, map, take, tap, withLatestFrom } from 'rxjs';
import { AppState } from 'src/app/app.module';
import { categories } from 'src/app/state/selectors';
import { Category } from 'src/app/state/types/category.type';

@Component({
  selector: 'category-picker',
  templateUrl: './category-picker.component.html',
  styleUrls: ['./category-picker.component.css']
})
export class CategoryPickerComponent {
  @Input() categoryId: number | undefined;
  @Output() cancel = new EventEmitter();
  @Output() select = new EventEmitter<number | undefined>();
  backIcon = faArrowLeft;
  subscriptions: Subscription[] = [];
  sortedCategories: Category[] = [];
  filteredCategories: Category[] = [];
  searchText = '';

  form = new FormGroup({
    search: new FormControl(''),
  });

  categories$ = this.store.select(categories).pipe(
  )

  constructor(private store: Store<AppState>) { };

  ngOnInit(): void {
    this.subscriptions = [
      this.store.select(categories).pipe(
        map(categories => {
          const parents = categories.filter(a => a.parentId === undefined).sort((a, b) => b.name < a.name ? 1 : -1);
          this.sortedCategories = parents.reduce((acc: Category[], parent) => [...acc, parent, ...categories.filter(a => a.parentId === parent.id).sort((a, b) => b.name < a.name ? 1 : -1)], []);
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

  parentName$(category: Category): Observable<string | undefined> {
    return this.categories$.pipe(map(cats => cats?.find(a => a.id === category.parentId)?.name));
  }

  onSelect(id: number): void {
    this.select.emit(id);
  }

  onCancel(evt: Event): void {
    evt.stopPropagation();
    this.cancel.emit();
  }

  private filterCategories(): void {
    this.filteredCategories = this.sortedCategories.filter(category => {
      const parentName = this.sortedCategories.find(a => a.id === category.parentId)?.name.toLowerCase() ?? '';
      return (parentName + ' - ' + category.name.toLowerCase()).includes(this.searchText);
    });
  }
}

