'use client';

import { useEffect, useState } from 'react';

/**
 * 동네 검색에서 `?동=역삼동`으로 들어오면 이미 받은 목록에서 그 동 기관을 맨 위로 옮긴다.
 * 서버 HTML은 항상 이름순 하나라 캐시가 갈라지지 않는다(구조·UI/UX 4.4).
 */
export function DongFocus() {
  const [dong, setDong] = useState<string | null>(null);

  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get('동');
    if (!d) return;
    let moved = 0;
    document.querySelectorAll<HTMLElement>('[data-region-list]').forEach((list) => {
      const matches = Array.from(list.children).filter((li) => li.getAttribute('data-dong') === d);
      for (const li of matches.reverse()) list.prepend(li);
      moved += matches.length;
    });
    if (moved > 0) setDong(d);
  }, []);

  return dong ? <p className="notice" role="status">{`${dong} 근처 먼저 보여드려요`}</p> : null;
}
