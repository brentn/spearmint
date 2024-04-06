import { TestBed } from '@angular/core/testing';

import { BankingConnectorService } from './banking-connector.service';

describe('DatabaseService', () => {
  let service: BankingConnectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BankingConnectorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
