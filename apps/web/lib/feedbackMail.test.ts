import { describe, expect, test, vi } from 'vitest';
import { buildFeedbackMail, sendFeedbackMail } from './feedbackMail';

const correction = { type: 'correction' as const, body: '02-111-2222로 바뀌었어요', fields: ['tel', 'hours'] as ('tel' | 'hours')[], kind: 'hospital' as const, institutionId: 'A1', path: '/hospital/A1' };
const opinion = { type: 'opinion' as const, body: '지도 보기도 있으면 좋겠어요', fields: [], kind: null, institutionId: null, path: '/' };
const at = new Date('2026-10-29T05:07:00Z'); // 14:07 KST

describe('buildFeedbackMail', () => {
  test('correction: kind in the subject, fields with labels, detail link, KST time', () => {
    const m = buildFeedbackMail(correction, 'https://findmedi.co.kr', at);
    expect(m.subject).toBe('[수정요청] 병원 A1');
    expect(m.text).toContain('항목: 전화번호, 진료시간');
    expect(m.text).toContain('내용: 02-111-2222로 바뀌었어요');
    expect(m.text).toContain('기관: https://findmedi.co.kr/hospital/A1');
    expect(m.text).toContain('시각: 2026-10-29 14:07');
  });

  test('opinion: page path, no institution line', () => {
    const m = buildFeedbackMail(opinion, 'https://findmedi.co.kr', at);
    expect(m.subject).toBe('[개선의견] 지도 보기도 있으면 좋겠어요');
    expect(m.text).toContain('페이지: https://findmedi.co.kr/');
    expect(m.text).not.toContain('기관:');
  });
});

describe('sendFeedbackMail', () => {
  const env = { RESEND_API_KEY: 'test-key', FEEDBACK_MAIL_TO: 'owner@example.com' };

  test('skipped without key or recipient (local, preview)', async () => {
    const f = vi.fn();
    expect(await sendFeedbackMail(opinion, {}, f)).toBe('skipped');
    expect(await sendFeedbackMail(opinion, { RESEND_API_KEY: 'k' }, f)).toBe('skipped');
    expect(f).not.toHaveBeenCalled();
  });

  test('posts to Resend with the key as a bearer token; the recipient comes from env', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    expect(await sendFeedbackMail(opinion, env, f)).toBe('sent');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(['owner@example.com']);
    expect(body.from).toBe('찾아줘 메디 <onboarding@resend.dev>');
    expect(body.subject).toContain('[개선의견]');
  });

  test('failures are reported, never thrown', async () => {
    expect(await sendFeedbackMail(opinion, env, vi.fn(async () => new Response('', { status: 403 })))).toBe('failed');
    expect(await sendFeedbackMail(opinion, env, vi.fn(async () => Promise.reject(new Error('down'))))).toBe('failed');
  });
});
