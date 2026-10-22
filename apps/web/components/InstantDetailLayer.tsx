'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { closeInstantDetail, useInstantDetail } from '@/lib/instantDetail';
import { DetailPreview } from './DetailPreview';

/**
 * 목록에서 누른 기관의 상세를 서버 응답 전에 바로 덮어 보여 주는 층(D51). 레이아웃에 하나만 둔다.
 * 서버 상세(또는 오류 화면)가 붙으면 걷히고, 뒤로 가기나 다른 곳으로 이동하면 닫힌다. 아래 목록은 스크롤 위치째 그대로 남는다.
 */
export function InstantDetailLayer() {
  const d = useInstantDetail();
  const pathname = usePathname();

  // 상세도, 누른 자리도 아닌 곳으로 갔으면 닫는다
  useEffect(() => {
    if (d && pathname !== d.from && pathname !== d.path) closeInstantDetail();
  }, [d, pathname]);

  useEffect(() => {
    if (!d) return;
    const onPop = () => closeInstantDetail();
    window.addEventListener('popstate', onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = prev;
    };
  }, [d]);

  if (!d) return null;
  return (
    <div className="instant-detail">
      <DetailPreview p={d.preview} />
    </div>
  );
}
