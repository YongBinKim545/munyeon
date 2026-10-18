import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { loadRegions, loadRegionStats } from '@/lib/data';
import { KIND_LABEL, parseRegionParams, regionPath, SITUATIONS, type Kind, type Situation } from '@/lib/seo';

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ sido: string; sigungu: string }> };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = parseRegionParams(await params);
  if (!r?.sigungu) return { robots: { index: false } };
  return {
    title: `${r.sigungu} 문 여는 병원·약국 — 일요일·공휴일·야간`,
    description: `${r.sido} ${r.sigungu}의 약국·병원 일요일·공휴일·야간 진료시간과 전화번호를 한곳에서 확인하세요.`,
    alternates: { canonical: regionPath(r.sido, r.sigungu) },
  };
}

export default async function SigunguHub({ params }: Props) {
  const r = parseRegionParams(await params);
  if (!r?.sigungu) notFound();
  const { sido, sigungu } = r;
  const regions = await loadRegions();
  if (!regions.some((x) => x.sido === sido && x.sigungu === sigungu)) notFound();
  const kinds: Kind[] = ['pharmacy', 'hospital'];
  const stats = await Promise.all(kinds.map((k) => loadRegionStats(sido, sigungu, k)));
  const siblings = regions.filter((x) => x.sido === sido && x.sigungu !== sigungu);

  return (
    <main className="container">
      <Breadcrumbs items={[{ name: sido, href: regionPath(sido) }, { name: sigungu, href: regionPath(sido, sigungu) }]} />
      <h1>{sigungu} 문 여는 병원·약국</h1>
      {kinds.map((k, i) => {
        const s = stats[i]!;
        return (
          <section key={k}>
            <h2>{KIND_LABEL[k]}</h2>
            <p className="muted">
              등록 {s.total}곳 · 일요일 진료시간 등록 {s.withSunday}곳 · 공휴일 진료시간 등록률 {pct(s.withHoliday, s.total)}%
            </p>
            <div className="chips">
              {(Object.keys(SITUATIONS) as Situation[]).map((sit) => (
                <Link key={sit} className="chip" href={regionPath(sido, sigungu, k, sit)}>
                  {sit === 'all' ? `${KIND_LABEL[k]} 전체` : `${SITUATIONS[sit]} 여는 ${KIND_LABEL[k]}`}
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {siblings.length ? (
        <section>
          <h2>{sido}의 다른 지역</h2>
          <div className="chips">
            {siblings.map((g) => (
              <Link key={g.sigungu} className="chip" href={regionPath(sido, g.sigungu)}>
                {g.sigungu}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
