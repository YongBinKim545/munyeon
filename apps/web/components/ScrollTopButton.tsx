'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 메인 헤더는 고정하지 않는다. 한 화면 이상 내려간 뒤 위로 올리면 [↑ 맨 위로]가 나타나고,
 * 아래로 내리면 숨는다(2026-10-19 사용자 결정). 카드의 [길찾기]를 가리지 않게 내릴 때는 숨긴다.
 */
export function ScrollTopButton() {
  const [show, setShow] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const up = y < last.current;
      last.current = y;
      setShow(up && y > window.innerHeight);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      className="scroll-top"
      aria-label="맨 위로"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setShow(false);
      }}
    >
      ↑ 맨 위로
    </button>
  );
}
