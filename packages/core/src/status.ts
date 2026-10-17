import type { DayCode, WeeklyHours } from './hours.ts';
import { addDaysYmd, kstDate, kstParts, weekdayOfYmd } from './kst.ts';

export type OpenState = 'open' | 'closed' | 'unknown';

export interface OpenStatus {
  state: OpenState;
  /** 오늘 판정에 쓴 요일코드의 종류 */
  basis: 'weekday' | 'holiday';
  /** state === 'open'일 때 마감 시각 */
  closesAt?: Date;
  /** state === 'closed'이고 오늘 안에 다시 열 때 */
  opensAt?: Date;
}

export interface StatusContext {
  /** 'YYYY-MM-DD' (KST) */
  holidays: ReadonlySet<string>;
}

export function dayCodeFor(ymd: string, ctx: StatusContext): DayCode {
  return ctx.holidays.has(ymd) ? 8 : weekdayOfYmd(ymd);
}

/**
 * 공표 진료시간 기준 판정(우선순위 체인의 1·2단계: 요일 → 공휴일 코드 8).
 * 명절 당직·사용자 확인 오버라이드는 이 결과 위에 덧씌운다(Phase 1b).
 */
export function getOpenStatus(hours: WeeklyHours, at: Date, ctx: StatusContext): OpenStatus {
  const { ymd, minute } = kstParts(at);
  const todayCode = dayCodeFor(ymd, ctx);
  const basis = todayCode === 8 ? 'holiday' : 'weekday';

  // 전날 시작해 자정을 넘긴 구간 (전날의 요일코드로 판정)
  const yesterday = addDaysYmd(ymd, -1);
  const prev = hours[dayCodeFor(yesterday, ctx)];
  if (prev && prev.close > 1440 && minute < prev.close - 1440) {
    return { state: 'open', basis, closesAt: kstDate(yesterday, prev.close) };
  }

  const today = hours[todayCode];
  if (!today) return { state: 'unknown', basis };
  if (minute >= today.open && minute < today.close) {
    return { state: 'open', basis, closesAt: kstDate(ymd, today.close) };
  }
  if (minute < today.open) {
    return { state: 'closed', basis, opensAt: kstDate(ymd, today.open) };
  }
  return { state: 'closed', basis };
}
