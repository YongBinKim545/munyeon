import { describe, expect, test, vi } from 'vitest';
import { MAX_REVALIDATE, requestRevalidate } from './revalidate.ts';

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'pharmacy' as const, id: `C${i}` }));

describe('requestRevalidate', () => {
  test('sends bearer token and JSON body', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    const r = await requestRevalidate(ids(2), { baseUrl: 'https://munyeon.kr', secret: 's3cret', fetchImpl });
    expect(r).toBe('sent');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://munyeon.kr/api/revalidate');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer s3cret');
    expect(JSON.parse(String(init!.body))).toEqual({ items: ids(2) });
  });

  test(`skips when more than ${MAX_REVALIDATE}`, async () => {
    const fetchImpl = vi.fn();
    expect(await requestRevalidate(ids(MAX_REVALIDATE + 1), { baseUrl: 'https://x', secret: 's', fetchImpl })).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('nothing to send', async () => {
    const fetchImpl = vi.fn();
    expect(await requestRevalidate([], { baseUrl: 'https://x', secret: 's', fetchImpl })).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('failure does not throw', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('down'); });
    expect(await requestRevalidate(ids(1), { baseUrl: 'https://x', secret: 's', fetchImpl })).toBe('failed');
    const bad = vi.fn(async () => new Response('no', { status: 401 }));
    expect(await requestRevalidate(ids(1), { baseUrl: 'https://x', secret: 's', fetchImpl: bad })).toBe('failed');
  });
});
