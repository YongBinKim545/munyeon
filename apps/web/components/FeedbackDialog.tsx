'use client';

import { CircleCheck, Send, X } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { CORRECTION_FIELDS, fieldLabel, MAX_FEEDBACK, validateFeedback, type CorrectionField } from '@/lib/feedback';
import type { Kind } from '@/lib/seo';
import { useModal } from '@/lib/useModal';

export type FeedbackTarget = { type: 'opinion' } | { type: 'correction'; kind: Kind; institutionId: string; name: string };

/** 쓰던 내용(D49). 이 탭의 메모리에만 두고, 보내면 지운다. */
const drafts = new Map<string, { text: string; fields: CorrectionField[] }>();
export function resetFeedbackDrafts(): void {
  drafts.clear();
}
const draftKey = (t: FeedbackTarget) => (t.type === 'opinion' ? 'opinion' : `correction/${t.kind}/${t.institutionId}`);

const SENT_KEY = 'munyeon:feedbackAt';
const MIN_INTERVAL_MS = 60_000;
function recentlySent(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(SENT_KEY) ?? 0) < MIN_INTERVAL_MS;
  } catch {
    return false;
  }
}
function markSent(): void {
  try {
    localStorage.setItem(SENT_KEY, String(Date.now()));
  } catch {
    // 저장소가 막혀 있으면 서버의 횟수 제한에 맡긴다
  }
}

/**
 * 휴대폰 키보드가 올라오면 창 높이를 실제로 보이는 높이에 맞춘다. 맨 아래 [보내기]가 키보드 바로 위에 남는다(D49).
 * 아이폰은 키보드가 화면을 덮기만 하고 크기를 줄이지 않아 visualViewport로 맞춘다.
 */
function useVisibleHeight(): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setStyle({ '--vvh': `${vv.height}px`, '--vvtop': `${vv.offsetTop}px` } as CSSProperties);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return style;
}

/**
 * 개선의견(헤더)·정보 수정 요청(기관 상세) 창(D49). 휴대폰 전체 화면·PC 가운데, 제목 줄 [X], 맨 아래 [보내기].
 * 뒤로 가기·Esc·Tab은 useModal(다른 모달과 같음).
 */
export function FeedbackDialog({ target, path, onClose }: { target: FeedbackTarget; path: string; onClose: () => void }) {
  const key = draftKey(target);
  const [text, setText] = useState(() => drafts.get(key)?.text ?? '');
  const [fields, setFields] = useState<CorrectionField[]>(() => drafts.get(key)?.fields ?? []);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'edit' | 'sending' | 'sent'>('edit');
  const { dialogRef, close } = useModal<null>('feedback', () => onClose());
  const style = useVisibleHeight();
  const title = target.type === 'opinion' ? '개선의견' : '정보 수정 요청';

  useEffect(() => {
    if (state !== 'sent') drafts.set(key, { text, fields });
  }, [key, text, fields, state]);

  const toggle = (f: CorrectionField) => setFields((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const submit = async () => {
    const payload = target.type === 'opinion'
      ? { type: 'opinion', text, path }
      : { type: 'correction', kind: target.kind, institutionId: target.institutionId, fields, text, path };
    const v = validateFeedback(payload);
    if (!v.ok) return setError(v.error);
    if (recentlySent()) return setError('잠시 뒤 다시 보내 주세요');
    setError(null);
    setState('sending');
    try {
      const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(String(res.status));
      markSent();
      drafts.delete(key);
      setState('sent');
    } catch {
      setState('edit');
      setError('보내지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div ref={dialogRef} className="modal modal--sheet" role="dialog" aria-modal="true" aria-label={title} style={style}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="닫기" onClick={() => close()}>
            <X aria-hidden="true" size={22} />
          </button>
        </div>
        {state === 'sent' ? (
          <>
            <div className="sheet-body sheet-done" role="status">
              <CircleCheck aria-hidden="true" size={40} className="sheet-done__icon" />
              <p className="sheet-done__title">감사합니다</p>
              <p className="muted">보내주신 내용은 확인해서 서비스를 고치는 데 쓸게요.</p>
            </div>
            <div className="sheet-foot">
              <button type="button" className="btn btn-secondary btn-wide" onClick={() => close()}>
                닫기
              </button>
            </div>
          </>
        ) : (
          <form
            className="sheet-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="sheet-body">
              {target.type === 'correction' ? (
                <>
                  <p className="sheet-target">{target.name}</p>
                  <div className="chips" role="group" aria-label="틀린 항목">
                    {CORRECTION_FIELDS.map((f) => (
                      <button key={f} type="button" className="chip" aria-pressed={fields.includes(f)} onClick={() => toggle(f)}>
                        {fieldLabel(f, target.kind)}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <label className="sr-only" htmlFor="feedback-text">
                {target.type === 'opinion' ? '의견 내용' : '맞는 정보'}
              </label>
              <textarea
                id="feedback-text"
                className="sheet-text"
                rows={5}
                maxLength={MAX_FEEDBACK}
                placeholder={target.type === 'opinion' ? '어떤 점이 불편했나요?' : '맞는 정보를 알면 적어 주세요 (선택)'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <p className="muted sheet-meta">
                <span>이름·전화번호 같은 개인정보는 적지 마세요.</span>
                <span>
                  {text.length} / {MAX_FEEDBACK}
                </span>
              </p>
              {error ? (
                <p className="sheet-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <div className="sheet-foot">
              <button type="submit" className="btn btn-secondary btn-wide" disabled={state === 'sending'}>
                <Send aria-hidden="true" size={18} /> {state === 'sending' ? '보내는 중…' : '보내기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
