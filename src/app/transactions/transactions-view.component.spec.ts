import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionsViewComponent } from './transactions-view.component';

describe('TransactionsViewComponent', () => {
  let component: TransactionsViewComponent;
  let fixture: ComponentFixture<TransactionsViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TransactionsViewComponent]
    });
    fixture = TestBed.createComponent(TransactionsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
