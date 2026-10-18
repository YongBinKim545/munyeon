'use client';

import { dayCodeFor, describeStatus, kstParts, parseWeeklyHours, type RawHours, type StatusText } from '@munyeon/core';
import { useEffect, useState } from 'react';
import { useMeta } from '@/lib/meta';

/**
 * 지금 상태는 브라우저에서 현재 시각으로 계산한다(캐시된 HTML에 넣지 않음, CLAUDE.md).
 * 서버 렌더에서는 빈 자리만 그린다. 진료시간표의 오늘 행도 여기서 강조한다.
 * 공휴일은 /api/meta의 최신 목록을 우선 쓴다(캐시된 페이지 이후 지정된 임시공휴일 반영).
 */
export function LiveStatus({ hours, holidays }: { hours: RawHours; holidays: string[] }) {
  const [s, setS] = useState<StatusText | null>(null);
  const meta = useMeta();
  const effectiveHolidays = meta?.holidays ?? holidays;

  useEffect(() => {
    const week = parseWeeklyHours(hours);
    const ctx = { holidays: new Set(effectiveHolidays) };
    const tick = () => {
      const now = new Date();
      setS(describeStatus(week, now, ctx));
      const code = String(dayCodeFor(kstParts(now).ymd, ctx));
      document.querySelectorAll('tr[data-day]').forEach((tr) => {
        tr.setAttribute('data-today', String(tr.getAttribute('data-day') === code));
      });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [hours, effectiveHolidays]);

  if (!s) return <div className="status status--unknown" aria-hidden="true" />;
  return (
    <div className={`status status--${s.tone}`} role="status">
      {s.text}
      {s.holiday ? <span className="holiday-note">오늘은 공휴일 · 공휴일 진료시간 기준</span> : null}
    </div>
  );
}
