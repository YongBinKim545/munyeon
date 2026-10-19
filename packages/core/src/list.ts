import type { Category } from './classify.ts';
import { koreanTime } from './describe.ts';
import type { WeeklyHours } from './hours.ts';
import { addDaysYmd, kstDate, kstParts } from './kst.ts';
import { dayCodeFor, getOpenStatus, type StatusContext } from './status.ts';

/** 메인 목록의 구간(D32). 위에서부터 open → soon → holidayUsual → (전체 보기) closed·unknown */
export type ListTier = 'open' | 'soon' | 'holidayUsual' | 'closed' | 'unknown';

export interface TierInfo {
  tier: ListTier;
  /** soon일 때 여는 시각 */
  opensAt?: Date;
  /** holidayUsual일 때 평소 시간을 쓴 요일 이름 */
  weekdayLabel?: string;
}

/** '곧 영업' 기준(분) */
export const SOON_WITHIN_MIN = 120;

const WEEKDAY_NAMES = ['', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'] as const;

/**
 * 지금 닫혀 있고 withinMin 안에 열면 여는 시각. 오늘 남은 구간과 내일 첫 구간(자정 넘김)을 본다.
 * 내일이 공휴일이면 코드 8로 본다(없으면 '정보 없음'이라 열지 않는 것으로 친다).
 */
export function nextOpening(hours: WeeklyHours, at: Date, ctx: StatusContext, withinMin = SOON_WITHIN_MIN): Date | null {
  if (getOpenStatus(hours, at, ctx).state === 'open') return null;
  const { ymd, minute } = kstParts(at);
  const limit = at.getTime() + withinMin * 60_000;
  const today = hours[dayCodeFor(ymd, ctx)];
  if (today && today.open > minute) {
    const t = kstDate(ymd, today.open);
    return t.getTime() <= limit ? t : null;
  }
  const tomorrowYmd = addDaysYmd(ymd, 1);
  const tomorrow = hours[dayCodeFor(tomorrowYmd, ctx)];
  if (tomorrow) {
    const t = kstDate(tomorrowYmd, tomorrow.open);
    if (t.getTime() <= limit) return t;
  }
  return null;
}

/**
 * 오늘이 공휴일인데 공휴일 시간(코드 8)이 없을 때, 오늘의 실제 요일 시간으로는 지금 영업 중인가.
 * 등록된 평소 시간이라는 사실만 알려주고 '영업 중'으로 판정하지는 않는다('전화 확인 필요').
 */
export function usualHoursOpen(hours: WeeklyHours, at: Date, ctx: StatusContext): { weekdayLabel: string } | null {
  const { ymd, weekday } = kstParts(at);
  if (!ctx.holidays.has(ymd) || hours[8]) return null;
  if (!hours[weekday]) return null;
  const withoutToday = new Set(ctx.holidays);
  withoutToday.delete(ymd);
  const usual = getOpenStatus(hours, at, { holidays: withoutToday });
  return usual.state === 'open' ? { weekdayLabel: WEEKDAY_NAMES[weekday] } : null;
}

export function tierOf(hours: WeeklyHours, at: Date, ctx: StatusContext): TierInfo {
  const s = getOpenStatus(hours, at, ctx);
  if (s.state === 'open') return { tier: 'open' };
  const opensAt = nextOpening(hours, at, ctx);
  if (opensAt) return { tier: 'soon', opensAt };
  const usual = usualHoursOpen(hours, at, ctx);
  if (usual) return { tier: 'holidayUsual', weekdayLabel: usual.weekdayLabel };
  return { tier: s.state };
}

const TIER_RANK: Record<ListTier, number> = { open: 0, soon: 1, holidayUsual: 2, closed: 3, unknown: 3 };
const MINOR: ReadonlySet<Category> = new Set(['oriental', 'dental', 'other']);

/**
 * 목록 순서(D32): 구간 순서 → 구간 안에서 일반 진료 먼저, 한의원·치과·기타는 맨 아래 → 거리순.
 * mode 'open'은 closed·unknown을 뺀다. 입력은 바꾸지 않는다.
 */
export function orderList<T extends { tier: ListTier; category: Category; distanceM: number }>(items: readonly T[], mode: 'open' | 'all'): T[] {
  return items
    .filter((i) => mode === 'all' || TIER_RANK[i.tier] < 3)
    .map((item, idx) => ({ item, idx }))
    .sort(
      (a, b) =>
        TIER_RANK[a.item.tier] - TIER_RANK[b.item.tier] ||
        Number(MINOR.has(a.item.category)) - Number(MINOR.has(b.item.category)) ||
        a.item.distanceM - b.item.distanceM ||
        a.idx - b.idx,
    )
    .map((x) => x.item);
}

/** '곧 영업 · 1시간 30분 뒤 오후 9시 30분' */
export function soonLabel(opensAt: Date, at: Date): string {
  const left = Math.max(1, Math.round((opensAt.getTime() - at.getTime()) / 60_000));
  const h = Math.floor(left / 60);
  const m = left % 60;
  const rel = h === 0 ? `${m}분 뒤` : m === 0 ? `${h}시간 뒤` : `${h}시간 ${m}분 뒤`;
  return `곧 영업 · ${rel} ${koreanTime(opensAt)}`;
}

/** '평소 금요일엔 이 시간 영업' */
export function usualLabel(weekdayLabel: string): string {
  return `평소 ${weekdayLabel}엔 이 시간 영업`;
}
