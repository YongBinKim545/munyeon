'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { markDetailReady } from '@/lib/instantDetail';

/** 서버 상세가 화면에 붙었음을 알려 바로 보여 주던 덮개를 걷게 한다(D51). 그리는 것은 없다. */
export function DetailReady() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) markDetailReady(pathname);
  }, [pathname]);
  return null;
}
