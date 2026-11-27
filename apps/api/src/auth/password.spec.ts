import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('verifies the right password', async () => {
    const stored = await hashPassword('correct horse battery');
    await expect(verifyPassword('correct horse battery', stored)).resolves.toBe(
      true,
    );
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery');
    await expect(verifyPassword('wrong horse battery', stored)).resolves.toBe(
      false,
    );
  });

  it('returns false for a malformed stored value', async () => {
    const stored = await hashPassword('correct horse battery');
    const [, , , , salt, hash] = stored.split('$');
    const malformed = [
      '',
      'not-a-hash',
      `bcrypt$16384$8$1$${salt}$${hash}`,
      `scrypt$16384$8$1$${salt}`,
      `scrypt$16384$8$1$${salt}$${hash}$extra`,
      `scrypt$abc$8$1$${salt}$${hash}`,
      // scrypt throws for an N that is not a power of two.
      `scrypt$16383$8$1$${salt}$${hash}`,
      `scrypt$16384$8$1$${salt}$${hash.slice(0, 20)}`,
      `scrypt$16384$8$1$${salt}$not+base64url`,
    ];
    for (const value of malformed) {
      await expect(
        verifyPassword('correct horse battery', value),
        value,
      ).resolves.toBe(false);
    }
  });

  it('produces a different hash each time for the same password', async () => {
    const first = await hashPassword('correct horse battery');
    const second = await hashPassword('correct horse battery');
    expect(first).not.toBe(second);
    await expect(verifyPassword('correct horse battery', second)).resolves.toBe(
      true,
    );
  });
});
