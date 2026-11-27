// Messages never contain the URL, because a webhook URL is a secret.
export class SlackUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlackUrlError';
  }
}

export function assertAllowedSlackUrl(
  raw: string,
  prefixes: readonly string[],
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SlackUrlError('Webhook URL is not a valid URL');
  }
  if (url.username !== '' || url.password !== '') {
    throw new SlackUrlError(
      'Webhook URL must not contain a username or password',
    );
  }
  // The parsed origin and path are normalized, so tricks such as "/../" or a query are already resolved.
  const location = url.origin + url.pathname;
  if (!prefixes.some((prefix) => location.startsWith(prefix))) {
    throw new SlackUrlError('Webhook URL is not on the allowed list');
  }
  return url;
}
