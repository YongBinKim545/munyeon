import { MainScreen } from '@/components/MainScreen';
import { DataStamp } from '@/components/DataStamp';
import { loadHome } from '@/lib/data';
import { buildSiteJsonLd, serializeJsonLd } from '@/lib/jsonld';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

// 서버 HTML에는 헤더 틀·소개만 넣는다(1시간 캐시). 목록과 영업 상태는 브라우저에서만 그린다(D31·D35).
// 지역으로 찾기(시도 목록)는 /regions로 옮겼다(D52).
export const revalidate = 3600;

export default async function Home() {
  // 빌드 환경에 DB가 없거나 조회가 실패하면 공휴일 없이 만들고, 브라우저가 /api/meta로 받는다(D47)
  const holidays = process.env.DATABASE_URL ? await loadHome() : [];
  return (
    <main className="container container--wide">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildSiteJsonLd(SITE_URL, SITE_NAME, process.env.NEXT_PUBLIC_CONTACT_EMAIL)) }}
      />
      <h1 className="sr-only">지금 문 연 병원·약국</h1>
      <MainScreen holidays={holidays} />
      <p className="notice">
        등록된 정보가 실제와 다를 수 있어요. 방문 전 꼭 전화로 확인하세요.
        <br />
        <DataStamp kind="pharmacy" initial={null} />
      </p>
    </main>
  );
}
