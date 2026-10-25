import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { RegionTable } from '@/components/RegionTable';
import { loadRegions } from '@/lib/data';
import { openGraphFor, parseRegionParams, regionPath, sidoTitle } from '@/lib/seo';

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ sido: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = parseRegionParams(await params);
  if (!r) return { robots: { index: false } };
  const title = `${sidoTitle(r.sido)} 문 여는 병원·약국 — 시군구별 진료시간`;
  const description = `${r.sido} 시군구별 약국·병원의 일요일·공휴일 진료시간과 전화번호.`;
  return { title, description, alternates: { canonical: regionPath(r.sido) }, openGraph: openGraphFor(regionPath(r.sido), title, description) };
}

export default async function SidoPage({ params }: Props) {
  const r = parseRegionParams(await params);
  if (!r) notFound();
  const regions = (await loadRegions()).filter((x) => x.sido === r.sido);
  if (regions.length === 0) notFound();
  return (
    <main className="container">
      <Breadcrumbs items={[{ name: r.sido, href: regionPath(r.sido) }]} />
      <h1>{sidoTitle(r.sido)} 문 여는 병원·약국</h1>
      <p className="muted">시군구를 고르면 일요일·공휴일·야간에 여는 곳을 볼 수 있어요.</p>
      <RegionTable
        sido={r.sido}
        rows={regions.map((g) => ({ name: g.sigungu, href: regionPath(r.sido, g.sigungu), pharmacy: g.pharmacy, hospital: g.hospital }))}
      />
    </main>
  );
}
