import { HttpErrorResponse } from '@angular/common/http';

// The API sends { statusCode, error, message } for every error.
export function serverMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
    ) {
      return body.message;
    }
    if (error.status === 0) {
      return 'The server cannot be reached. Try again later.';
    }
  }
  return 'Something went wrong. Try again.';
}

// Maps zod issues to one message per top-level field.
export function fieldErrors<K extends string>(
  issues: readonly { path: readonly PropertyKey[] }[],
  messages: Record<K, string>,
): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && key in messages) {
      errors[key as K] = messages[key as K];
    }
  }
  return errors;
}
