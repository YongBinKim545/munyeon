import { addDaysYmd, kstParts } from '@munyeon/core';

/**
 * 목록의 '언제'(부모님 대신 일요일·공휴일 찾기). 지금 / 고른 날짜(오늘부터 MAX_DAYS일 안).
 * 이 방문(탭) 동안만 기억한다. 새로 들어오면 '지금'이다.
 */
export type When = { kind: 'now' } | { kind: 'date'; ymd: string };

export const NOW: When = { kind: 'now' };
export const MAX_DAYS = 90;
const KEY = 'munyeon:when';
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function dateRange(at: Date): { min: string; max: string } {
  const today = kstParts(at).ymd;
  return { min: today, max: addDaysYmd(today, MAX_DAYS) };
}

/** 오늘~MAX_DAYS일 안의 'YYYY-MM-DD'만 날짜로, 그 밖(지난 날짜 등)은 '지금' */
export function parseWhen(ymd: string | null | undefined, at: Date): When {
  if (!ymd || !YMD.test(ymd)) return NOW;
  const { min, max } = dateRange(at);
  return ymd >= min && ymd <= max ? { kind: 'date', ymd } : NOW;
}

export function readWhen(at: Date): When {
  try {
    return parseWhen(sessionStorage.getItem(KEY), at);
  } catch {
    return NOW;
  }
}

export function saveWhen(w: When): void {
  try {
    if (w.kind === 'date') sessionStorage.setItem(KEY, w.ymd);
    else sessionStorage.removeItem(KEY);
  } catch {
    // 저장 실패는 무시
  }
}
