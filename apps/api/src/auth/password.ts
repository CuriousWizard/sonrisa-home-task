import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const POSITIVE_INT = /^[1-9][0-9]*$/;

function deriveKey(
  password: string,
  salt: Buffer,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await deriveKey(password, salt, { N, r: R, p: P });
  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, n, r, p, saltText, hashText] = parts;
  if (
    ![n, r, p].every((value) => POSITIVE_INT.test(value)) ||
    !BASE64URL.test(saltText) ||
    !BASE64URL.test(hashText)
  ) {
    return false;
  }
  const salt = Buffer.from(saltText, 'base64url');
  const expected = Buffer.from(hashText, 'base64url');
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) {
    return false;
  }
  try {
    const actual = await deriveKey(password, salt, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    // scrypt rejects parameters such as an N that is not a power of two.
    return false;
  }
}
