import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeSummary } from '@/lib/fixtures';

const searchInstitutions = vi.fn();
vi.mock('@munyeon/db', () => ({ getSql: () => ({}), searchInstitutions: (...a: unknown[]) => searchInstitutions(...a) }));

const { GET } = await import('./route');
const call = (q: string) => GET(new Request(`http://localhost/api/search?q=${encodeURIComponent(q)}`));

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
    expect(searchInstitutions).toHaveBeenCalledWith({}, '시청', 10);
    expect(await res.json()).toEqual({
      items: [{ id: 'C1', kind: 'pharmacy', name: '시청약국', sido: '서울특별시', sigungu: '중구', tel: '02-777-0001', badge: '약국' }],
    });
  });
});
