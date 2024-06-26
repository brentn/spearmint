import { Component, ElementRef, EventEmitter, Input, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Observable, Subscription, map } from 'rxjs';
import { Category } from 'src/app/data/types/category.type';

@Component({
  selector: 'category-picker',
  templateUrl: './category-picker.component.html',
  styleUrls: ['./category-picker.component.css']
})
export class CategoryPickerComponent {
  @Input() categoryId: string | undefined;
  @Input() categories: Category[] | undefined;
  @Input() focus: Observable<any> | undefined;
  @Output() cancel = new EventEmitter();
  @Output() select = new EventEmitter<string | undefined>();
  @ViewChild('search') search: ElementRef | undefined;
  backIcon = faArrowLeft;
  subscriptions: Subscription[] = [];
  sortedCategories: Category[] = [];
  filteredCategories: Category[] = [];
  expandedGroups: string[] = [];

  form = new FormGroup({
    search: new FormControl(''),
  });

  constructor() { };

  ngOnInit(): void {
    this.subscriptions = [
      this.form.get('search')!.valueChanges.pipe(
        map(() => {
          this.filterCategories();
        })
      ).subscribe(),
    ]
    if (this.focus) {
      this.subscriptions.push(this.focus?.subscribe(() => this.search?.nativeElement.focus()));
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories']) {
      this.sortedCategories = [...this.categories || []].sort((a, b) => a.id.localeCompare(b.id));
      this.filterCategories();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(a => a.unsubscribe());
  }

  get groups(): string[] {
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
    this.form.get('search')!.setValue('');
  }

  onCancel(evt: Event): void {
    evt.stopPropagation();
    this.cancel.emit();
    this.form.get('search')!.setValue('');
  }

  private filterCategories(): void {
    const searchText = this.form.get('search')!.value?.toLowerCase() || '';
    this.filteredCategories = searchText.split(' ').reduce((result: Category[], term) => result.filter(category => [category.id, category.name].join('|').toLowerCase().includes(term)), this.sortedCategories)

  }
}

