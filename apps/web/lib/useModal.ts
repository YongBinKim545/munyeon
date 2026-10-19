'use client';

import { useEffect, useRef } from 'react';

/**
 * 메인 모달 공통 동작(D33·D38).
 * - 열 때 브라우저 기록에 한 칸을 넣어, 휴대폰 뒤로 가기가 페이지를 떠나지 않고 모달만 닫게 한다.
 * - close(result)는 history.back()으로 그 한 칸을 되돌리고, popstate에서 onClosed(result)를 부른다.
 * - Esc는 포커스 위치와 관계없이 닫고, Tab은 모달 안에서만 돈다(aria-modal).
 */
export function useModal<T>(name: string, onClosed: (result: T | null) => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const result = useRef<T | null>(null);
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  useEffect(() => {
    // 개발 모드의 effect 두 번 실행에도 기록이 한 칸만 늘게 한다
    if ((history.state as { modal?: string } | null)?.modal !== name) history.pushState({ modal: name }, '');
    const onPop = () => onClosedRef.current(result.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        history.back();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const f = [...dialogRef.current.querySelectorAll<HTMLElement>('input, button, a[href]')];
      const first = f[0];
      const last = f[f.length - 1];
      if (!first || !last) return;
      const inside = dialogRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.removeEventListener('keydown', onKey);
    };
  }, [name]);

  const close = (r?: T) => {
    result.current = r ?? null;
    history.back();
  };
  return { dialogRef, close };
}
