import { beforeEach, describe, expect, test, vi } from 'vitest';

const insertEvent = vi.fn(async () => {});
vi.mock('@munyeon/db', () => ({
  getSql: () => ({}),
  insertEvent: (...a: unknown[]) => insertEvent(...(a as [])),
  EVENT_TYPES: ['tel_tap', 'tel_copy', 'directions_tap', 'search_select', 'locate_ok', 'locate_fail', 'show_all'],
}));

const { POST, RATE_LIMIT, resetRateLimit } = await import('./route');
const post = (body: string) => POST(new Request('http://localhost/api/events', { method: 'POST', body }));

beforeEach(() => {
  insertEvent.mockClear();
  resetRateLimit();
});

describe('POST /api/events', () => {
  test('stores only type, institution and page', async () => {
    const res = await post(JSON.stringify({ type: 'tel_tap', institutionId: 'C1100005', page: 'detail', lat: 37.5, ua: 'x' }));
    expect(res.status).toBe(204);
    expect(insertEvent).toHaveBeenCalledWith({}, { type: 'tel_tap', institutionId: 'C1100005', page: 'detail' });
  });

  test('null institution is allowed (search)', async () => {
    expect((await post(JSON.stringify({ type: 'search_select', institutionId: null, page: 'search' }))).status).toBe(204);
    for (const type of ['locate_ok', 'locate_fail', 'show_all']) {
      expect((await post(JSON.stringify({ type, institutionId: null, page: 'home' }))).status).toBe(204);
    }
  });

  test.each([
    ['unknown type', JSON.stringify({ type: 'call_119_open', institutionId: 'A1', page: 'detail' })],
    ['bad id', JSON.stringify({ type: 'tel_tap', institutionId: "1'; drop", page: 'detail' })],
    ['bad page', JSON.stringify({ type: 'tel_tap', institutionId: 'A1', page: 'Detail Page!' })],
    ['not json', 'hello'],
    ['null body', 'null'],
    ['array body', '[1]'],
  ])('%s → 400', async (_n, body) => {
    expect((await post(body)).status).toBe(400);
    expect(insertEvent).not.toHaveBeenCalled();
  });

  test('body over 1KB → 413', async () => {
    expect((await post('x'.repeat(1025))).status).toBe(413);
  });
});

test('per-instance rate limit returns 429 without writing', async () => {
  const ok = JSON.stringify({ type: 'tel_tap', institutionId: 'A1', page: 'detail' });
  for (let i = 0; i < RATE_LIMIT; i++) expect((await post(ok)).status).toBe(204);
  expect((await post(ok)).status).toBe(429);
  expect(insertEvent).toHaveBeenCalledTimes(RATE_LIMIT);
});
