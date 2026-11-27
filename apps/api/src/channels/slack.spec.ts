import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSlackChannel } from './slack';

const message = { subject: 'Quake <alert>', text: 'Magnitude 6 & rising' };

describe('Slack channel', () => {
  let server: Server;
  let prefix: string;
  const bodies: string[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        bodies.push(body);
        switch (request.url) {
          case '/hook/ok':
            response.writeHead(200).end('ok');
            break;
          case '/hook/fail':
            response.writeHead(500).end('error');
            break;
          case '/hook/redirect':
            response.writeHead(302, { location: '/hook/ok' }).end();
            break;
          case '/hook/slow':
            // Never answers, so the client deadline has to end the request.
            break;
          default:
            response.writeHead(404).end();
        }
      });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    prefix = `http://127.0.0.1:${port}/hook/`;
  });

  afterEach(() => {
    bodies.length = 0;
  });

  afterAll(async () => {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  });

  function channel() {
    return createSlackChannel([prefix], { timeoutMs: 200 });
  }

  async function sendError(path: string): Promise<string> {
    const webhookUrl = `${prefix}${path}`;
    try {
      await channel().send({ webhookUrl }, message);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      expect(text).not.toContain(webhookUrl);
      expect(text).not.toContain('127.0.0.1');
      return text;
    }
    throw new Error('send resolved');
  }

  it('posts the formatted text and succeeds on 200', async () => {
    await channel().send({ webhookUrl: `${prefix}ok` }, message);
    expect(bodies).toHaveLength(1);
    expect(JSON.parse(bodies[0])).toEqual({
      text: '*Quake &lt;alert&gt;*\nMagnitude 6 &amp; rising',
    });
  });

  it('throws "Slack responded 500" on a 500', async () => {
    expect(await sendError('fail')).toBe('Slack responded 500');
  });

  it('throws on a redirect instead of following it', async () => {
    expect(await sendError('redirect')).toBe('Slack request failed');
    expect(bodies).toHaveLength(1);
  });

  it('throws "Slack request timed out" when the receiver does not answer', async () => {
    expect(await sendError('slow')).toBe('Slack request timed out');
  });

  it('checks the allowlist again before sending', async () => {
    const other = createSlackChannel(['https://hooks.slack.com/services/']);
    await expect(
      other.send({ webhookUrl: `${prefix}ok` }, message),
    ).rejects.toThrow('Webhook URL is not on the allowed list');
    expect(bodies).toHaveLength(0);
  });
});
