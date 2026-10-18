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
