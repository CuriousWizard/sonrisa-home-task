import { z } from 'zod';
import { LIMITS } from './common';
import { Role } from './enums';

// Trim and lowercase before the format check, so ' A@B.com ' is valid.
const Email = z.string().trim().toLowerCase().pipe(z.email().max(LIMITS.email));

export const RegisterInput = z.object({
  email: Email,
  password: z.string().min(LIMITS.passwordMin).max(LIMITS.passwordMax),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: Email,
  password: z.string().min(1).max(LIMITS.passwordMax),
});
export type LoginInput = z.infer<typeof LoginInput>;

export interface UserDto {
  id: string;
  email: string;
  role: Role;
}
