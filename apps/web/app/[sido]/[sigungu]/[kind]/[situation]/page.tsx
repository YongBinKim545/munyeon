import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { DataStamp } from '@/components/DataStamp';
import { DongFocus } from '@/components/DongFocus';
import { EmergencyNote } from '@/components/EmergencyNote';
import { InstitutionCard } from '@/components/InstitutionCard';
import { loadLastSync, loadRegion, loadRegions, loadRegionStats } from '@/lib/data';
import { landingIndexable, matchesSituation, situationTime, splitByCategory } from '@/lib/landing';
import { KIND_LABEL, parseRegionParams, regionPath, SITUATIONS, type Kind, type Situation } from '@/lib/seo';

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ sido: string; sigungu: string; kind: string; situation: string }> };

function heading(sigungu: string, kind: Kind, s: Situation): string {
  const k = KIND_LABEL[kind];
  return s === 'all' ? `${sigungu} ${k} — 진료시간·전화` : `${sigungu} ${SITUATIONS[s]} 문 여는 ${k}`;
}

async function load(params: Props['params']) {
  const r = parseRegionParams(await params);
  if (!r?.sigungu || !r.kind || !r.situation) return null;
  const { sido, sigungu, kind, situation } = r;
  const all = await loadRegion(sido, sigungu, kind);
  if (all.length === 0) {
    const regions = await loadRegions();
    if (!regions.some((x) => x.sido === sido && x.sigungu === sigungu)) return null;
  }
  const matched = all.filter((i) => matchesSituation(i.hours, situation));
  return { sido, sigungu, kind, situation, matched, ...splitByCategory(matched) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load(params);
  if (!d) return { robots: { index: false } };
  const label = d.kind === 'pharmacy' ? '영업시간' : '진료시간';
  return {
    title: `${heading(d.sigungu, d.kind, d.situation)}${d.situation === 'all' ? '' : ` — ${label}·전화`}`,
    description: `${d.sido} ${d.sigungu} ${d.situation === 'all' ? '' : `${SITUATIONS[d.situation]}에 여는 `}${KIND_LABEL[d.kind]} ${d.matched.length}곳의 ${label}과 전화번호. 방문 전 전화로 확인하세요.`,
    alternates: { canonical: regionPath(d.sido, d.sigungu, d.kind, d.situation) },
    robots: landingIndexable(d.matched.length) ? undefined : { index: false, follow: true },
  };
}

export default async function LandingPage({ params }: Props) {
  const d = await load(params);
  if (!d) notFound();
  const { sido, sigungu, kind, situation, main, folded } = d;
  const [stats, regions, lastSync] = await Promise.all([loadRegionStats(sido, sigungu, kind), loadRegions(), loadLastSync(kind)]);
  const holidayPct = stats.total ? Math.round((stats.withHoliday / stats.total) * 100) : 0;
  const otherKind: Kind = kind === 'pharmacy' ? 'hospital' : 'pharmacy';
  const siblings = regions.filter((x) => x.sido === sido && x.sigungu !== sigungu);
  const page = `landing_${situation}`;

  return (
    <main className="container container--wide">
      <Breadcrumbs
        items={[
          { name: sido, href: regionPath(sido) },
          { name: sigungu, href: regionPath(sido, sigungu) },
          { name: KIND_LABEL[kind], href: regionPath(sido, sigungu, kind, 'all') },
          ...(situation === 'all' ? [] : [{ name: SITUATIONS[situation], href: regionPath(sido, sigungu, kind, situation) }]),
        ]}
      />
      <h1>{heading(sigungu, kind, situation)}</h1>
      <p className="muted">
        등록 기준 {main.length + folded.length}곳 · 이 지역 공휴일 진료시간 등록률 {holidayPct}%
      </p>
      <div className="chips">
        {(Object.keys(SITUATIONS) as Situation[]).map((s) => (
          <Link key={s} className="chip" href={regionPath(sido, sigungu, kind, s)} aria-current={s === situation ? 'page' : undefined}>
            {SITUATIONS[s]}
          </Link>
        ))}
      </div>
      <p className="notice">
        등록된 정보가 실제와 다를 수 있어요. 방문 전 꼭 전화로 확인하세요.
        <br />
        <DataStamp kind={kind} initial={lastSync?.toISOString() ?? null} />
      </p>
      <Suspense fallback={null}>
        <DongFocus />
      </Suspense>

      {main.length === 0 && folded.length === 0 ? (
        <p>등록 기준으로 해당하는 곳이 없어요. 아래 다른 조건이나 이웃 지역을 확인하세요.</p>
      ) : null}
      <ul className="cards cards--3" data-region-list="">
        {main.map((i) => (
          <InstitutionCard key={i.id} item={i} page={page} dong={i.dong} meta={situationTime(i.hours, situation)} />
        ))}
      </ul>
      {folded.length ? (
        <details>
          <summary className="chip">{`한의원·치과도 보기 (${folded.length}곳)`}</summary>
          <ul className="cards cards--3" data-region-list="">
            {folded.map((i) => (
              <InstitutionCard key={i.id} item={i} page={page} dong={i.dong} meta={situationTime(i.hours, situation)} />
            ))}
          </ul>
        </details>
      ) : null}

      <section>
        <h2>다른 목록</h2>
        <div className="chips">
          <Link className="chip" href={regionPath(sido, sigungu, otherKind, situation)}>
            {`${sigungu} ${situation === 'all' ? '' : `${SITUATIONS[situation]} `}${KIND_LABEL[otherKind]}`}
          </Link>
          {siblings.map((g) => (
            <Link key={g.sigungu} className="chip" href={regionPath(sido, g.sigungu, kind, situation)}>
              {g.sigungu}
            </Link>
          ))}
        </div>
      </section>
      <EmergencyNote />
    </main>
  );
}
