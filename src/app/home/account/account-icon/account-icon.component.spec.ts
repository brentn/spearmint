import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountIconComponent } from './account-icon.component';

describe('AccountIconComponent', () => {
  let component: AccountIconComponent;
  let fixture: ComponentFixture<AccountIconComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AccountIconComponent]
    });
    fixture = TestBed.createComponent(AccountIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
