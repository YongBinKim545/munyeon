import { beforeEach, describe, expect, test, vi } from 'vitest';

const insertFeedback = vi.fn(async () => true);
vi.mock('@munyeon/db', () => ({
  getSql: () => ({}), resetSql: async () => {}, configurePool: () => {},
  insertFeedback: (...a: unknown[]) => insertFeedback(...(a as [])),
}));

const sendFeedbackMail = vi.fn(async () => 'sent');
vi.mock('@/lib/feedbackMail', () => ({ sendFeedbackMail: (...a: unknown[]) => sendFeedbackMail(...(a as [])) }));
// 응답 뒤 작업(after)은 테스트에서 바로 실행한다
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }));

const { POST, RATE_LIMIT, resetRateLimit } = await import('./route');
const post = (body: string) => POST(new Request('http://localhost/api/feedback', { method: 'POST', body, headers: { 'x-forwarded-for': '1.2.3.4' } }));

beforeEach(() => {
  insertFeedback.mockClear();
  insertFeedback.mockResolvedValue(true);
  sendFeedbackMail.mockClear();
  resetRateLimit();
});

describe('POST /api/feedback (D49)', () => {
  test('stores only validated fields, never the IP', async () => {
    const res = await post(JSON.stringify({ type: 'correction', kind: 'pharmacy', institutionId: 'C1', fields: ['tel'], text: ' 02-111-2222 ', path: '/pharmacy/C1', ua: 'x' }));
    expect(res.status).toBe(204);
    expect(insertFeedback).toHaveBeenCalledWith({}, { type: 'correction', body: '02-111-2222', fields: ['tel'], kind: 'pharmacy', institutionId: 'C1', path: '/pharmacy/C1' });
    expect(JSON.stringify(insertFeedback.mock.calls)).not.toContain('1.2.3.4');
  });

  test('a duplicate within 10 minutes still answers 204, and sends no mail', async () => {
    insertFeedback.mockResolvedValue(false);
    expect((await post(JSON.stringify({ type: 'opinion', text: '좋아요', path: '/' }))).status).toBe(204);
    expect(sendFeedbackMail).not.toHaveBeenCalled();
  });

  test('a newly stored one is mailed to the operator after the response (D79)', async () => {
    expect((await post(JSON.stringify({ type: 'opinion', text: '좋아요', path: '/' }))).status).toBe(204);
    expect(sendFeedbackMail).toHaveBeenCalledWith({ type: 'opinion', body: '좋아요', fields: [], kind: null, institutionId: null, path: '/' });
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
