import type { Kind } from './seo';

/** 개선의견·수정요청(D49). 브라우저(보내기 버튼 상태·안내)와 서버(/api/feedback)가 같은 규칙을 쓴다. */
export const MAX_FEEDBACK = 500;
export const CORRECTION_FIELDS = ['tel', 'hours', 'name', 'addr', 'closed', 'other'] as const;
export type CorrectionField = (typeof CORRECTION_FIELDS)[number];

export function fieldLabel(f: CorrectionField, kind: Kind): string {
  switch (f) {
    case 'tel': return '전화번호';
    case 'hours': return kind === 'hospital' ? '진료시간' : '영업시간';
    case 'name': return '상호';
    case 'addr': return '주소';
    case 'closed': return '폐업';
    case 'other': return '기타';
  }
}

export interface FeedbackValue {
  type: 'opinion' | 'correction';
  body: string;
  fields: CorrectionField[];
  kind: Kind | null;
  institutionId: string | null;
  path: string;
}

const ID_RE = /^[A-Za-z0-9]{1,20}$/;
const PATH_RE = /^\/[^\s?#]{0,200}$/;

/** 입력을 검사해 저장할 값만 남긴다. 실패하면 사용자에게 보여줄 안내 문구. */
export function validateFeedback(input: unknown): { ok: true; value: FeedbackValue } | { ok: false; error: string } {
  const bad = { ok: false as const, error: '보낼 수 없는 내용이에요' };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return bad;
  const i = input as Record<string, unknown>;
  const body = typeof i.text === 'string' ? i.text.trim() : '';
  if (body.length > MAX_FEEDBACK) return { ok: false, error: `${MAX_FEEDBACK}자까지 적을 수 있어요` };
  if (typeof i.path !== 'string' || !PATH_RE.test(i.path)) return bad;

  if (i.type === 'opinion') {
    if (!body) return { ok: false, error: '내용을 적어 주세요' };
    return { ok: true, value: { type: 'opinion', body, fields: [], kind: null, institutionId: null, path: i.path } };
  }
  if (i.type !== 'correction') return bad;
  if (i.kind !== 'pharmacy' && i.kind !== 'hospital') return bad;
  if (typeof i.institutionId !== 'string' || !ID_RE.test(i.institutionId)) return bad;
  if (!Array.isArray(i.fields)) return bad;
  const fields = [...new Set(i.fields)];
  if (!fields.every((f): f is CorrectionField => (CORRECTION_FIELDS as readonly unknown[]).includes(f))) return bad;
  if (fields.length === 0) return { ok: false, error: '틀린 항목을 골라 주세요' };
  if (fields.includes('other') && !body) return { ok: false, error: '기타 내용을 적어 주세요' };
  return { ok: true, value: { type: 'correction', body, fields, kind: i.kind, institutionId: i.institutionId, path: i.path } };
}
