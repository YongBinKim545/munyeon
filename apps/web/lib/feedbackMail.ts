import { kstParts } from '@munyeon/core';
import { fieldLabel, type FeedbackValue } from './feedback';
import { SITE_URL } from './seo';

/**
 * 의견이 새로 저장되면 운영자 메일로 알린다(D79). 메일 발송은 Resend, 받는 주소는 환경변수 FEEDBACK_MAIL_TO.
 * 도메인 인증 없이 Resend 기본 보내는 주소로 계정 주인 메일에만 보낸다(운영자 알림 전용).
 * 키나 받는 주소가 없으면(로컬·미리 보기) 보내지 않는다. 실패해도 의견 저장·응답에는 영향이 없다.
 */
const RESEND_URL = 'https://api.resend.com/emails';
const FROM = '찾아줘 메디 <onboarding@resend.dev>';
const KIND_LABEL = { pharmacy: '약국', hospital: '병원' } as const;

export function buildFeedbackMail(f: FeedbackValue, siteUrl: string = SITE_URL, at: Date = new Date()): { subject: string; text: string } {
  const base = siteUrl.replace(/\/$/, '');
  const { ymd, minute } = kstParts(at);
  const time = `${ymd} ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const lines: string[] = [];
  let subject: string;
  if (f.type === 'correction' && f.kind && f.institutionId) {
    subject = `[수정요청] ${KIND_LABEL[f.kind]} ${f.institutionId}`;
    lines.push(`항목: ${f.fields.map((x) => fieldLabel(x, f.kind!)).join(', ')}`);
    if (f.body) lines.push(`내용: ${f.body}`);
    lines.push(`기관: ${base}/${f.kind}/${f.institutionId}`);
  } else {
    subject = `[개선의견] ${f.body.replace(/\s+/g, ' ').slice(0, 40)}`;
    lines.push(`내용: ${f.body}`);
  }
  lines.push(`페이지: ${base}${f.path}`, `시각: ${time}`);
  return { subject, text: lines.join('\n') };
}

export async function sendFeedbackMail(
  f: FeedbackValue,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<'sent' | 'skipped' | 'failed'> {
  const key = env.RESEND_API_KEY;
  const to = env.FEEDBACK_MAIL_TO;
  if (!key || !to) return 'skipped';
  const { subject, text } = buildFeedbackMail(f);
  try {
    const res = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return 'sent';
    console.error(`[feedback-mail] 실패 ${res.status}`);
    return 'failed';
  } catch (e) {
    console.error(`[feedback-mail] 실패 ${e instanceof Error ? e.message : String(e)}`);
    return 'failed';
  }
}
