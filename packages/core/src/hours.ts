/** 1=월 … 7=일, 8=공휴일 (국립중앙의료원 API의 dutyTime{n} 요일코드) */
export type DayCode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const DAY_CODES: readonly DayCode[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** 자정 기준 분. close는 open보다 크며, 자정을 넘기면 1440을 초과한다(최대 2880). */
export interface DayRange {
  open: number;
  close: number;
}

/** null은 '휴무'가 아니라 '정보 없음'이다. */
export type WeeklyHours = Record<DayCode, DayRange | null>;

export type RawHours = Partial<Record<`dutyTime${DayCode}${'s' | 'c'}`, string>>;

const HHMM = /^(\d{2})(\d{2})$/;

function toMinutes(value: string | undefined): number | null {
  const m = HHMM.exec((value ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59) return null;
  return h * 60 + min;
}

/**
 * 자정을 넘기는 두 표기를 모두 정규화한다.
 * - `0900-2500`형: 종료가 2400을 넘으면 그대로 다음 날 분으로 쓴다.
 * - `2000-0300`형: 종료가 시작보다 작으면 1440을 더한다.
 */
export function parseDayRange(start?: string, close?: string): DayRange | null {
  const open = toMinutes(start);
  let end = toMinutes(close);
  if (open === null || end === null) return null;
  if (open >= 1440 || end > 2880) return null;
  if (end === 1439) end = 1440; // 2359는 하루 끝으로 본다
  if (end < open) end += 1440;
  if (end === open || end > 2880) return null;
  return { open, close: end };
}

export function parseWeeklyHours(raw: RawHours): WeeklyHours {
  const out = {} as WeeklyHours;
  for (const d of DAY_CODES) {
    out[d] = parseDayRange(raw[`dutyTime${d}s`], raw[`dutyTime${d}c`]);
  }
  return out;
}

export function hasAnyHours(h: WeeklyHours): boolean {
  return DAY_CODES.some((d) => h[d] !== null);
}
