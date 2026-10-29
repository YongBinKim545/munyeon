import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeRecord } from '@/lib/fixtures';

const listRegion = vi.fn();
vi.mock('@munyeon/db', () => ({ getSql: () => ({}), resetSql: async () => {}, configurePool: () => {}, listRegion: (...a: unknown[]) => listRegion(...a) }));

const { GET } = await import('./route');
const call = (kind: string, qs: string) => GET(new Request(`http://localhost/api/region/${kind}?${qs}`), { params: Promise.resolve({ kind }) });
const q = (sido: string, sigungu: string) => `sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}`;

beforeEach(() => listRegion.mockReset());

describe('GET /api/region/{kind} (D80)', () => {
  test('rejects bad kind, unknown sido or bad sigungu', async () => {
    for (const [k, s] of [['clinic', q('서울특별시', '마포구')], ['pharmacy', q('서울시', '마포구')], ['pharmacy', q('서울특별시', '')], ['pharmacy', q('서울특별시', 'a/b')]]) {
      expect((await call(k!, s!)).status).toBe(400);
    }
    expect(listRegion).not.toHaveBeenCalled();
  });

  test('grid-shaped region list with a CDN cache header and no live status', async () => {
    listRegion.mockResolvedValue([makeRecord()]);
    const res = await call('pharmacy', q('서울특별시', '마포구'));
    expect(res.status).toBe(200);
    expect(listRegion).toHaveBeenCalledWith({}, '서울특별시', '마포구', 'pharmacy');
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=3600, stale-while-revalidate=3600');
    const text = await res.text();
    expect(JSON.parse(text).items).toHaveLength(1);
    expect(text).not.toMatch(/영업 중|곧 마감|영업 종료/);
  });
});
