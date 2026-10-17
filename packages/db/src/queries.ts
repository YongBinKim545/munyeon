import type { RawHours } from '@munyeon/core';
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
  distanceM?: number;
}

export interface InstitutionRecord extends InstitutionSummary {
  sido: string | null;
  sigungu: string | null;
  lat: number | null;
  lon: number | null;
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
): Promise<{ inserted: number; changed: number }> {
  let inserted = 0;
  let changed = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH).map((r) => ({
      id: r.id, kind: r.kind, name: r.name, div_name: r.divName, addr: r.addr, sido: r.sido,
      sigungu: r.sigungu, tel: r.tel, lat: r.lat, lon: r.lon, hours: r.hours, raw: r.raw,
      content_hash: r.contentHash, has_hours: r.hasHours,
    }));
    const [res] = await sql<{ inserted: number; changed: number }[]>`
      with input as (
        select * from jsonb_to_recordset(${sql.json(batch)}::jsonb) as x(
          id text, kind text, name text, div_name text, addr text, sido text, sigungu text, tel text,
          lat double precision, lon double precision, hours jsonb, raw jsonb, content_hash text, has_hours boolean)
      ), up as (
        insert into institutions as t (id, kind, name, div_name, addr, sido, sigungu, tel, lat, lon, hours, raw,
          content_hash, has_hours, first_seen_at, updated_at, is_active)
        select id, kind, name, div_name, addr, sido, sigungu, tel, lat, lon, hours, raw,
          content_hash, has_hours, ${runAt}, ${runAt}, true
        from input
        on conflict (id) do update set
          kind = excluded.kind, name = excluded.name, div_name = excluded.div_name, addr = excluded.addr,
          sido = excluded.sido, sigungu = excluded.sigungu, tel = excluded.tel, lat = excluded.lat,
          lon = excluded.lon, hours = excluded.hours, raw = excluded.raw, content_hash = excluded.content_hash,
          has_hours = excluded.has_hours, updated_at = excluded.updated_at, is_active = true
        where t.content_hash is distinct from excluded.content_hash or not t.is_active
        returning (xmax = 0) as is_insert
      )
      select count(*) filter (where is_insert)::int as inserted,
             count(*) filter (where not is_insert)::int as changed
      from up`;
    inserted += res?.inserted ?? 0;
    changed += res?.changed ?? 0;
  }
  return { inserted, changed };
}

/** 이번 전체 동기화에서 보이지 않은 기관을 비활성화한다. 모든 페이지가 성공했을 때만 호출한다. */
export async function deactivateMissing(sql: Sql, kind: Kind, seenIds: string[], runAt: Date): Promise<number> {
  const res = await sql`
    update institutions set is_active = false, updated_at = ${runAt}
    where kind = ${kind} and is_active and not (id = any(${sql.array(seenIds)}::text[]))`;
  return res.count;
}

const summaryCols = (sql: Sql) => sql`
  i.id, i.kind, i.name, i.div_name as "divName", i.addr, i.tel, i.hours, i.has_hours as "hasHours"`;

export async function getInstitution(sql: Sql, kind: Kind, id: string): Promise<InstitutionRecord | null> {
  const [row] = await sql<InstitutionRecord[]>`
    select ${summaryCols(sql)}, i.sido, i.sigungu, i.lat, i.lon, (i.geom is not null) as "hasGeom",
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

export async function listRegion(sql: Sql, sido: string, sigungu: string, kind: Kind): Promise<InstitutionSummary[]> {
  return sql<InstitutionSummary[]>`
    select ${summaryCols(sql)} from institutions i
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
    insert into holidays ${sql(rows.map((r) => ({ ...r, source })))}
    on conflict (ymd) do update set name = excluded.name, source = excluded.source`;
  return res.count;
}

export type EventType = 'tel_tap' | 'call_119_open';

/** IP·UA·좌표는 받지도 저장하지도 않는다. 시각은 DB 기본값(분 단위)으로만 남는다. */
export async function insertEvent(sql: Sql, e: { type: EventType; institutionId: string | null; page: string }): Promise<void> {
  await sql`insert into events (type, institution_id, page) values (${e.type}, ${e.institutionId}, ${e.page})`;
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
export async function getLastSyncAt(sql: Sql, source: Kind): Promise<Date | null> {
  const [r] = await sql<{ at: Date | null }[]>`
    select max(finished_at) as at from sync_runs where source = ${source} and status = 'ok'`;
  return r?.at ?? null;
}
