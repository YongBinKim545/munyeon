'use client';

import { toTelHref } from '@munyeon/core';
import { Copy, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { track } from '@/lib/track';

interface Props {
  tel: string | null;
  institutionId: string;
  page: string;
  /** 카드 안의 작은 버튼 */
  compact?: boolean;
}

/**
 * 휴대폰·태블릿은 `tel:` 링크, 마우스 기기(PC)는 번호를 크게 보여주고 복사 버튼(D29).
 * 서버 HTML에는 항상 `tel:` 링크와 번호가 들어간다.
 */
export function CallButton({ tel, institutionId, page, compact }: Props) {
  const href = tel ? toTelHref(tel) : null;
  const [fine, setFine] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setFine(window.matchMedia?.('(pointer: fine) and (hover: hover)').matches ?? false);
  }, []);

  if (!href || !tel) return <p className="no-tel">전화번호 정보 없음</p>;

  if (fine) {
    return (
      <div className={compact ? 'call-pc call-pc--compact' : 'call-pc'}>
        <a className="tel-big" href={href} onClick={() => track('tel_tap', institutionId, page)}>
          {tel}
        </a>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            track('tel_copy', institutionId, page);
            try {
              await navigator.clipboard.writeText(tel);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // 복사 실패 시 번호가 화면에 그대로 보인다
            }
          }}
        >
          <Copy aria-hidden="true" size={16} /> {copied ? '복사했어요' : '번호 복사'}
        </button>
      </div>
    );
  }

  return (
    <a
      className={compact ? 'btn btn-call btn-call--compact' : 'btn btn-call'}
      href={href}
      onClick={() => track('tel_tap', institutionId, page)}
    >
      <Phone aria-hidden="true" size={18} /> 전화하기{compact ? '' : <span className="tel-num"> {tel}</span>}
    </a>
  );
}
