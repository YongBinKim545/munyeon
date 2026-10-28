import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchFullDataPage, parsePage, PortalError, redactKey } from './portal.ts';

const fx = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');
const KEY = 'secret+key/value==';

afterEach(() => vi.unstubAllEnvs());

describe('parsePage', () => {
  test('parses items and totalCount', () => {
    const page = parsePage(fx('hospital-sample.xml'));
    expect(page.totalCount).toBe(79006);
    expect(page.items).toHaveLength(4);
    expect(page.items[0]?.dutyTime1s).toBe('0900'); // 앞자리 0 유지
    expect(page.items[0]?.hpid).toBe('A1100001');
  });
  test('single item is still an array', () => expect(parsePage(fx('pharmacy-sample.xml')).items).toHaveLength(1));
  test('empty items with totalCount 0', () => {
    const xml = '<response><header><resultCode>00</resultCode></header><body><items/><totalCount>0</totalCount></body></response>';
    expect(parsePage(xml)).toEqual({ totalCount: 0, items: [] });
  });
  test('throws PortalError on quota envelope', () => {
    expect(() => parsePage(fx('quota-error.xml'))).toThrow(PortalError);
    try { parsePage(fx('quota-error.xml')); } catch (e) { expect((e as PortalError).code).toBe('22'); }
  });
  test('throws PortalError when resultCode is not 00', () => expect(() => parsePage(fx('result-error.xml'))).toThrow(PortalError));
  test('throws PortalError on non-XML body', () => expect(() => parsePage('API not found')).toThrow(PortalError));
});

describe('redactKey', () => {
  test('hides serviceKey', () =>
    expect(redactKey('https://x?serviceKey=abc%2Bdef&pageNo=1')).toBe('https://x?serviceKey=***&pageNo=1'));
  test('hides raw key value anywhere', () => {
    vi.stubEnv('DATA_GO_KR_KEY', KEY);
    expect(redactKey(`boom ${KEY} ${encodeURIComponent(KEY)}`)).toBe('boom *** ***');
  });
});

describe('fetchFullDataPage', () => {
  const ok = () => new Response(fx('pharmacy-sample.xml'), { status: 200 });

  test('builds request with encoded key and paging', async () => {
    vi.stubEnv('DATA_GO_KR_KEY', KEY);
    const fetchImpl = vi.fn(async () => ok());
    await fetchFullDataPage('pharmacy', 2, 10000, { fetchImpl, retryDelayMs: 0 });
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/B552657/ErmctInsttInfoInqireService/getParmacyFullDown');
    expect(url.searchParams.get('serviceKey')).toBe(KEY);
    expect(url.searchParams.get('pageNo')).toBe('2');
    expect(url.searchParams.get('numOfRows')).toBe('10000');
  });

  test('retries then succeeds', async () => {
    vi.stubEnv('DATA_GO_KR_KEY', KEY);
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response('busy', { status: 502 }))
      .mockResolvedValueOnce(ok());
    const page = await fetchFullDataPage('pharmacy', 1, 10, { fetchImpl, retryDelayMs: 0 });
    expect(page.items).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test('surfaces redacted error after retries', async () => {
    vi.stubEnv('DATA_GO_KR_KEY', KEY);
    const fetchImpl = vi.fn(async (url: string) => { throw new Error(`failed ${url}`); });
    const err = await fetchFullDataPage('pharmacy', 1, 10, { fetchImpl, retryDelayMs: 0, retries: 2 }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).not.toContain(encodeURIComponent(KEY));
    expect(String((err as Error).message)).not.toContain(KEY);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test('"fetch failed" carries the network cause code', async () => {
    vi.stubEnv('DATA_GO_KR_KEY', KEY);
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed', { cause: Object.assign(new Error('read'), { code: 'ECONNRESET' }) });
    });
    const err = await fetchFullDataPage('pharmacy', 1, 10, { fetchImpl, retryDelayMs: 0, retries: 0 }).catch((e: Error) => e);
    expect((err as Error).message).toContain('fetch failed (ECONNRESET)');
  });

  test('retry waits follow retryDelaysMs when given', async () => {
    vi.useFakeTimers();
    vi.stubEnv('DATA_GO_KR_KEY', KEY);
    const fetchImpl = vi.fn(async () => { throw new Error('down'); });
    const p = fetchFullDataPage('pharmacy', 1, 10, { fetchImpl, retryDelaysMs: [30_000, 60_000, 120_000] }).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    await p;
    vi.useRealTimers();
  });

  test('quota error is not retried', async () => {
    vi.stubEnv('DATA_GO_KR_KEY', KEY);
    const fetchImpl = vi.fn(async () => new Response(fx('quota-error.xml'), { status: 200 }));
    await expect(fetchFullDataPage('pharmacy', 1, 10, { fetchImpl, retryDelayMs: 0 })).rejects.toThrow(PortalError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('missing key fails fast', async () => {
    vi.stubEnv('DATA_GO_KR_KEY', '');
    await expect(fetchFullDataPage('pharmacy', 1)).rejects.toThrow(/DATA_GO_KR_KEY/);
  });
});
