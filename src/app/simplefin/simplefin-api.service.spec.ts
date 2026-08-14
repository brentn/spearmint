import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimplefinApiService } from './simplefin-api.service';

describe('SimplefinApiService', () => {
  let service: SimplefinApiService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({ providers: [SimplefinApiService] });
    service = TestBed.inject(SimplefinApiService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('claimSetupToken', () => {
    it('POSTs to the decoded claim URL and returns the access URL', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(' https://demo:pass@bridge.simplefin.org/simplefin \n'),
      });

      const token = btoa('https://bridge.simplefin.org/simplefin/claim/demo');
      const accessUrl = await service.claimSetupToken(token);

      expect(accessUrl).toBe('https://demo:pass@bridge.simplefin.org/simplefin');
      expect(fetchMock).toHaveBeenCalledWith('https://bridge.simplefin.org/simplefin/claim/demo', {
        method: 'POST',
      });
    });

    it('throws when the claim request fails', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 403 });
      const token = btoa('https://bridge.simplefin.org/simplefin/claim/demo');

      await expect(service.claimSetupToken(token)).rejects.toThrow(/403/);
    });

    it('throws when the claim response body is empty', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
      const token = btoa('https://bridge.simplefin.org/simplefin/claim/demo');

      await expect(service.claimSetupToken(token)).rejects.toThrow();
    });
  });

  describe('fetchAccounts', () => {
    it('sends an Authorization header derived from the access URL and the date-window query params', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ errlist: [], accounts: [] }),
      });

      await service.fetchAccounts('https://demo:pass@bridge.simplefin.org/simplefin', {
        start: '2026-08-01',
        end: '2026-08-13',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('https://bridge.simplefin.org/simplefin/accounts?');
      expect(url).toContain('version=2');
      expect(url).toContain(`start-date=${Date.UTC(2026, 7, 1) / 1000}`);
      // end-date is exclusive, so it lands on the day after the inclusive window end.
      expect(url).toContain(`end-date=${Date.UTC(2026, 7, 14) / 1000}`);
      expect(init.headers.Authorization).toBe(`Basic ${btoa('demo:pass')}`);
    });

    it('throws when the accounts request fails', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429 });

      await expect(
        service.fetchAccounts('https://demo:pass@bridge.simplefin.org/simplefin', {
          start: '2026-08-01',
          end: '2026-08-13',
        })
      ).rejects.toThrow(/429/);
    });

    it('returns the parsed account set on success', async () => {
      const body = { errlist: [], accounts: [{ id: 'acc-1' }] };
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) });

      const result = await service.fetchAccounts('https://demo:pass@bridge.simplefin.org/simplefin', {
        start: '2026-08-01',
        end: '2026-08-13',
      });

      expect(result).toEqual(body);
    });
  });
});
