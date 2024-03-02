import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeBudgetsComponent } from './budgets.component';

describe('BudgetsComponent', () => {
  let component: HomeBudgetsComponent;
  let fixture: ComponentFixture<HomeBudgetsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [HomeBudgetsComponent]
    });
    fixture = TestBed.createComponent(HomeBudgetsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
