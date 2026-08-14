import { TestBed } from '@angular/core/testing';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simplefinLinkSchema } from '../data/schemas';
import { DatabaseService } from '../data/database.service';
import { SimplefinApiService } from './simplefin-api.service';
import { SimplefinLinkService } from './simplefin-link.service';

describe('SimplefinLinkService', () => {
  let fakeDb: RxDatabase;
  let claimSetupToken: ReturnType<typeof vi.fn>;
  let service: SimplefinLinkService;

  beforeEach(async () => {
    fakeDb = await createRxDatabase({
      name: `simplefin-link-test-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    });
    await fakeDb.addCollections({ simplefinLinks: { schema: simplefinLinkSchema } });

    claimSetupToken = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        SimplefinLinkService,
        { provide: DatabaseService, useValue: { getDatabase: () => Promise.resolve(fakeDb) } },
        { provide: SimplefinApiService, useValue: { claimSetupToken } },
      ],
    });
    service = TestBed.inject(SimplefinLinkService);
  });

  afterEach(async () => {
    await fakeDb.remove();
  });

  it('claims a setup token and persists the resulting access URL', async () => {
    claimSetupToken.mockResolvedValue('https://demo:pass@bridge.simplefin.org/simplefin');

    await service.claim('some-setup-token');

    expect(claimSetupToken).toHaveBeenCalledWith('some-setup-token');
    const docs = await fakeDb['simplefinLinks'].find().exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].accessUrl).toBe('https://demo:pass@bridge.simplefin.org/simplefin');
    expect(docs[0].claimedAtUtc).toBeTruthy();
  });

  it('accumulates multiple claimed links rather than replacing the previous one', async () => {
    claimSetupToken
      .mockResolvedValueOnce('https://a:a@bridge.simplefin.org/simplefin')
      .mockResolvedValueOnce('https://b:b@bridge.simplefin.org/simplefin');

    await service.claim('token-a');
    await service.claim('token-b');

    const urls = await service.getAllAccessUrls();
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://a:a@bridge.simplefin.org/simplefin',
        'https://b:b@bridge.simplefin.org/simplefin',
      ])
    );
    expect(urls).toHaveLength(2);
  });

  it('propagates a claim failure without persisting anything', async () => {
    claimSetupToken.mockRejectedValue(new Error('bad token'));

    await expect(service.claim('bad-token')).rejects.toThrow('bad token');
    const docs = await fakeDb['simplefinLinks'].find().exec();
    expect(docs).toHaveLength(0);
  });
});
