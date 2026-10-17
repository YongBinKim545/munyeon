import { fetchPortal, type FetchOptions, type Page } from './portal.ts';

/** 한국천문연구원 특일 정보 — 공휴일(대체공휴일 포함) */
export const KASI_REST_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';

export function fetchKasiYear(year: number, opts?: FetchOptions): Promise<Page> {
  return fetchPortal(KASI_REST_URL, { solYear: year, numOfRows: 100, pageNo: 1 }, `holidays ${year}`, opts);
}

export function parseKasi(items: Record<string, string>[]): { ymd: string; name: string }[] {
  const out: { ymd: string; name: string }[] = [];
  for (const it of items) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(it.locdate ?? '');
    if (it.isHoliday !== 'Y' || !m) continue;
    out.push({ ymd: `${m[1]}-${m[2]}-${m[3]}`, name: it.dateName ?? '공휴일' });
  }
  return out;
}

export interface HolidayDeps {
  fetchYear(year: number): Promise<Page>;
  upsert(rows: { ymd: string; name: string }[]): Promise<number>;
}

/** 모든 연도를 받은 뒤에만 저장한다. 실패하면 기존(seed 포함) 데이터를 그대로 둔다. */
export async function syncHolidays(years: number[], deps: HolidayDeps): Promise<number> {
  const rows: { ymd: string; name: string }[] = [];
  for (const y of years) rows.push(...parseKasi((await deps.fetchYear(y)).items));
  return deps.upsert(rows);
}
