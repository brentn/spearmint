import { Injectable } from '@angular/core';
import { addDaysUtc, dateOnlyToEpochSeconds } from './date-only.util';
import { decodeSetupToken, parseAccessUrl, type SimplefinAccountSet } from './simplefin-protocol';
import type { SyncWindow } from './sync-window.util';

/**
 * Thin wrapper around SimpleFIN's HTTP API — no backend proxy, called directly from the
 * browser (validated in .scratch/spearmint-rebuild/issues/10-research-notes.md: both the
 * claim endpoint and /accounts return proper CORS headers on success and error alike).
 */
@Injectable({ providedIn: 'root' })
export class SimplefinApiService {
  async claimSetupToken(setupToken: string): Promise<string> {
    const claimUrl = decodeSetupToken(setupToken);
    const response = await fetch(claimUrl, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`SimpleFIN rejected that setup token (HTTP ${response.status})${await responseDetail(response)}`);
    }
    const accessUrl = (await response.text()).trim();
    if (!accessUrl) {
      throw new Error('SimpleFIN did not return an access URL for that setup token.');
    }
    return accessUrl;
  }

  /** end is inclusive on the DateOnly window; SimpleFIN's end-date param is exclusive. */
  async fetchAccounts(accessUrl: string, window: SyncWindow): Promise<SimplefinAccountSet> {
    const { baseUrl, authorizationHeader } = parseAccessUrl(accessUrl);
    const params = new URLSearchParams({
      version: '2',
      'start-date': String(dateOnlyToEpochSeconds(window.start)),
      'end-date': String(dateOnlyToEpochSeconds(addDaysUtc(window.end, 1))),
    });

    const response = await fetch(`${baseUrl}/accounts?${params.toString()}`, {
      headers: { Authorization: authorizationHeader },
    });
    if (!response.ok) {
      throw new Error(`SimpleFIN sync request failed (HTTP ${response.status})${await responseDetail(response)}`);
    }
    return (await response.json()) as SimplefinAccountSet;
  }
}

/** SimpleFIN error responses often carry a specific reason in the body; surface it when present. */
async function responseDetail(response: Response): Promise<string> {
  try {
    const body = (await response.text()).trim();
    return body ? `: ${body}` : '.';
  } catch {
    return '.';
  }
}
