import type { WeeklyHours } from './hours.ts';

export interface SituationFlags {
  sunday: boolean;
  holiday: boolean;
  night: boolean;
}

const NIGHT_CLOSE = 22 * 60;
const WEEKDAYS = [1, 2, 3, 4, 5] as const;

/**
 * 지역 랜딩의 상황 조건(기능 정의서 4.2). 워커가 동기화 때 저장하고(사이트맵 집계),
 * 웹 랜딩 필터도 같은 함수를 써서 사이트맵과 noindex 판정이 어긋나지 않게 한다.
 * 야간 = 평일 중 하루라도 22:00 이후까지(자정 넘김 포함).
 */
export function situationFlags(w: WeeklyHours): SituationFlags {
  return {
    sunday: w[7] !== null,
    holiday: w[8] !== null,
    night: WEEKDAYS.some((d) => (w[d]?.close ?? 0) >= NIGHT_CLOSE),
  };
}
