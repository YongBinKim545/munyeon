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

/** 공휴일 수집이 이 기간 넘게 한 번도 성공하지 않으면 작업 실패로 알린다(D46) */
export const HOLIDAY_STALE_MS = 7 * 24 * 3_600_000;

/**
 * 해외 러너(GitHub Actions)에서 특일 API 연결이 자주 끊긴다(2026-10-21~22 세 번 중 두 번 실패, 국내에서는 정상).
 * 공휴일은 드물게 바뀌므로, 최근 7일 안에 성공한 적이 있으면 실패해도 경고만 남긴다.
 */
export function holidayFailureIsFatal(lastOkAt: Date | null, now: Date): boolean {
  return !lastOkAt || now.getTime() - lastOkAt.getTime() > HOLIDAY_STALE_MS;
}
