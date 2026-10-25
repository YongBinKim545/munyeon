import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from './Breadcrumbs';
import { DataStamp } from './DataStamp';
import { RegionScreen } from './RegionScreen';
import { loadHolidays, loadLastSync, loadRegion, loadRegions, loadRegionStats } from '@/lib/data';
import { encodeGrid } from '@/lib/grid';
import { summarizeWeek } from '@/lib/weekSummary';
import { regionCenter } from '@/lib/region';
import { institutionPath, KIND_LABEL, regionPath, regionShortName, type Kind } from '@/lib/seo';

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** 지역 화면의 제목·설명(P0-2: 시도 약칭). 일요일·공휴일 검색어도 이 한 페이지가 받는다(D69) */
export function regionMetadata(sido: string, sigungu: string, kind: Kind): Metadata {
  const area = regionShortName(sido, sigungu);
  const k = KIND_LABEL[kind];
  const hours = kind === 'pharmacy' ? '영업시간' : '진료시간';
  return {
    title: `${area} ${k} — 지금 문 연 곳·일요일·공휴일 ${hours}`,
    description: `${sido} ${sigungu}에서 지금 문 연 ${k}과 일요일·공휴일 ${hours}, 전화번호. 방문 전 전화로 확인하세요.`,
    alternates: { canonical: regionPath(sido, sigungu, kind) },
  };
}

/**
 * 지역 화면(D69): /시도/시군구(약국), /시도/시군구/병원. 위는 메인과 같은 목록(브라우저), 아래는 검색엔진·글자 화면용
 * 이름순 전체 목록(서버 HTML, 진료시간 요약과 상세 링크). 현재 상태는 서버 HTML에 넣지 않는다(D23).
 */
export async function RegionPage({ sido, sigungu, kind }: { sido: string; sigungu: string; kind: Kind }) {
  const [rows, regions] = await Promise.all([loadRegion(sido, sigungu, kind), loadRegions()]);
  if (rows.length === 0 && !regions.some((x) => x.sido === sido && x.sigungu === sigungu)) notFound();
  const [stats, holidays, lastSync] = await Promise.all([loadRegionStats(sido, sigungu, kind), loadHolidays(), loadLastSync(kind)]);
  const siblings = regions.filter((x) => x.sido === sido && x.sigungu !== sigungu);
  const area = regionShortName(sido, sigungu);
  const k = KIND_LABEL[kind];

  return (
    <main className="container container--wide">
      <Breadcrumbs
        items={[
          { name: sido, href: regionPath(sido) },
          { name: sigungu, href: regionPath(sido, sigungu) },
          ...(kind === 'hospital' ? [{ name: k, href: regionPath(sido, sigungu, kind) }] : []),
        ]}
      />
      <h1>{`${area} ${k}`}</h1>
      <p className="muted">
        {`등록 ${stats.total}곳 · 일요일 ${stats.withSunday}곳 · 공휴일 시간 등록 ${pct(stats.withHoliday, stats.total)}%`}
      </p>
      <RegionScreen
        sido={sido}
        sigungu={sigungu}
        kind={kind}
        payload={encodeGrid(rows)}
        center={regionCenter(rows)}
        holidays={holidays}
        paths={{ pharmacy: regionPath(sido, sigungu, 'pharmacy'), hospital: regionPath(sido, sigungu, 'hospital') }}
      />
      <details className="region-directory">
        <summary>{`${area} ${k} 전체 ${rows.length}곳 (이름순)`}</summary>
        <ul>
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={institutionPath(r.kind, r.id)} prefetch={false}>
                {r.name}
              </Link>
              <span className="muted">{` · ${r.dong ?? sigungu} · ${summarizeWeek(r.hours)}`}</span>
            </li>
          ))}
        </ul>
        <p className="muted">
          <DataStamp kind={kind} initial={lastSync?.toISOString() ?? null} />
        </p>
      </details>
      {siblings.length ? (
        <section>
          <h2>{`${sido}의 다른 지역`}</h2>
          <div className="chips">
            {siblings.map((g) => (
              <Link key={g.sigungu} className="chip" href={regionPath(sido, g.sigungu, kind)}>
                {g.sigungu}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
