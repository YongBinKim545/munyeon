import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from './Breadcrumbs';
import { DataStamp } from './DataStamp';
import { RegionScreen } from './RegionScreen';
import { loadHolidays, loadLastSync, loadRegion, loadRegions, loadRegionStats } from '@/lib/data';
import { regionCenter } from '@/lib/region';
import { regionSummary } from '@/lib/regionSummary';
import { institutionPath, KIND_LABEL, openGraphFor, regionPath, regionShortName, type Kind } from '@/lib/seo';

/** 지역 화면의 제목·설명(P0-2: 시도 약칭). 일요일·공휴일 검색어도 이 한 페이지가 받는다(D69) */
export function regionMetadata(sido: string, sigungu: string, kind: Kind): Metadata {
  const area = regionShortName(sido, sigungu);
  const k = KIND_LABEL[kind];
  const hours = kind === 'pharmacy' ? '영업시간' : '진료시간';
  const title = `${area} ${k} — 지금 문 연 곳·일요일·공휴일 ${hours}`;
  const description = `${sido} ${sigungu}에서 지금 문 연 ${k}과 일요일·공휴일 ${hours}, 전화번호. 방문 전 전화로 확인하세요.`;
  const path = regionPath(sido, sigungu, kind);
  return { title, description, alternates: { canonical: path }, openGraph: openGraphFor(path, title, description) };
}

/**
 * 지역 화면(D69): /시도/시군구(약국), /시도/시군구/병원. 위는 메인과 같은 목록(브라우저), 아래는 검색엔진·글자 화면용
 * 이름순 전체 목록(서버 HTML, 이름·동과 상세 링크). 현재 상태는 서버 HTML에 넣지 않는다(D23).
 * 페이지를 작게 유지한다(D80): 목록 데이터는 브라우저가 따로 받고, 전체 목록에는 진료시간 요약을 넣지 않는다.
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
      {/* 검색으로 처음 도착한 사람이 첫 화면에서 답을 얻는 요약(P0-3). 진료시간에서 나온 고정 정보만 */}
      <p className="region-summary">{regionSummary({ area, kind, rows, stats, lastSync })}</p>
      <RegionScreen
        sido={sido}
        sigungu={sigungu}
        kind={kind}
        center={regionCenter(rows)}
        holidays={holidays}
        paths={{ pharmacy: regionPath(sido, sigungu, 'pharmacy'), hospital: regionPath(sido, sigungu, 'hospital') }}
      />
      <details className="region-directory">
        <summary>{`${area} ${k} 전체 ${rows.length}곳 (이름순)`}</summary>
        <ul>
          {rows.map((r) => (
            // 가벼운 <a>와 글자만(D80): 1천 곳이 넘는 지역은 Link·span만으로 페이지 데이터가 수백 KB가 됐다
            <li key={r.id}>
              <a href={institutionPath(r.kind, r.id)}>{r.name}</a>
              {` · ${r.dong ?? sigungu}`}
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
