import { describe, expect, test, vi } from 'vitest';
import { makeRecord } from '@/lib/fixtures';

const listEmergency = vi.fn();
vi.mock('@munyeon/db', () => ({ getSql: () => ({}), resetSql: async () => {}, configurePool: () => {}, listEmergency: (...a: unknown[]) => listEmergency(...a) }));

const { GET } = await import('./route');

describe('GET /api/emergency (D78)', () => {
  test('grid-shaped list with the ER phone first, cached for a day', async () => {
    listEmergency.mockResolvedValue([
      { ...makeRecord({ id: 'E1', kind: 'hospital', category: 'general', tel: '02-123-4567' }), erTel: '02-111-0119' },
      { ...makeRecord({ id: 'E2', kind: 'hospital', category: 'general', tel: '02-222-2222' }), erTel: null },
    ]);
    const res = await GET();
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=86400, stale-while-revalidate=3600');
    const body = await res.json();
    expect(body.items.map((t: unknown[]) => [t[0], t[4]])).toEqual([['E1', '02-111-0119'], ['E2', '02-222-2222']]);
  });
});
