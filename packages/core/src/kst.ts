/** 한국 표준시(UTC+9, 서머타임 없음). 서버·브라우저 시간대와 무관하게 계산한다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface KstParts {
  ymd: string;
  /** 1=월 … 7=일 */
  weekday: Weekday;
  /** 자정 기준 분 */
  minute: number;
}

export function kstParts(at: Date): KstParts {
  const d = new Date(at.getTime() + KST_OFFSET_MS);
  const ymd = d.toISOString().slice(0, 10);
  const dow = d.getUTCDay(); // 0=일
  return {
    ymd,
    weekday: (dow === 0 ? 7 : dow) as Weekday,
    minute: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

export function addDaysYmd(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayOfYmd(ymd: string): Weekday {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return (dow === 0 ? 7 : dow) as Weekday;
}

/** KST 날짜 자정 + 분(1440 이상이면 다음 날)을 Date로 */
export function kstDate(ymd: string, minute: number): Date {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - KST_OFFSET_MS + minute * 60_000);
}
