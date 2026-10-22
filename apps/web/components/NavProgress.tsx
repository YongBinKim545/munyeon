'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/** 사이트 안 링크를 누르고 이 시간 안에 화면이 안 바뀌면 진행 표시를 띄운다(D50). */
export const SHOW_AFTER_MS = 1_000;
/** 이 시간이 지나도 안 바뀌면 '응답이 늦어요'와 [다시 시도]를 보여 준다. */
export const SLOW_AFTER_MS = 10_000;

type Pending = { href: string; slow: boolean };

/**
 * 링크를 눌렀는데 아무 반응이 없는 것처럼 보이지 않게 한다(D50). 스켈레톤(loading.tsx)이 보통 먼저 뜨지만,
 * 다음 페이지를 받는 요청이 서버에서 멈추면 화면이 그대로 남을 수 있어 안전망으로 둔다.
 * 브라우저 안에서만 동작하므로 검색엔진이 받는 HTML과는 관계없다. 같은 경로 안 이동(검색어·#)은 다루지 않는다.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState<Pending | null>(null);
  const [shownFor, setShownFor] = useState(pathname);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 화면(경로)이 바뀌면 표시를 끈다
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setPending(null);
  }

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      // 기관 상세 링크는 누르는 즉시 상세를 덮어 보여 주므로(D51) 여기서 다루지 않는다
      if (a.hasAttribute('data-instant')) return;
      const url = new URL(a.href, location.href);
      const from = location.pathname;
      // 다른 사이트·전화(tel:)·같은 경로 안 이동은 제외
      if (url.origin !== location.origin || url.pathname === from) return;
      timers.current.forEach(clearTimeout);
      // 그사이 화면이 바뀌었으면 띄우지 않는다
      const show = (slow: boolean) => () => {
        if (location.pathname === from) setPending({ href: url.href, slow });
      };
      timers.current = [setTimeout(show(false), SHOW_AFTER_MS), setTimeout(show(true), SLOW_AFTER_MS)];
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  if (!pending) return null;
  return (
    <div className="nav-progress" role="status" aria-live="polite">
      <div className="nav-progress__bar" aria-hidden="true" />
      <p className="nav-progress__msg">
        {pending.slow ? (
          <>
            응답이 늦어요.{' '}
            <button type="button" className="nav-progress__retry" onClick={() => location.assign(pending.href)}>
              다시 시도
            </button>
          </>
        ) : (
          '불러오는 중이에요…'
        )}
      </p>
    </div>
  );
}
