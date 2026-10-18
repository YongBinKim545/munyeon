'use client';

import { useSearchParams } from 'next/navigation';

/**
 * 동네 검색에서 `?동=역삼동`으로 들어오면 그 동 기관을 목록 맨 위에 보이게 한다.
 * React가 관리하는 DOM 순서는 건드리지 않고 CSS `order`만 바꾼다(목록은 grid). 서버 HTML은
 * 이름순 하나라 캐시가 갈라지지 않고, 같은 페이지 안에서 주소가 바뀌어도 바로 따라간다.
 * useSearchParams를 쓰므로 페이지에서 <Suspense>로 감싼다(본문이 아니라 안내·스타일만 그림).
 */
export function DongFocus() {
  const dong = useSearchParams().get('동');
  if (!dong || !/^[가-힣0-9·.]{1,20}$/.test(dong)) return null;
  return (
    <>
      <style>{`[data-region-list] > li[data-dong="${dong}"] { order: -1; }`}</style>
      <p className="notice" role="status">{`${dong} 근처 먼저 보여드려요`}</p>
    </>
  );
}
