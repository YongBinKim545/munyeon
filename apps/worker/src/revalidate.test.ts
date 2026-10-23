import { describe, expect, test, vi } from 'vitest';
import { isTrustedBaseUrl, MAX_REGIONS, MAX_REVALIDATE, requestRevalidate } from './revalidate.ts';

const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'pharmacy' as const, id: `C${i}` }));
const BASE = 'https://app.vercel.app';

describe('requestRevalidate', () => {
  test('sends bearer token and JSON body', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    const r = await requestRevalidate(ids(2), { baseUrl: `${BASE}/`, secret: 's3cret', fetchImpl });
    expect(r).toBe('sent');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(`${BASE}/api/revalidate`);
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer s3cret');
    expect(JSON.parse(String(init!.body))).toEqual({ items: ids(2) });
  });

  test('never sends the secret to an untrusted address', async () => {
    const fetchImpl = vi.fn();
    for (const baseUrl of ['https://example.com', 'http://app.vercel.app', 'https://vercel.app.example.com', 'not a url']) {
      expect(await requestRevalidate(ids(1), { baseUrl, secret: 's', fetchImpl })).toBe('untrusted');
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test(`skips when more than ${MAX_REVALIDATE}`, async () => {
    const fetchImpl = vi.fn();
    expect(await requestRevalidate(ids(MAX_REVALIDATE + 1), { baseUrl: BASE, secret: 's', fetchImpl })).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('sends the regions of changed institutions too (P0-10)', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 }));
    const regions = [{ kind: 'pharmacy' as const, sido: '서울특별시', sigungu: '마포구' }];
    expect(await requestRevalidate(ids(1), { baseUrl: BASE, secret: 's', fetchImpl }, regions)).toBe('sent');
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]!.body))).toEqual({ items: ids(1), regions });
  });

  test('too many institutions still sends the regions, too many regions still sends the institutions', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 }));
    const one = [{ kind: 'pharmacy' as const, sido: '서울특별시', sigungu: '마포구' }];
    await requestRevalidate(ids(MAX_REVALIDATE + 1), { baseUrl: BASE, secret: 's', fetchImpl }, one);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]!.body))).toEqual({ items: [], regions: one });
    const many = Array.from({ length: MAX_REGIONS + 1 }, (_, i) => ({ kind: 'pharmacy' as const, sido: '서울특별시', sigungu: `구${i}` }));
    await requestRevalidate(ids(1), { baseUrl: BASE, secret: 's', fetchImpl }, many);
    expect(JSON.parse(String(fetchImpl.mock.calls[1]![1]!.body))).toEqual({ items: ids(1) });
  });

  test('nothing to send', async () => {
    const fetchImpl = vi.fn();
    expect(await requestRevalidate([], { baseUrl: BASE, secret: 's', fetchImpl })).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('failure does not throw', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('down'); });
    expect(await requestRevalidate(ids(1), { baseUrl: BASE, secret: 's', fetchImpl })).toBe('failed');
    const bad = vi.fn(async () => new Response('no', { status: 401 }));
    expect(await requestRevalidate(ids(1), { baseUrl: BASE, secret: 's', fetchImpl: bad })).toBe('failed');
  });
});

describe('isTrustedBaseUrl', () => {
  test('https vercel deployments and our own domain only (D44)', () => {
    expect(isTrustedBaseUrl('https://app-git-x.vercel.app')).toBe(true);
    expect(isTrustedBaseUrl('https://findmedi.co.kr')).toBe(true);
    expect(isTrustedBaseUrl('https://www.findmedi.co.kr/')).toBe(true);
    expect(isTrustedBaseUrl('http://findmedi.co.kr')).toBe(false);
    expect(isTrustedBaseUrl('https://munyeon.kr')).toBe(false);
    expect(isTrustedBaseUrl('https://example.com')).toBe(false);
    expect(isTrustedBaseUrl('https://example.com', ['example.com'])).toBe(true);
    expect(isTrustedBaseUrl('http://example.com', ['example.com'])).toBe(false);
  });
});
