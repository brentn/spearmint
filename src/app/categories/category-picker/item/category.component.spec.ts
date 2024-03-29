import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryItemComponent } from './category.component';

describe('CategoryComponent', () => {
  let component: CategoryItemComponent;
  let fixture: ComponentFixture<CategoryItemComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CategoryItemComponent]
    });
    fixture = TestBed.createComponent(CategoryItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
