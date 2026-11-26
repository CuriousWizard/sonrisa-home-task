import { RegisterInput } from './auth';

describe('RegisterInput', () => {
  it('accepts a 10-character password', () => {
    const result = RegisterInput.safeParse({
      email: 'a@example.com',
      password: '0123456789',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a 9-character password', () => {
    const result = RegisterInput.safeParse({
      email: 'a@example.com',
      password: '012345678',
    });
    expect(result.success).toBe(false);
  });

  it('trims and lowercases the email', () => {
    const result = RegisterInput.parse({
      email: '  Alice@Example.COM ',
      password: '0123456789',
    });
    expect(result.email).toBe('alice@example.com');
  });
});
