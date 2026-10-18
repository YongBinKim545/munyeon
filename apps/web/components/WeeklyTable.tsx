import { DAY_CODES, DAY_LABELS, formatRange, hasAnyHours, parseWeeklyHours, type RawHours } from '@munyeon/core';

/** 요일별 진료시간표(월~일 + 공휴일). 비어 있으면 '정보 없음'(휴무가 아님). 오늘 행 강조는 LiveStatus가 한다. */
export function WeeklyTable({ hours }: { hours: RawHours }) {
  const week = parseWeeklyHours(hours);
  if (!hasAnyHours(week)) return <p className="notice">등록된 진료시간이 없어요 — 전화로 확인</p>;
  return (
    <table className="hours">
      <tbody>
        {DAY_CODES.map((d) => (
          <tr key={d} data-day={d}>
            <th scope="row">{DAY_LABELS[d]}</th>
            <td className={week[d] ? undefined : 'unknown'}>{formatRange(week[d])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
