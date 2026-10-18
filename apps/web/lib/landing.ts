import { DAY_LABELS, formatRange, parseWeeklyHours, situationFlags, type RawHours } from '@munyeon/core';
import type { InstitutionSummary } from '@munyeon/db';
import type { Situation } from './seo';

const NIGHT_CLOSE = 22 * 60;
const WEEKDAYS = [1, 2, 3, 4, 5] as const;

/** 지역 랜딩의 상황 조건(기능 정의서 4.2) */
export function matchesSituation(hours: RawHours, s: Situation): boolean {
  return s === 'all' || situationFlags(parseWeeklyHours(hours))[s];
}

/** 병원 목록은 일반 진료를 먼저, 한의원·치과·기타는 끝에 접는다(D26) */
export function splitByCategory(items: InstitutionSummary[]): { main: InstitutionSummary[]; folded: InstitutionSummary[] } {
  const main: InstitutionSummary[] = [];
  const folded: InstitutionSummary[] = [];
  for (const i of items) (i.kind === 'hospital' && i.category !== 'general' ? folded : main).push(i);
  return { main, folded };
}

/** 3곳 미만이면 얇은 페이지로 보고 noindex(D6) */
export function landingIndexable(count: number): boolean {
  return count >= 3;
}

/** '평일 09:00~18:00 · 토 09:00~13:00' 같은 한 줄 요약 */
export function summarizeWeek(hours: RawHours): string {
  const w = parseWeeklyHours(hours);
  const parts: string[] = [];
  const weekdayTexts = WEEKDAYS.map((d) => formatRange(w[d]));
  if (w[1] && weekdayTexts.every((t) => t === weekdayTexts[0])) parts.push(`평일 ${weekdayTexts[0]}`);
  else if (w[1]) parts.push(`${DAY_LABELS[1]} ${formatRange(w[1])}`);
  if (w[6]) parts.push(`${DAY_LABELS[6]} ${formatRange(w[6])}`);
  if (w[7]) parts.push(`${DAY_LABELS[7]} ${formatRange(w[7])}`);
  return parts.length ? parts.join(' · ') : '진료시간 정보 없음';
}

/** 카드에 보여줄 '해당 상황의 시간' */
export function situationTime(hours: RawHours, s: Situation): string {
  const w = parseWeeklyHours(hours);
  if (s === 'sunday') return `${DAY_LABELS[7]} ${formatRange(w[7])}`;
  if (s === 'holiday') return `${DAY_LABELS[8]} ${formatRange(w[8])}`;
  if (s === 'night') {
    const d = WEEKDAYS.find((x) => (w[x]?.close ?? 0) >= NIGHT_CLOSE);
    if (d) return `${DAY_LABELS[d]} ${formatRange(w[d])}`;
  }
  return summarizeWeek(hours);
}
