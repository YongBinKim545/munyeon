import { beforeEach, describe, expect, test, vi } from 'vitest';

const insertFeedback = vi.fn(async () => true);
vi.mock('@munyeon/db', () => ({
  getSql: () => ({}),
  insertFeedback: (...a: unknown[]) => insertFeedback(...(a as [])),
}));

const { POST, RATE_LIMIT, resetRateLimit } = await import('./route');
const post = (body: string) => POST(new Request('http://localhost/api/feedback', { method: 'POST', body, headers: { 'x-forwarded-for': '1.2.3.4' } }));

beforeEach(() => {
  insertFeedback.mockClear();
  insertFeedback.mockResolvedValue(true);
  resetRateLimit();
});

describe('POST /api/feedback (D49)', () => {
  test('stores only validated fields, never the IP', async () => {
    const res = await post(JSON.stringify({ type: 'correction', kind: 'pharmacy', institutionId: 'C1', fields: ['tel'], text: ' 02-111-2222 ', path: '/pharmacy/C1', ua: 'x' }));
    expect(res.status).toBe(204);
    expect(insertFeedback).toHaveBeenCalledWith({}, { type: 'correction', body: '02-111-2222', fields: ['tel'], kind: 'pharmacy', institutionId: 'C1', path: '/pharmacy/C1' });
    expect(JSON.stringify(insertFeedback.mock.calls)).not.toContain('1.2.3.4');
  });

  test('a duplicate within 10 minutes still answers 204', async () => {
    insertFeedback.mockResolvedValue(false);
    expect((await post(JSON.stringify({ type: 'opinion', text: '좋아요', path: '/' }))).status).toBe(204);
  });

  test('invalid input → 400 with the message, nothing stored', async () => {
    const res = await post(JSON.stringify({ type: 'opinion', text: '', path: '/' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: '내용을 적어 주세요' });
    expect((await post('not json')).status).toBe(400);
    expect(insertFeedback).not.toHaveBeenCalled();
  });

  test('body over 4KB → 413', async () => {
    expect((await post('x'.repeat(4097))).status).toBe(413);
  });

  test('per-instance rate limit → 429', async () => {
    const ok = (i: number) => JSON.stringify({ type: 'opinion', text: `의견 ${i}`, path: '/' });
    for (let i = 0; i < RATE_LIMIT; i++) expect((await post(ok(i))).status).toBe(204);
    expect((await post(ok(999))).status).toBe(429);
  });
});
