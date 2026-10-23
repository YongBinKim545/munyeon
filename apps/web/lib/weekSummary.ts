import { DAY_LABELS, formatRange, parseWeeklyHours, type RawHours } from '@munyeon/core';

const WEEKDAYS = [1, 2, 3, 4, 5] as const;

/** 지역 화면 이름순 목록의 한 줄 요약: '평일 09:00~18:00 · 토 09:00~13:00 · 일 10:00~14:00 · 공휴일 10:00~14:00' */
export function summarizeWeek(hours: RawHours): string {
  const w = parseWeeklyHours(hours);
  const parts: string[] = [];
  const weekdayTexts = WEEKDAYS.map((d) => formatRange(w[d]));
  if (w[1] && weekdayTexts.every((t) => t === weekdayTexts[0])) parts.push(`평일 ${weekdayTexts[0]}`);
  else if (w[1]) parts.push(`${DAY_LABELS[1]} ${formatRange(w[1])}`);
  for (const d of [6, 7, 8] as const) if (w[d]) parts.push(`${DAY_LABELS[d]} ${formatRange(w[d])}`);
  return parts.length ? parts.join(' · ') : '진료시간 정보 없음';
}
