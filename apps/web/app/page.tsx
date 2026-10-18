import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';
import { loadSido } from '@/lib/data';
import { regionPath } from '@/lib/seo';

// 시도 목록만 서버에서 그린다(1시간 캐시). '내 주변' 버튼은 1b에서 추가한다.
export const revalidate = 3600;

export default async function Home() {
  // 빌드 환경에 DB가 없으면 빈 목록으로 만들고, 첫 재생성 때 채운다.
  const sido = process.env.DATABASE_URL ? await loadSido() : [];
  return (
    <main className="container container--wide">
      <h1>지금 문 연 병원·약국</h1>
      <p className="muted">야간·휴일에 문 연 병원·약국을 찾고 전화로 확인하세요. 요일별·공휴일 진료시간을 보여드려요.</p>
      <SearchBox />
      <section>
        <h2>지역으로 찾기</h2>
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
      <p className="notice">
        진료시간은 국립중앙의료원 공공데이터를 매시간 반영해요. 등록된 정보가 실제와 다를 수 있으니 방문 전 꼭 전화로 확인하세요.
      </p>
    </main>
  );
}
