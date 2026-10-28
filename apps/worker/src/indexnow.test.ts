import { describe, expect, test, vi } from 'vitest';
import { INDEXNOW_KEY, indexNowUrls, MAX_INDEXNOW, submitIndexNow } from './indexnow.ts';

const BASE = 'https://findmedi.co.kr';
const enc = encodeURIComponent;

describe('indexNowUrls (P1-1, D75)', () => {
  test('detail pages and their region screens, same paths as the web', () => {
    expect(
      indexNowUrls(
        [{ kind: 'pharmacy', id: 'C1100005' }, { kind: 'hospital', id: 'A1' }],
        [{ kind: 'pharmacy', sido: '서울특별시', sigungu: '마포구' }, { kind: 'hospital', sido: '서울특별시', sigungu: '마포구' }],
        BASE,
      ),
    ).toEqual([
      `${BASE}/pharmacy/C1100005`,
      `${BASE}/hospital/A1`,
      `${BASE}/${enc('서울특별시')}/${enc('마포구')}`,
      `${BASE}/${enc('서울특별시')}/${enc('마포구')}/${enc('병원')}`,
    ]);
  });

  test('no duplicates', () => {
    const r = { kind: 'pharmacy' as const, sido: '서울특별시', sigungu: '마포구' };
    expect(indexNowUrls([], [r, r], BASE)).toHaveLength(1);
  });
});

describe('submitIndexNow', () => {
  const urls = [`${BASE}/pharmacy/C1`];

  test('posts host, key, key location and urls to IndexNow', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    expect(await submitIndexNow(urls, { baseUrl: BASE, fetchImpl })).toBe('sent');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.indexnow.org/indexnow');
    expect(JSON.parse(String(init.body))).toEqual({
      host: 'findmedi.co.kr',
      key: INDEXNOW_KEY,
      keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    });
  });

  test('only for the official domain (not previews or other hosts)', async () => {
    const fetchImpl = vi.fn();
    expect(await submitIndexNow(urls, { baseUrl: 'https://munyeon-git-x.vercel.app', fetchImpl })).toBe('off');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('turned off by INDEXNOW_ENABLED=false', async () => {
    const fetchImpl = vi.fn();
    expect(await submitIndexNow(urls, { baseUrl: BASE, enabled: 'false', fetchImpl })).toBe('off');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('nothing changed → skipped; too many (first sync, bulk) → not sent', async () => {
    const fetchImpl = vi.fn();
    expect(await submitIndexNow([], { baseUrl: BASE, fetchImpl })).toBe('skipped');
    const many = Array.from({ length: MAX_INDEXNOW + 1 }, (_, i) => `${BASE}/pharmacy/C${i}`);
    expect(await submitIndexNow(many, { baseUrl: BASE, fetchImpl })).toBe('too-many');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('an error response or network failure is reported, not thrown', async () => {
    expect(await submitIndexNow(urls, { baseUrl: BASE, fetchImpl: async () => new Response('', { status: 429 }) })).toBe('failed 429');
    expect(await submitIndexNow(urls, { baseUrl: BASE, fetchImpl: async () => { throw new Error('down'); } })).toBe('failed');
  });
});
