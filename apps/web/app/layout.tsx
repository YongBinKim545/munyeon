import { GoogleAnalytics } from '@next/third-parties/google';
import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import Link from 'next/link';
import { FeedbackFooter } from '@/components/FeedbackFooter';
import { Header } from '@/components/Header';
import { InstantDetailLayer } from '@/components/InstantDetailLayer';
import { NavProgress } from '@/components/NavProgress';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/seo';
import './globals.css';

/**
 * 윈도우 PC용 글꼴(D54). 빌드 때 받아 우리 도메인에서 제공한다(사용자가 구글 서버에 접속하지 않음).
 * 실제로 쓰는 곳은 globals.css의 마우스 기기 규칙뿐이고, 맥·휴대폰은 기기 글꼴이 먼저라 내려받지 않는다.
 * 휴대폰이 미리 받지 않도록 preload는 끈다.
 */
const noto = Noto_Sans_KR({ weight: ['400', '600', '700'], display: 'swap', preload: false, variable: '--font-noto' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: '야간·휴일·명절에 지금 문 연 병원·약국을 찾고 원탭으로 전화해 확인하세요. 요일별·공휴일 진료시간 제공.',
  applicationName: SITE_NAME,
  formatDetection: { telephone: false },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.NAVER_SITE_VERIFICATION ? { 'naver-site-verification': process.env.NAVER_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 안드로이드: 키보드가 열리면 화면이 줄어 맨 아래 [닫기]가 키보드 위로 올라오게 한다(D45, 아이폰은 SearchPanel이 처리)
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f141b' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html lang="ko" className={noto.variable}>
      <body>
        <Header />
        <NavProgress />
        <InstantDetailLayer />
        {children}
        <FeedbackFooter />
        <footer className="site-footer">
          <p>데이터 출처: 국립중앙의료원 · 공공데이터포털</p>
          <p>
            {/* 메인 하단 시도 목록을 옮긴 뒤에도 검색 로봇이 지역 페이지로 들어가는 길(D52) */}
            <Link href="/regions">지역으로 찾기</Link>
            <Link href="/about">소개</Link>
            <Link href="/privacy">개인정보처리방침</Link>
            <Link href="/terms">이용약관</Link>
          </p>
        </footer>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
