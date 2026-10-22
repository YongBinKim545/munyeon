'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import type { DetailPreview } from '@/lib/detailPreview';
import { openInstantDetail } from '@/lib/instantDetail';
import { institutionPath } from '@/lib/seo';

/**
 * 기관 상세로 가는 링크. 누르는 순간 가진 정보로 상세를 덮어 보여 주고(D51), 서버 상세는 뒤에서 받는다.
 * 새 탭으로 여는 클릭(Ctrl·가운데 버튼 등)은 덮지 않는다. 미리 받기는 끈다(D50).
 * 덮는 순간 같은 주소의 기록을 하나 더 쌓아, 서버 응답 전에 뒤로 가기를 누르면 덮개만 닫히고 목록에 남는다.
 * 서버 상세가 오면 그 기록을 상세 주소로 바꾼다(replace) — 상세에서 뒤로 가기 한 번이면 목록이다.
 */
export function PreviewLink({
  preview,
  className,
  onClick,
  children,
}: {
  preview: DetailPreview;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const href = institutionPath(preview.kind, preview.id);
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.();
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    window.history.pushState(window.history.state, '', location.href);
    openInstantDetail(preview, href, location.pathname);
  };
  return (
    <Link className={className} href={href} prefetch={false} replace data-instant="" onClick={handle}>
      {children}
    </Link>
  );
}
