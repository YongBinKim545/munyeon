'use client';

import { useEffect, useRef, useState } from 'react';
import { CallButton } from './CallButton';

/** 사이트 헤더 높이. 이 아래로 가려진 버튼은 안 보이는 것으로 친다 */
const HEADER_PX = 63;

/**
 * 휴대폰 상세 하단의 [전화하기](D52). 위쪽 [전화하기](.detail-call)가 화면에 보이는 동안은 숨기고,
 * 스크롤로 그 버튼이 위로 사라지면 나타난다(중복·가림 없이 주 동작은 늘 손 닿는 곳에). PC(768px 이상)는 CSS로 늘 숨긴다.
 */
export function StickyCall({ tel, institutionId }: { tel: string; institutionId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = ref.current?.closest('main')?.querySelector('.detail-call');
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => e && setShow(!e.isIntersecting && e.boundingClientRect.top < HEADER_PX),
      { rootMargin: `-${HEADER_PX}px 0px 0px 0px` },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="sticky-call" hidden={!show}>
      <CallButton tel={tel} institutionId={institutionId} page="detail_sticky" />
    </div>
  );
}
