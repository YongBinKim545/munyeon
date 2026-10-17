import type { DayCode, DayRange } from './hours.ts';

export const DAY_LABELS: Record<DayCode, string> = {
  1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토', 7: '일', 8: '공휴일',
};

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function formatMinute(m: number): string {
  return m > 1440 ? `익일 ${hhmm(m - 1440)}` : hhmm(m);
}

export function formatRange(r: DayRange | null): string {
  if (!r) return '정보 없음';
  if (r.open === 0 && r.close === 1440) return '24시간';
  return `${hhmm(r.open)}~${formatMinute(r.close)}`;
}
