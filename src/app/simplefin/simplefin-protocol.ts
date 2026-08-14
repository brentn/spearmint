// SimpleFIN protocol v2 (?version=2) response shapes and pure request-building helpers.
// Field names and behavior per .scratch/spearmint-rebuild/issues/10-research-notes.md
// (empirical testing against beta-bridge.simplefin.org) and simplefin.org/protocol.html.

export interface SimplefinError {
  code: string; // 'gen.*' | 'con.*' | 'act.*'
  msg: string;
  conn_id?: string;
  account_id?: string;
}

export interface SimplefinConnection {
  conn_id: string;
  name: string;
  org_id: string;
  org_name: string;
  org_url: string | null;
  sfin_url?: string;
}

export interface SimplefinTransaction {
  id: string;
  posted: number; // epoch seconds
  amount: string; // decimal string, positive = deposit
  description: string;
  pending?: boolean;
}

export interface SimplefinAccount {
  id: string;
  name: string;
  currency: string;
  balance: string; // decimal string
  'balance-date': number; // epoch seconds
  conn_id: string;
  transactions: SimplefinTransaction[];
}

export interface SimplefinAccountSet {
  errlist: SimplefinError[];
  connections?: SimplefinConnection[];
  accounts: SimplefinAccount[];
}

/** A SimpleFIN Token is a base64-encoded claim URL (protocol.html §"Token Flow"). */
export function decodeSetupToken(setupToken: string): string {
  let decoded: string;
  try {
    decoded = atob(setupToken.trim());
  } catch {
    throw new Error('That setup token is not valid base64.');
  }
  if (!/^https?:\/\//.test(decoded)) {
    throw new Error('That setup token did not decode to a claim URL.');
  }
  return decoded;
}

export interface ParsedAccessUrl {
  /** Origin + path, with any embedded Basic Auth credentials stripped. */
  baseUrl: string;
  authorizationHeader: string;
}

/**
 * Access URLs come back from the claim endpoint with Basic Auth credentials embedded
 * (e.g. https://user:pass@bridge.simplefin.org/simplefin). Chromium blocks fetch()/XHR
 * to URLs with an embedded userinfo component, so credentials are pulled out here and
 * sent as an explicit Authorization header instead — confirmed to work equally well in
 * the CORS research (10-research-notes.md).
 */
export function parseAccessUrl(accessUrl: string): ParsedAccessUrl {
  const url = new URL(accessUrl);
  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  url.username = '';
  url.password = '';
  return {
    baseUrl: url.toString().replace(/\/$/, ''),
    authorizationHeader: `Basic ${btoa(`${username}:${password}`)}`,
  };
}
