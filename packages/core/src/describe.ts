import type { WeeklyHours } from './hours.ts';
import { addDaysYmd, kstDate, kstParts } from './kst.ts';
import { dayCodeFor, getOpenStatus, type StatusContext } from './status.ts';

export type StatusTone = 'open' | 'closed' | 'unknown';

export interface StatusText {
  tone: StatusTone;
  text: string;
  /** 오늘이 공휴일이라 공휴일 진료시간(코드 8)으로 판정했는지 */
  holiday: boolean;
}

/** 마감 1시간 이내면 '곧 마감' */
export const CLOSING_SOON_MIN = 60;

/** KST 시각을 사람이 읽는 말로: 자정, 새벽 3시, 오전 9시, 낮 12시, 오후 6시 30분 */
export function koreanTime(at: Date): string {
  const { minute } = kstParts(at);
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const mm = m ? ` ${m}분` : '';
  if (h === 0 && m === 0) return '자정';
  if (h < 6) return `새벽 ${h === 0 ? 12 : h}시${mm}`;
  if (h < 12) return `오전 ${h}시${mm}`;
  if (h === 12) return `낮 12시${mm}`;
  return `오후 ${h - 12}시${mm}`;
}

/**
 * 기능 정의서 3.2의 상태 문구. '영업 중'에는 '(등록 기준)'을 붙인다.
 * 메인 목록 카드는 basis: false로 빼고 목록 맨 위에 한 번 안내한다(D42).
 */
export function describeStatus(hours: WeeklyHours, at: Date, ctx: StatusContext, { basis = true }: { basis?: boolean } = {}): StatusText {
  const b = basis ? ' (등록 기준)' : '';
  const s = getOpenStatus(hours, at, ctx);
  const holiday = s.basis === 'holiday';
  if (s.state === 'open' && s.closesAt) {
    let closesAt = s.closesAt;
    // 자정에 끝나고 다음 날이 00:00부터 이어지면 끊기지 않은 영업이다(24시간 약국이 밤에 '곧 마감'으로 보이지 않게).
    const end = kstParts(closesAt);
    if (end.minute === 0) {
      const next = hours[dayCodeFor(end.ymd, ctx)];
      const today = hours[dayCodeFor(kstParts(at).ymd, ctx)];
      if (next && next.open === 0) {
        if (next.close >= 1440 && today?.open === 0 && today.close >= 1440) {
          return { tone: 'open', text: `24시간 영업${b}`, holiday };
        }
        closesAt = kstDate(end.ymd, next.close);
      }
    }
    const left = Math.round((closesAt.getTime() - at.getTime()) / 60_000);
    const text = left <= CLOSING_SOON_MIN
      ? `곧 마감 · ${left}분 남음${b}`
      : `영업 중 · ${koreanTime(closesAt)} 마감${b}`;
    return { tone: 'open', text, holiday };
  }
  if (s.state === 'closed') {
    if (s.opensAt) return { tone: 'closed', text: `영업 전 · ${koreanTime(s.opensAt)} 시작`, holiday };
    const tomorrow = addDaysYmd(kstParts(at).ymd, 1);
    const next = hours[dayCodeFor(tomorrow, ctx)];
    if (next) {
      const opens = new Date(Date.parse(`${tomorrow}T00:00:00+09:00`) + next.open * 60_000);
      return { tone: 'closed', text: `영업 종료 · 내일 ${koreanTime(opens)} 시작`, holiday };
    }
    return { tone: 'closed', text: '영업 종료', holiday };
  }
  return { tone: 'unknown', text: '오늘 정보 없음 — 전화로 확인', holiday };
}
