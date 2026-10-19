import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeRecord } from '@/lib/fixtures';

const listGridCell = vi.fn();
vi.mock('@munyeon/db', () => ({ getSql: () => ({}), listGridCell: (...a: unknown[]) => listGridCell(...a) }));

const { GET } = await import('./route');
const call = (kind: string, cell: string) =>
  GET(new Request(`http://localhost/api/grid/${kind}/${cell}`), { params: Promise.resolve({ kind, cell }) });

beforeEach(() => listGridCell.mockReset());

describe('GET /api/grid/{kind}/{cell}', () => {
  test('rejects bad kind or cell', async () => {
    for (const [k, c] of [['clinic', '834_2267'], ['pharmacy', '834-2267'], ['pharmacy', '1_1'], ['pharmacy', '834.5_2267']]) {
      expect((await call(k!, c!)).status).toBe(400);
    }
    expect(listGridCell).not.toHaveBeenCalled();
  });

  test('returns cell payload with cache header and no live status', async () => {
    listGridCell.mockResolvedValue([makeRecord()]);
    const res = await call('pharmacy', '834_2267');
    expect(res.status).toBe(200);
    expect(listGridCell).toHaveBeenCalledWith({}, 'pharmacy', 834, 2267, 'coarse');
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=3600, stale-while-revalidate=3600');
    const text = await res.text();
    expect(JSON.parse(text).items).toHaveLength(1);
    expect(text).not.toMatch(/영업 중|곧 영업|곧 마감|전화 확인 필요|영업 종료/);
  });

  test('fine cell', async () => {
    listGridCell.mockResolvedValue([]);
    expect((await call('hospital', 'f4173_11337')).status).toBe(200);
    expect(listGridCell).toHaveBeenCalledWith({}, 'hospital', 4173, 11337, 'fine');
  });
});
