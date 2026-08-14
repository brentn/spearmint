import { describe, expect, it } from 'vitest';
import { decodeSetupToken, parseAccessUrl } from './simplefin-protocol';

describe('decodeSetupToken', () => {
  it('decodes a base64 token to its claim URL', () => {
    const token = btoa('https://bridge.simplefin.org/simplefin/claim/demo');
    expect(decodeSetupToken(token)).toBe('https://bridge.simplefin.org/simplefin/claim/demo');
  });

  it('trims surrounding whitespace before decoding', () => {
    const token = `  ${btoa('https://bridge.simplefin.org/simplefin/claim/demo')}  \n`;
    expect(decodeSetupToken(token)).toBe('https://bridge.simplefin.org/simplefin/claim/demo');
  });

  it('rejects non-base64 input', () => {
    expect(() => decodeSetupToken('not base64!! @@')).toThrow();
  });

  it('rejects base64 that decodes to something other than a URL', () => {
    expect(() => decodeSetupToken(btoa('just some text'))).toThrow();
  });
});

describe('parseAccessUrl', () => {
  it('splits embedded Basic Auth credentials into an Authorization header', () => {
    const parsed = parseAccessUrl('https://demoUser:demoPass@bridge.simplefin.org/simplefin');
    expect(parsed.baseUrl).toBe('https://bridge.simplefin.org/simplefin');
    expect(parsed.authorizationHeader).toBe(`Basic ${btoa('demoUser:demoPass')}`);
  });

  it('handles URL-encoded special characters in credentials', () => {
    const parsed = parseAccessUrl('https://user%40x:p%40ss@bridge.simplefin.org/simplefin');
    expect(parsed.authorizationHeader).toBe(`Basic ${btoa('user@x:p@ss')}`);
  });
});
