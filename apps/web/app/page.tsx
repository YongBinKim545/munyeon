import Link from 'next/link';
import { MainScreen } from '@/components/MainScreen';
import { loadHolidays, loadSido } from '@/lib/data';
import { regionPath } from '@/lib/seo';

// 서버 HTML에는 헤더 틀·소개·시도 목록만 넣는다(1시간 캐시). 목록과 영업 상태는 브라우저에서만 그린다(D31·D35).
export const revalidate = 3600;

export default async function Home() {
  // 빌드 환경에 DB가 없으면 빈 목록으로 만들고, 첫 재생성 때 채운다.
  const [sido, holidays] = process.env.DATABASE_URL ? await Promise.all([loadSido(), loadHolidays()]) : [[], []];
  return (
    <main className="container container--wide">
      <h1 className="sr-only">지금 문 연 병원·약국</h1>
      <MainScreen holidays={holidays} />
      <p className="notice">
        등록된 정보가 실제와 다를 수 있어요. 방문 전 꼭 전화로 확인하세요. 진료시간은 국립중앙의료원 공공데이터를 매시간 반영해요.
      </p>
      <section>
        <h2>지역으로 찾기</h2>
        <p className="muted">지금 문 연 병원·약국을 찾고 전화로 확인하세요. 시도를 고르면 시군구별 약국·병원 진료시간을 볼 수 있어요.</p>
        <ul className="link-list link-list--multi">
          {sido.map((s) => (
            <li key={s.sido}>
              <Link href={regionPath(s.sido)}>
                <span>{s.sido}</span>
                <span className="muted">
                  약국 {s.pharmacy.toLocaleString('ko-KR')} · 병원 {s.hospital.toLocaleString('ko-KR')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
