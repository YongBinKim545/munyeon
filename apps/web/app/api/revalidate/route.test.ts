import { beforeEach, describe, expect, test, vi } from 'vitest';

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const { POST } = await import('./route');
const post = (body: unknown, auth?: string) =>
  POST(new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  revalidatePath.mockClear();
  vi.stubEnv('REVALIDATE_SECRET', 'right-secret');
});

describe('POST /api/revalidate', () => {
  test('wrong or missing token → 401', async () => {
    expect((await post({ items: [] }, 'Bearer wrong')).status).toBe(401);
    expect((await post({ items: [] })).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test('revalidates each institution path', async () => {
    const res = await post({ items: [{ kind: 'pharmacy', id: 'C1' }, { kind: 'hospital', id: 'A2' }] }, 'Bearer right-secret');
    expect(res.status).toBe(200);
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(['/pharmacy/C1', '/hospital/A2']);
  });

  test('regions of changed institutions refresh their region pages once each (P0-10)', async () => {
    const res = await post({
      items: [],
      regions: [
        { kind: 'pharmacy', sido: '서울특별시', sigungu: '마포구' },
        { kind: 'hospital', sido: '서울특별시', sigungu: '마포구' },
      ],
    }, 'Bearer right-secret');
    expect(res.status).toBe(200);
    const paths = revalidatePath.mock.calls.map((c) => decodeURIComponent(c[0] as string));
    expect(paths).toEqual([
      '/서울특별시', '/서울특별시/마포구', '/서울특별시/마포구/병원', '/regions',
    ]);
  });

  test('invalid regions → 400 and nothing is revalidated', async () => {
    for (const regions of [[{ kind: 'pharmacy', sido: '없는도', sigungu: '구' }], [{ kind: 'pharmacy', sido: '서울특별시', sigungu: 'a/b' }], 'x']) {
      expect((await post({ items: [], regions }, 'Bearer right-secret')).status).toBe(400);
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test('too many or invalid items → 400', async () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ kind: 'pharmacy', id: `C${i}` }));
    expect((await post({ items: many }, 'Bearer right-secret')).status).toBe(400);
    expect((await post({ items: [{ kind: 'clinic', id: 'X' }] }, 'Bearer right-secret')).status).toBe(400);
    expect((await post({ items: [null] }, 'Bearer right-secret')).status).toBe(400);
    expect((await post(null, 'Bearer right-secret')).status).toBe(400);
  });

  test('unset secret refuses everything', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '');
    expect((await post({ items: [] }, 'Bearer ')).status).toBe(401);
  });
});
