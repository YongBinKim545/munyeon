import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RegionTable } from '@/components/RegionTable';
import { loadSidoCounts } from '@/lib/data';
import { CURRENT_SIDO, openGraphFor, regionPath } from '@/lib/seo';

export const metadata: Metadata = {
  title: '지역으로 찾기 — 시도·시군구별 문 여는 병원·약국',
  description: '시도를 고르면 시군구별 약국·병원의 요일별·공휴일 진료시간을 볼 수 있어요. 방문 전 전화로 확인하세요.',
  alternates: { canonical: '/regions' },
  openGraph: openGraphFor('/regions', '지역으로 찾기 — 시도·시군구별 문 여는 병원·약국', '시도를 고르면 시군구별 약국·병원의 요일별·공휴일 진료시간을 볼 수 있어요.'),
};

// 하루 캐시. 기관 수만 DB에서 받고, 못 받아도 시도 이름으로 목록을 만든다(빌드 중 DB 실패 대비, D47·D52).
export const revalidate = 86400;

export default async function Regions() {
  const counts = process.env.DATABASE_URL ? await loadSidoCounts() : [];
  const bySido = new Map(counts.map((c) => [c.sido, c]));
  const names = counts.length ? counts.map((c) => c.sido) : [...CURRENT_SIDO].sort((a, b) => a.localeCompare(b, 'ko'));
  return (
    <main className="container">
      <Breadcrumbs items={[{ name: '지역으로 찾기', href: '/regions' }]} />
      <h1>지역으로 찾기</h1>
      <p className="muted">시도를 고르면 시군구별 약국·병원 진료시간을 볼 수 있어요. 방문 전 꼭 전화로 확인하세요.</p>
      <RegionTable
        rows={names.map((sido) => ({
          name: sido,
          href: regionPath(sido),
          pharmacy: bySido.get(sido)?.pharmacy ?? null,
          hospital: bySido.get(sido)?.hospital ?? null,
        }))}
      />
    </main>
  );
}
