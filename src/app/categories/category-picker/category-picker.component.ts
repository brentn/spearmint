import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { Observable, Subject, Subscription, map } from 'rxjs';
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
  @Input() focus: Observable<any> | undefined;
  @Output() cancel = new EventEmitter();
  @Output() select = new EventEmitter<string | undefined>();
  @ViewChild('search') search: ElementRef | undefined;
  backIcon = faArrowLeft;
  subscriptions: Subscription[] = [];
  sortedCategories: Category[] = [];
  filteredCategories: Category[] = [];
  expandedGroups: string[] = [];
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
          this.sortedCategories = [...categories].sort((a, b) => a.id.localeCompare(b.id));
          this.filterCategories();
        }),
      ).subscribe(),
      this.form.get('search')!.valueChanges.pipe(
        map(searchText => {
          this.searchText = searchText?.toLowerCase() ?? '';
          this.filterCategories();
        })
      ).subscribe(),
    ]
    if (this.focus) {
      this.subscriptions.push(this.focus?.subscribe(() => this.search?.nativeElement.focus()));
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(a => a.unsubscribe());
  }

  get groups(): string[] {
    console.log('HERE', this.sortedCategories, this.filteredCategories)
    return [...new Set(this.filteredCategories.map(category => category.group))];
  }

  categoriesInGroup(group: string): Category[] {
    return this.filteredCategories.filter(category => category.group === group);
  }

  isExpanded(group: string): boolean {
    return this.expandedGroups.includes(group);
  }

  onToggle(group: string): void {
    if (this.expandedGroups.includes(group)) {
      this.expandedGroups = this.expandedGroups.filter(g => g !== group);
    } else {
      this.expandedGroups.push(group);
    }
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

