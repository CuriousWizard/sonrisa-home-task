// Fastify's error handler reads statusCode and sends { statusCode, error, message }.
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
