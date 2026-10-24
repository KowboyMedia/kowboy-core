import { afterEach, describe, expect, it, vi } from 'vitest';
import { from, ses, signed } from './mail.js';

const keys = { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'secret', region: 'eu-north-1' };

describe('mail', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends through SES with the text, the HTML copy and a signed request', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{"MessageId":"1"}', { status: 200 });
    });
    await ses(
      keys,
      'noreply@mail.example',
    )({
      to: 'someone@example.com',
      subject: 'A problem',
      text: 'What happened.',
      html: '<p>What happened.</p>',
    });

    const [call] = calls;
    expect(call?.url).toBe('https://email.eu-north-1.amazonaws.com/v2/email/outbound-emails');
    expect(JSON.parse(String(call?.init.body))).toEqual({
      FromEmailAddress: 'noreply@mail.example',
      Destination: { ToAddresses: ['someone@example.com'] },
      Content: {
        Simple: {
          Subject: { Data: 'A problem', Charset: 'UTF-8' },
          Body: {
            Text: { Data: 'What happened.', Charset: 'UTF-8' },
            Html: { Data: '<p>What happened.</p>', Charset: 'UTF-8' },
          },
        },
      },
    });
    const headers = call?.init.headers as Record<string, string>;
    expect(headers['authorization']).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/eu-north-1\/ses\/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
  });

  it('signs the body, so another body or another time gives another signature', () => {
    const at = new Date('2026-10-24T02:00:00Z');
    const one = signed(
      keys,
      'email.eu-north-1.amazonaws.com',
      '/v2/email/outbound-emails',
      '{}',
      at,
    );
    expect(one['x-amz-date']).toBe('20261024T020000Z');
    const body = signed(
      keys,
      'email.eu-north-1.amazonaws.com',
      '/v2/email/outbound-emails',
      '[]',
      at,
    );
    const later = signed(
      keys,
      'email.eu-north-1.amazonaws.com',
      '/v2/email/outbound-emails',
      '{}',
      new Date('2026-10-24T02:00:01Z'),
    );
    expect(body['authorization']).not.toBe(one['authorization']);
    expect(later['authorization']).not.toBe(one['authorization']);
  });

  it('comes from the service by name, with the environment outside production', () => {
    expect(from('production', 'noreply@mail.example')).toBe('Kowboy Core <noreply@mail.example>');
    expect(from('staging', 'noreply@mail.example')).toBe(
      'Kowboy Core staging <noreply@mail.example>',
    );
  });

  it('throws with SES’s answer when the mail is refused', async () => {
    vi.stubGlobal(
      'fetch',
      async () => new Response('{"message":"Email address is not verified."}', { status: 400 }),
    );
    await expect(
      ses(keys, 'noreply@mail.example')({ to: 'someone@example.com', subject: 's', text: 't' }),
    ).rejects.toThrow('mail not sent: 400 {"message":"Email address is not verified."}');
  });
});
