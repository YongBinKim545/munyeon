import { describe, expect, test } from 'vitest';
import { mergeDuplicateHours, pickRepresentative } from './dedup.ts';

const WEEK = { dutyTime1s: '0900', dutyTime1c: '1800', dutyTime2s: '0900', dutyTime2c: '1800' };

describe('mergeDuplicateHours (D76)', () => {
  test('a day empty on one side takes the other side (empty is "no info", not closed)', () => {
    // 실데이터: 수내봄산부인과의원 A2121617(토 09-13) / A2121621(토 비어 있음)
    expect(mergeDuplicateHours([{ ...WEEK, dutyTime6s: '0900', dutyTime6c: '1300' }, WEEK])).toEqual({
      ...WEEK,
      dutyTime6s: '0900',
      dutyTime6c: '1300',
    });
  });

  test('same values stay', () => {
    expect(mergeDuplicateHours([WEEK, { ...WEEK }])).toEqual(WEEK);
  });

  test('a day with two different values becomes no info (dropped), without any extra label', () => {
    expect(mergeDuplicateHours([{ ...WEEK, dutyTime6s: '0900', dutyTime6c: '1300' }, { ...WEEK, dutyTime6s: '0900', dutyTime6c: '1400' }])).toEqual(WEEK);
  });

  test('a day is compared as a whole (start and end together)', () => {
    // 한쪽은 시작만, 한쪽은 시작·끝이면 서로 다르므로 버린다
    expect(mergeDuplicateHours([{ dutyTime1s: '0900' }, { dutyTime1s: '0900', dutyTime1c: '1800' }])).toEqual({});
  });

  test('holiday (8) and Sunday (7) follow the same rule; other fields are ignored', () => {
    expect(mergeDuplicateHours([{ dutyTime8s: '1000', dutyTime8c: '1500', foo: 'x' } as Record<string, string>, {}])).toEqual({
      dutyTime8s: '1000',
      dutyTime8c: '1500',
    });
  });
});

describe('pickRepresentative', () => {
  const at = (s: string) => new Date(s);
  test('most filled days first, then smallest id (not update time, which dedup itself bumps)', () => {
    expect(
      pickRepresentative([
        { id: 'A2121621', hours: WEEK, updatedAt: at('2026-10-21') },
        { id: 'A2121617', hours: { ...WEEK, dutyTime6s: '0900', dutyTime6c: '1300' }, updatedAt: at('2026-10-21') },
      ]).id,
    ).toBe('A2121617');
    expect(
      pickRepresentative([
        { id: 'C', hours: WEEK, updatedAt: at('2026-10-21') },
        { id: 'B', hours: WEEK, updatedAt: at('2026-10-21') },
      ]).id,
    ).toBe('B');
  });
});
