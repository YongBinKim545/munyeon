import { describe, expect, test } from 'vitest';
import { CORRECTION_FIELDS, fieldLabel, MAX_FEEDBACK, validateFeedback } from './feedback';

describe('validateFeedback (D49)', () => {
  test('opinion needs text; trims and keeps only allowed keys', () => {
    expect(validateFeedback({ type: 'opinion', text: '   ', path: '/' })).toEqual({ ok: false, error: '내용을 적어 주세요' });
    expect(validateFeedback({ type: 'opinion', text: ' 글씨가 작아요 ', path: '/about', ip: '1.2.3.4' })).toEqual({
      ok: true,
      value: { type: 'opinion', body: '글씨가 작아요', fields: [], kind: null, institutionId: null, path: '/about' },
    });
  });

  test('correction needs at least one field; text optional unless 기타', () => {
    const base = { type: 'correction', kind: 'pharmacy', institutionId: 'C1100001', path: '/pharmacy/C1100001' };
    expect(validateFeedback({ ...base, fields: [], text: '' })).toEqual({ ok: false, error: '틀린 항목을 골라 주세요' });
    expect(validateFeedback({ ...base, fields: ['tel', 'hours'], text: '' })).toMatchObject({ ok: true, value: { fields: ['tel', 'hours'], body: '' } });
    expect(validateFeedback({ ...base, fields: ['other'], text: '' })).toEqual({ ok: false, error: '기타 내용을 적어 주세요' });
    expect(validateFeedback({ ...base, fields: ['tel', 'other'], text: ' ' })).toEqual({ ok: false, error: '기타 내용을 적어 주세요' });
    expect(validateFeedback({ ...base, fields: ['other'], text: '주차장이 없어졌어요' })).toMatchObject({ ok: true });
  });

  test('rejects bad shapes', () => {
    const bad = [
      null, [], 'x',
      { type: 'spam', text: 'a', path: '/' },
      { type: 'opinion', text: 'a'.repeat(MAX_FEEDBACK + 1), path: '/' },
      { type: 'opinion', text: 'a', path: 'https://evil.example' },
      { type: 'correction', kind: 'pharmacy', institutionId: "1'; drop", fields: ['tel'], text: '', path: '/' },
      { type: 'correction', kind: 'clinic', institutionId: 'C1', fields: ['tel'], text: '', path: '/' },
      { type: 'correction', kind: 'pharmacy', institutionId: 'C1', fields: ['tel', 'hack'], text: '', path: '/' },
    ];
    for (const b of bad) expect(validateFeedback(b).ok).toBe(false);
  });

  test('field labels: hours says 진료시간 for hospitals', () => {
    expect(CORRECTION_FIELDS).toEqual(['tel', 'hours', 'name', 'addr', 'closed', 'other']);
    expect(fieldLabel('hours', 'pharmacy')).toBe('영업시간');
    expect(fieldLabel('hours', 'hospital')).toBe('진료시간');
    expect(fieldLabel('closed', 'hospital')).toBe('폐업');
  });
});
