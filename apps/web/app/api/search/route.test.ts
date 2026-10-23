import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeSummary } from '@/lib/fixtures';

const searchInstitutions = vi.fn();
vi.mock('@munyeon/db', () => ({ getSql: () => ({}), resetSql: async () => {}, configurePool: () => {}, searchInstitutions: (...a: unknown[]) => searchInstitutions(...a) }));

const { GET } = await import('./route');
const call = (q: string, g?: string) =>
  GET(new Request(`http://localhost/api/search?q=${encodeURIComponent(q)}${g === undefined ? '' : `&g=${g}`}`));

beforeEach(() => searchInstitutions.mockReset());

describe('GET /api/search', () => {
  test('rejects short or long queries', async () => {
    expect((await call('a')).status).toBe(400);
    expect((await call('가'.repeat(31))).status).toBe(400);
    expect(searchInstitutions).not.toHaveBeenCalled();
  });

  test('returns compact hits with cache header and no live status', async () => {
    searchInstitutions.mockResolvedValue([{ ...makeSummary({ id: 'C1', name: '시청약국' }), sido: '서울특별시', sigungu: '중구' }]);
    const res = await call(' 시청 ');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=3600');
    expect(searchInstitutions).toHaveBeenCalledWith({}, '시청', 20);
    expect(await res.json()).toEqual({
      items: [{ id: 'C1', kind: 'pharmacy', name: '시청약국', sido: '서울특별시', sigungu: '중구', tel: '02-777-0001', lat: 37.567, lon: 126.979, hours: { dutyTime8s: '1000', dutyTime8c: '1400' }, badge: '약국' }],
    });
  });

  test('g orders by that cell center; bad g is ignored', async () => {
    searchInstitutions.mockResolvedValue([]);
    await call('시청', '834_2267');
    expect(searchInstitutions).toHaveBeenLastCalledWith({}, '시청', 20, { lat: 834.5 * 0.045, lon: 2267.5 * 0.056 });
    await call('시청', 'f4173_11337');
    expect(searchInstitutions).toHaveBeenLastCalledWith({}, '시청', 20);
    await call('시청', '37.56_126.98');
    expect(searchInstitutions).toHaveBeenLastCalledWith({}, '시청', 20);
  });
});
