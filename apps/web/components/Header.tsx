'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 공통 헤더: 로고(메인) + 상호 검색(D27·D33).
 * 메인에서는 검색이 2줄 [검색] 버튼에 있으므로 아이콘을 숨기고, 헤더를 고정하지 않는다(목록과 함께 스크롤).
 */
export function Header() {
  const isMain = usePathname() === '/';
  return (
    <header className={isMain ? 'site-header site-header--static' : 'site-header'}>
      <div className="site-header__inner">
        <Link href="/" className="logo">
          지금문연
        </Link>
        {isMain ? null : (
          <Link href="/search" className="icon-btn" aria-label="병원·약국 이름 검색">
            <Search aria-hidden="true" size={22} />
          </Link>
        )}
      </div>
    </header>
  );
}
