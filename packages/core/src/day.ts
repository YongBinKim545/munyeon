import type { DayRange, WeeklyHours } from './hours.ts';
import { weekdayOfYmd } from './kst.ts';
import type { TierInfo } from './list.ts';
import { formatRange } from './schedule-format.ts';
import { dayCodeFor, type StatusContext } from './status.ts';

const WEEKDAY_NAMES = ['', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'] as const;
const WEEKDAY_SHORT = ['', '월', '화', '수', '목', '금', '토', '일'] as const;

/** 날짜를 고른 목록의 한 줄 상태. range는 그날(또는 평소 그 요일) 진료시간 */
export type DayTier = TierInfo & { range?: DayRange };

/**
 * 날짜를 고른 목록(부모님 대신 일요일·공휴일 찾기)의 판정. '지금'과 같은 규칙이다(D32·D18):
 * - 그날 요일코드(공휴일이면 8)의 시간이 있으면 그날 여는 곳(open)
 * - 공휴일인데 코드 8이 없고 평소 그 요일 시간이 있으면 '전화 확인 필요'(holidayUsual)
 * - 그 밖은 '정보 없음'(unknown). 빈칸은 휴무가 아니다. 목록에서는 [전체 보기] 안으로 들어간다
 */
export function tierOnDate(hours: WeeklyHours, ymd: string, ctx: StatusContext): DayTier {
  const code = dayCodeFor(ymd, ctx);
  const range = hours[code];
  if (range) return { tier: 'open', range };
  if (code === 8) {
    const wd = weekdayOfYmd(ymd);
    const usual = hours[wd];
    if (usual) return { tier: 'holidayUsual', weekdayLabel: WEEKDAY_NAMES[wd], range: usual };
  }
  return { tier: 'unknown' };
}

/** '10/25(일)' */
export function dateLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}/${d}(${WEEKDAY_SHORT[weekdayOfYmd(ymd)]})`;
}

/** '09:00~18:00', '20:00~익일 03:00', '24시간' (상세 진료시간표와 같은 표기) */
export function dayLabel(range: DayRange): string {
  return formatRange(range);
}
