import Link from 'next/link';

/** 모든 페이지 상단 고정 헤더: 로고(홈) + 검색(D27) */
export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="logo">
          지금문연
        </Link>
        <Link href="/?search=1" className="icon-btn" aria-label="동네·병원·약국 검색">
          <span aria-hidden="true">⌕</span>
        </Link>
      </div>
    </header>
  );
}
