import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password-hash.util';

describe('password-hash.util', () => {
  it('verifies the correct password against its own hash', async () => {
    const stored = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('correct horse battery staple', stored)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const stored = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('wrong password entirely', stored)).resolves.toBe(false);
  });

  it('salts each hash independently, so the same password hashes differently each time', async () => {
    const first = await hashPassword('same password twice');
    const second = await hashPassword('same password twice');

    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });
});
