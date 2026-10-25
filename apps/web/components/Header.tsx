'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { noteNavigation } from '@/lib/navHistory';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/seo';

/**
 * 공통 헤더(D27·D44·D49·D69): 로고 + 아래 소개 문구, 오른쪽 위 [검색](병원·약국 이름 검색).
 * 모든 페이지에서 같은 자리라 상세·지역 화면에서도 바로 찾을 수 있다. [개선의견]은 맨 아래 푸터 바로 위(FeedbackFooter).
 */
export function Header() {
  const pathname = usePathname();
  // 이름 검색 [닫기]가 직전 화면이 있는지 알 수 있게 앱 안 이동을 기록한다(D43)
  useEffect(() => noteNavigation(pathname), [pathname]);
  // 모든 페이지에서 첫 줄은 화면 위에 고정(D52, 메인도)
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="brand">
          <Link href="/" className="logo" aria-label={`${SITE_NAME} 메인`}>
            {/* 브랜드 로고(D44). 화면이 다크 모드면 흰 글자 버전 */}
            <picture>
              <source srcSet="/logo-white.svg" media="(prefers-color-scheme: dark)" />
              <img src="/logo.svg" alt={SITE_NAME} width={95} height={28} />
            </picture>
          </Link>
          <p className="tagline">{SITE_TAGLINE}</p>
        </div>
        <Link className="btn btn-secondary header-btn header-search" href="/search" prefetch={false}>
          <Search aria-hidden="true" size={16} /> 검색
        </Link>
      </div>
    </header>
  );
}
