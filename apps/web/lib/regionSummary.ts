import { parseWeeklyHours, type DayRange, type RawHours } from '@munyeon/core';
import { KIND_LABEL, type Kind } from './seo';

const WEEKDAYS = [1, 2, 3, 4, 5] as const;

/** 자정 기준 분을 사람이 쓰는 말로: 오전 8시, 낮 12시, 오후 9시 30분, 밤 12시, 새벽 2시(다음 날) */
export function clockLabel(minute: number): string {
  if (minute === 1440) return '밤 12시';
  const m = minute % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60 ? ` ${m % 60}분` : '';
  if (h < 6) return `새벽 ${h === 0 ? 12 : h}시${mm}`;
  if (h < 12) return `오전 ${h}시${mm}`;
  if (h === 12) return `낮 12시${mm}`;
  return `오후 ${h - 12}시${mm}`;
}

const is24 = (r: DayRange) => r.open === 0 && r.close >= 1440;
const KST_MONTH_DAY = (d: Date) => {
  const k = new Date(d.getTime() + 9 * 3_600_000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
};

/**
 * 지역 화면 맨 위 요약 한 문단(P0-3). 진료시간에서 나온 고정 정보만 쓴다(현재 상태는 넣지 않음, D23).
 * 가장 늦게/일찍은 평일(월~금) 등록 시간 기준, 같으면 가나다순. 기관은 등록 사실로만 소개하고 추천하지 않는다.
 */
export function regionSummary(p: {
  area: string;
  kind: Kind;
  rows: { name: string; hours: RawHours }[];
  stats: { total: number; withSunday: number; withHoliday: number };
  lastSync: Date | null;
}): string {
  const k = KIND_LABEL[p.kind];
  if (p.stats.total === 0) return `${p.area}에 등록된 ${k}이 없어요.`;
  let latest: { name: string; r: DayRange } | null = null;
  let earliest: { name: string; r: DayRange } | null = null;
  const byName = (a: string, b: string) => a.localeCompare(b, 'ko') < 0;
  for (const row of p.rows) {
    const w = parseWeeklyHours(row.hours);
    for (const d of WEEKDAYS) {
      const r = w[d];
      if (!r) continue;
      if (!latest || r.close > latest.r.close || (r.close === latest.r.close && byName(row.name, latest.name))) latest = { name: row.name, r };
      if (!earliest || r.open < earliest.r.open || (r.open === earliest.r.open && byName(row.name, earliest.name))) earliest = { name: row.name, r };
    }
  }
  const pct = Math.round((p.stats.withHoliday / p.stats.total) * 100);
  const parts = [`${p.area} ${k}은 등록 기준 ${p.stats.total}곳이에요.`];
  if (latest && earliest) {
    const late = is24(latest.r) ? '24시간' : clockLabel(latest.r.close);
    const early = is24(earliest.r) ? '24시간' : clockLabel(earliest.r.open);
    parts.push(`평일 가장 늦게까지 하는 곳은 ${latest.name}(${late}), 가장 일찍 여는 곳은 ${earliest.name}(${early})이에요.`);
  }
  parts.push(`일요일에 여는 곳은 ${p.stats.withSunday}곳, 공휴일 시간을 등록한 곳은 ${pct}%예요.`);
  parts.push('방문 전 꼭 전화로 확인하세요.');
  parts.push(p.lastSync ? `(국립중앙의료원 자료, ${KST_MONTH_DAY(p.lastSync)} 기준)` : '(국립중앙의료원 자료)');
  return parts.join(' ');
}
