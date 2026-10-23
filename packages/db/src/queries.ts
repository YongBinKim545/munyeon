import type { Category, RawHours } from '@munyeon/core';
import type { Sql } from './client.ts';

export type Kind = 'hospital' | 'pharmacy';

/** 워커가 공공 API item 하나를 정규화한 결과 */
export interface InstitutionRow {
  id: string;
  kind: Kind;
  name: string;
  divName: string | null;
  addr: string;
  sido: string | null;
  sigungu: string | null;
  tel: string | null;
  lat: number | null;
  lon: number | null;
  hours: RawHours;
  hasHours: boolean;
  raw: Record<string, string>;
  contentHash: string;
  category: Category;
  specialty: string | null;
  dong: string | null;
  pediatricName: boolean;
  hasSunday: boolean;
  hasHoliday: boolean;
  hasNight: boolean;
}

export interface InstitutionSummary {
  id: string;
  kind: Kind;
  name: string;
  divName: string | null;
  addr: string;
  tel: string | null;
  hours: RawHours;
  hasHours: boolean;
  category: Category;
  specialty: string | null;
  pediatricName: boolean;
  dong: string | null;
  lat: number | null;
  lon: number | null;
  distanceM?: number;
}

export interface InstitutionRecord extends InstitutionSummary {
  sido: string | null;
  sigungu: string | null;
  hasGeom: boolean;
  isActive: boolean;
  updatedAt: Date;
}

const UPSERT_BATCH = 1000;

/**
 * content_hash가 바뀐 행(또는 비활성→재등장)만 갱신한다. 그대로인 행은 건드리지 않는다.
 * updated_at은 내용이 바뀐 시각이며 사이트맵 lastmod로 쓴다.
 */
export async function upsertInstitutions(
  sql: Sql,
  rows: InstitutionRow[],
  runAt: Date,
): Promise<{ inserted: number; changed: number; changedIds: string[] }> {
  let inserted = 0;
  let changed = 0;
  const changedIds: string[] = [];
  // 같은 ID가 한 명령에 두 번 들어가면 Postgres가 거부하므로 마지막 행만 남긴다.
  const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
  for (let i = 0; i < unique.length; i += UPSERT_BATCH) {
    const batch = unique.slice(i, i + UPSERT_BATCH).map((r) => ({
      id: r.id, kind: r.kind, name: r.name, div_name: r.divName, addr: r.addr, sido: r.sido,
      sigungu: r.sigungu, tel: r.tel, lat: r.lat, lon: r.lon, hours: r.hours, raw: r.raw,
      content_hash: r.contentHash, has_hours: r.hasHours, category: r.category, specialty: r.specialty,
      dong: r.dong, pediatric_name: r.pediatricName, has_sunday: r.hasSunday, has_holiday: r.hasHoliday,
      has_night: r.hasNight,
    }));
    const res = await sql<{ id: string; is_insert: boolean }[]>`
      with input as (
        select * from jsonb_to_recordset(${sql.json(batch)}::jsonb) as x(
          id text, kind text, name text, div_name text, addr text, sido text, sigungu text, tel text,
          lat double precision, lon double precision, hours jsonb, raw jsonb, content_hash text, has_hours boolean,
          category text, specialty text, dong text, pediatric_name boolean, has_sunday boolean, has_holiday boolean,
          has_night boolean)
      ), up as (
        insert into institutions as t (id, kind, name, div_name, addr, sido, sigungu, tel, lat, lon, hours, raw,
          content_hash, has_hours, category, specialty, dong, pediatric_name, has_sunday, has_holiday, has_night,
          first_seen_at, updated_at, is_active)
        select id, kind, name, div_name, addr, sido, sigungu, tel, lat, lon, hours, raw,
          content_hash, has_hours, category, specialty, dong, pediatric_name, has_sunday, has_holiday, has_night,
          ${runAt}, ${runAt}, true
        from input
        on conflict (id) do update set
          kind = excluded.kind, name = excluded.name, div_name = excluded.div_name, addr = excluded.addr,
          sido = excluded.sido, sigungu = excluded.sigungu, tel = excluded.tel, lat = excluded.lat,
          lon = excluded.lon, hours = excluded.hours, raw = excluded.raw, content_hash = excluded.content_hash,
          has_hours = excluded.has_hours, category = excluded.category, specialty = excluded.specialty,
          dong = excluded.dong, pediatric_name = excluded.pediatric_name, has_sunday = excluded.has_sunday,
          has_holiday = excluded.has_holiday, has_night = excluded.has_night, updated_at = excluded.updated_at,
          is_active = true
        where t.content_hash is distinct from excluded.content_hash or not t.is_active
           or t.sido is distinct from excluded.sido or t.sigungu is distinct from excluded.sigungu
           or t.category is distinct from excluded.category or t.specialty is distinct from excluded.specialty
           or t.dong is distinct from excluded.dong or t.pediatric_name is distinct from excluded.pediatric_name
           or t.has_sunday is distinct from excluded.has_sunday or t.has_holiday is distinct from excluded.has_holiday
           or t.has_night is distinct from excluded.has_night
        returning t.id, (xmax = 0) as is_insert
      )
      select id, is_insert from up`;
    for (const r of res) {
      if (r.is_insert) inserted++;
      else {
        changed++;
        changedIds.push(r.id);
      }
    }
  }
  return { inserted, changed, changedIds };
}

/**
 * 이번 전체 동기화에서 보이지 않은 기관을 비활성화한다. 모든 페이지가 성공했을 때만 호출한다.
 * 비활성화한 ID를 돌려줘 캐시된 상세 페이지도 갱신하게 한다.
 */
export async function deactivateMissing(sql: Sql, kind: Kind, seenIds: string[], runAt: Date): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    update institutions set is_active = false, updated_at = ${runAt}
    where kind = ${kind} and is_active and not (id = any(${sql.array(seenIds)}::text[]))
    returning id`;
  return rows.map((r) => r.id);
}

/**
 * since 이후 새로 생기거나 바뀌거나 비활성화된 기관이 속한 지역(시군구×유형). 워커가 그 지역 페이지 캐시도 갱신하게 한다(P0-10).
 * updated_at은 내용이 바뀐 시각이라(upsert·deactivate가 함께 기록) 이것 하나로 모두 잡힌다.
 */
export async function listChangedRegions(sql: Sql, since: Date): Promise<{ kind: Kind; sido: string; sigungu: string }[]> {
  return sql<{ kind: Kind; sido: string; sigungu: string }[]>`
    select distinct kind, sido, sigungu from institutions
    where updated_at >= ${since} and sido is not null and sigungu is not null
    order by sido, sigungu, kind`;
}

const summaryCols = (sql: Sql) => sql`
  i.id, i.kind, i.name, i.div_name as "divName", i.addr, i.tel, i.hours, i.has_hours as "hasHours",
  i.category, i.specialty, i.pediatric_name as "pediatricName", i.dong, i.lat, i.lon`;

export async function getInstitution(sql: Sql, kind: Kind, id: string): Promise<InstitutionRecord | null> {
  const [row] = await sql<InstitutionRecord[]>`
    select ${summaryCols(sql)}, i.sido, i.sigungu, (i.geom is not null) as "hasGeom",
           i.is_active as "isActive", i.updated_at as "updatedAt"
    from institutions i where i.id = ${id} and i.kind = ${kind}`;
  return row ?? null;
}

/** 같은 종류의 가까운 활성 기관. 좌표가 없는 기관이면 빈 목록. */
export async function getNearby(sql: Sql, kind: Kind, id: string, limit = 5, radiusM = 3000): Promise<InstitutionSummary[]> {
  const rows = await sql<InstitutionSummary[]>`
    select ${summaryCols(sql)}, round(ST_Distance(i.geom, t.geom))::int as "distanceM"
    from institutions t
    join institutions i on i.kind = t.kind and i.id <> t.id and i.is_active and i.geom is not null
      and ST_DWithin(i.geom, t.geom, ${radiusM})
    where t.id = ${id} and t.kind = ${kind} and t.geom is not null
    order by ST_Distance(i.geom, t.geom)
    limit ${limit}`;
  return rows;
}

/** 지역 화면의 목록(D69). 메인 목록과 같은 모양(격자 줄)으로 쓰도록 시도·시군구도 함께 */
export async function listRegion(sql: Sql, sido: string, sigungu: string, kind: Kind): Promise<GridRow[]> {
  return sql<GridRow[]>`
    select ${summaryCols(sql)}, i.sido, i.sigungu from institutions i
    where i.sido = ${sido} and i.sigungu = ${sigungu} and i.kind = ${kind} and i.is_active
    order by i.name, i.id`;
}

export interface RegionCount {
  sido: string;
  sigungu: string;
  hospital: number;
  pharmacy: number;
}

export async function listRegions(sql: Sql): Promise<RegionCount[]> {
  return sql<RegionCount[]>`
    select sido, sigungu,
      count(*) filter (where kind = 'hospital')::int as hospital,
      count(*) filter (where kind = 'pharmacy')::int as pharmacy
    from institutions where is_active and sido is not null and sigungu is not null
    group by sido, sigungu order by sido, sigungu`;
}

export interface SitemapEntry {
  kind: Kind;
  id: string;
  updatedAt: Date;
}

/** 색인 대상: 활성이고 진료시간 정보가 있는 기관 */
export async function countSitemapEntries(sql: Sql): Promise<number> {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from institutions where is_active and has_hours`;
  return r?.n ?? 0;
}

export async function listSitemapEntries(sql: Sql, offset: number, limit: number): Promise<SitemapEntry[]> {
  return sql<SitemapEntry[]>`
    select kind, id, updated_at as "updatedAt" from institutions
    where is_active and has_hours order by id offset ${offset} limit ${limit}`;
}

export async function getHolidays(sql: Sql, fromYmd: string, toYmd: string): Promise<string[]> {
  const rows = await sql<{ ymd: string }[]>`
    select to_char(ymd, 'YYYY-MM-DD') as ymd from holidays where ymd between ${fromYmd} and ${toYmd} order by ymd`;
  return rows.map((r) => r.ymd);
}

export async function upsertHolidays(sql: Sql, rows: { ymd: string; name: string }[], source: string): Promise<number> {
  if (rows.length === 0) return 0;
  const res = await sql`
    insert into holidays (ymd, name, source)
    select ymd::date, name, ${source} from jsonb_to_recordset(${sql.json(rows)}::jsonb) as x(ymd text, name text)
    on conflict (ymd) do update set name = excluded.name, source = excluded.source`;
  return res.count;
}

export const EVENT_TYPES = ['tel_tap', 'tel_copy', 'directions_tap', 'search_select', 'locate_ok', 'locate_fail', 'show_all'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** IP·UA·좌표는 받지도 저장하지도 않는다. 시각은 DB 기본값(분 단위)으로만 남는다. */
export async function insertEvent(sql: Sql, e: { type: EventType; institutionId: string | null; page: string }): Promise<void> {
  await sql`insert into events (type, institution_id, page) values (${e.type}, ${e.institutionId}, ${e.page})`;
}

export interface FeedbackRow {
  type: 'opinion' | 'correction';
  body: string;
  fields: string[];
  kind: Kind | null;
  institutionId: string | null;
  path: string | null;
}

/**
 * 개선의견·수정요청을 저장한다(D49). 10분 안에 같은 종류·내용·항목·기관이 이미 있으면 넣지 않고 false.
 * 확인과 저장을 한 문장으로 해 트랜잭션 풀러에서도 한 번에 끝난다.
 */
export async function insertFeedback(sql: Sql, f: FeedbackRow): Promise<boolean> {
  const rows = await sql`
    insert into feedback (type, body, fields, kind, institution_id, path)
    select ${f.type}, ${f.body}, ${f.fields}::text[], ${f.kind}, ${f.institutionId}, ${f.path}
    where not exists (
      select 1 from feedback
      where type = ${f.type} and body = ${f.body} and fields = ${f.fields}::text[]
        and institution_id is not distinct from ${f.institutionId}
        and created_minute > now() - interval '10 minutes'
    )
    returning id`;
  return rows.length > 0;
}

export async function startRun(sql: Sql, source: string, startedAt: Date): Promise<number> {
  const [r] = await sql<{ id: number }[]>`
    insert into sync_runs (source, started_at, status) values (${source}, ${startedAt}, 'running') returning id::int`;
  return r!.id;
}

export async function finishRun(
  sql: Sql,
  id: number,
  r: { status: 'ok' | 'failed'; pages: number; rows: number; changed: number; deactivated: number; error?: string },
): Promise<void> {
  await sql`
    update sync_runs set finished_at = now(), status = ${r.status}, pages = ${r.pages}, rows = ${r.rows},
      changed = ${r.changed}, deactivated = ${r.deactivated}, error = ${r.error ?? null}
    where id = ${id}`;
}

/** 페이지에 표시할 '데이터 기준 시각': 해당 종류의 마지막 성공 동기화 */
/** 마지막으로 성공한 수집 시각. source는 기관 종류 또는 'holidays'(D46) */
export async function getLastSyncAt(sql: Sql, source: Kind | 'holidays'): Promise<Date | null> {
  const [r] = await sql<{ at: Date | null }[]>`
    select max(finished_at) as at from sync_runs where source = ${source} and status = 'ok'`;
  return r?.at ?? null;
}

export interface SearchHit extends InstitutionSummary {
  sido: string | null;
  sigungu: string | null;
}

/**
 * 기관 이름 부분일치(pg_trgm 색인). 와일드카드는 글자로 취급한다.
 * near가 없으면 앞부분 일치 → 짧은 이름순, 있으면 그 점에서 가까운 순(좌표 없는 기관은 맨 뒤, distanceM 없음).
 * near는 브라우저가 보낸 격자 칸의 중심점이다(사용자 좌표가 아니다, D21).
 */
export async function searchInstitutions(sql: Sql, q: string, limit = 10, near?: { lat: number; lon: number }): Promise<SearchHit[]> {
  const term = q.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  if (!term) return [];
  if (!near) {
    return sql<SearchHit[]>`
      select ${summaryCols(sql)}, i.sido, i.sigungu from institutions i
      where i.is_active and i.name ilike ${'%' + term + '%'}
      order by (i.name ilike ${term + '%'}) desc, length(i.name), i.name
      limit ${limit}`;
  }
  const rows = await sql<(SearchHit & { distanceM: number | null })[]>`
    with p as (select ST_SetSRID(ST_MakePoint(${near.lon}::float8, ${near.lat}::float8), 4326)::geography as g)
    select ${summaryCols(sql)}, i.sido, i.sigungu, round(ST_Distance(i.geom, p.g))::int as "distanceM"
    from institutions i, p
    where i.is_active and i.name ilike ${'%' + term + '%'}
    order by i.geom is null, i.geom <-> p.g, i.name, i.id
    limit ${limit}`;
  return rows.map(({ distanceM, ...r }) => (distanceM === null ? r : { ...r, distanceM }));
}

export interface GridRow extends InstitutionSummary {
  sido: string | null;
  sigungu: string | null;
}

/**
 * 격자 한 칸의 활성 기관(좌표 있는 곳만), 이름순. 메인 목록의 원본이며 CDN에 1시간 캐시된다.
 * level 'fine'은 약 1km 칸(첫 화면용), 'coarse'는 약 5km 칸.
 */
export async function listGridCell(sql: Sql, kind: Kind, gy: number, gx: number, level: 'coarse' | 'fine' = 'coarse'): Promise<GridRow[]> {
  const cond = level === 'fine'
    ? sql`i.fgrid_y = ${gy} and i.fgrid_x = ${gx}`
    : sql`i.grid_y = ${gy} and i.grid_x = ${gx}`;
  return sql<GridRow[]>`
    select ${summaryCols(sql)}, i.sido, i.sigungu from institutions i
    where i.kind = ${kind} and ${cond} and i.is_active
    order by i.name, i.id`;
}

/** 동네 목록을 다시 계산한다(동기화 끝마다). 반환값은 행 수. */
export async function refreshNeighborhoods(sql: Sql): Promise<number> {
  return sql.begin(async (tx) => {
    await tx`delete from neighborhoods`;
    const res = await tx`
      insert into neighborhoods (name, sido, sigungu, lat, lon, n)
      select name, sido, sigungu,
             percentile_cont(0.5) within group (order by lat), percentile_cont(0.5) within group (order by lon), count(*)
      from (
        select dong as name, sido, sigungu, lat, lon from institutions
        where is_active and dong is not null and sido is not null and sigungu is not null
        union all
        select sigungu as name, sido, sigungu, lat, lon from institutions
        where is_active and sido is not null and sigungu is not null
      ) x
      group by name, sido, sigungu`;
    return res.count;
  });
}

export interface Neighborhood {
  name: string;
  sido: string;
  sigungu: string;
  lat: number | null;
  lon: number | null;
}

export async function listNeighborhoods(sql: Sql): Promise<Neighborhood[]> {
  const rows = await sql<Neighborhood[]>`
    select name, sido, sigungu, round(lat::numeric, 4)::float8 as lat, round(lon::numeric, 4)::float8 as lon
    from neighborhoods order by name, sido, sigungu`;
  return rows.map((r) => ({ ...r }));
}

export async function listSido(sql: Sql): Promise<{ sido: string; hospital: number; pharmacy: number }[]> {
  return sql<{ sido: string; hospital: number; pharmacy: number }[]>`
    select sido,
      count(*) filter (where kind = 'hospital')::int as hospital,
      count(*) filter (where kind = 'pharmacy')::int as pharmacy
    from institutions where is_active and sido is not null
    group by sido order by sido`;
}

/** 지역 요약 수치: 전체 기관 수, 공휴일·일요일 진료시간 등록 수 */
export async function getRegionStats(
  sql: Sql, sido: string, sigungu: string, kind: Kind,
): Promise<{ total: number; withHoliday: number; withSunday: number }> {
  const [r] = await sql<{ total: number; withHoliday: number; withSunday: number }[]>`
    select count(*)::int as total,
      count(*) filter (where hours ? 'dutyTime8s')::int as "withHoliday",
      count(*) filter (where hours ? 'dutyTime7s')::int as "withSunday"
    from institutions where is_active and sido = ${sido} and sigungu = ${sigungu} and kind = ${kind}`;
  return r ?? { total: 0, withHoliday: 0, withSunday: 0 };
}

export interface LandingCount {
  sido: string;
  sigungu: string;
  kind: Kind;
  all: number;
  sunday: number;
  holiday: number;
  night: number;
}

/**
 * 사이트맵용: 시군구 × 유형별 지역 랜딩의 기관 수. 워커가 core의 situationFlags로 저장한 플래그를 세므로
 * 웹 랜딩 필터(같은 함수)와 기준이 같다.
 */
export async function listLandingCounts(sql: Sql): Promise<LandingCount[]> {
  return sql<LandingCount[]>`
    select sido, sigungu, kind, count(*)::int as "all",
      count(*) filter (where has_sunday)::int as sunday,
      count(*) filter (where has_holiday)::int as holiday,
      count(*) filter (where has_night)::int as night
    from institutions where is_active and sido is not null and sigungu is not null
    group by sido, sigungu, kind order by sido, sigungu, kind`;
}
