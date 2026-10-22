'use client';

import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { noteNavigation } from '@/lib/navHistory';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/seo';
import { FeedbackDialog } from './FeedbackDialog';

/**
 * 공통 헤더(D27·D44·D49): 로고 + 아래 소개 문구, 오른쪽 위 [개선의견].
 * 이름 검색은 메인 2줄 [검색]에 있다(다른 페이지의 검색 아이콘은 D49에서 없앰).
 * 메인에서는 헤더를 고정하지 않는다(목록과 함께 스크롤).
 */
export function Header() {
  const pathname = usePathname();
  const isMain = pathname === '/';
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // 이름 검색 [닫기]가 직전 화면이 있는지 알 수 있게 앱 안 이동을 기록한다(D43)
  useEffect(() => noteNavigation(pathname), [pathname]);
  return (
    <header className={isMain ? 'site-header site-header--static' : 'site-header'}>
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
        <button type="button" className="btn btn-secondary feedback-btn" onClick={() => setFeedbackOpen(true)}>
          <MessageSquare aria-hidden="true" size={16} /> 개선의견
        </button>
      </div>
      {feedbackOpen ? <FeedbackDialog target={{ type: 'opinion' }} path={pathname} onClose={() => setFeedbackOpen(false)} /> : null}
    </header>
  );
}
