import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { loadRegions } from '@/lib/data';
import { parseRegionParams, regionPath } from '@/lib/seo';

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ sido: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = parseRegionParams(await params);
  if (!r) return { robots: { index: false } };
  return {
    title: `${r.sido} 문 여는 병원·약국 — 시군구별 진료시간`,
    description: `${r.sido} 시군구별 약국·병원의 일요일·공휴일·야간 진료시간과 전화번호.`,
    alternates: { canonical: regionPath(r.sido) },
  };
}

export default async function SidoPage({ params }: Props) {
  const r = parseRegionParams(await params);
  if (!r) notFound();
  const regions = (await loadRegions()).filter((x) => x.sido === r.sido);
  if (regions.length === 0) notFound();
  return (
    <main className="container container--wide">
      <Breadcrumbs items={[{ name: r.sido, href: regionPath(r.sido) }]} />
      <h1>{r.sido} 문 여는 병원·약국</h1>
      <p className="muted">시군구를 고르면 일요일·공휴일·야간에 여는 곳을 볼 수 있어요.</p>
      <ul className="link-list link-list--multi">
        {regions.map((g) => (
          <li key={g.sigungu}>
            <Link href={regionPath(r.sido, g.sigungu)}>
              <span>{g.sigungu}</span>
              <span className="muted">
                약국 {g.pharmacy} · 병원 {g.hospital}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
