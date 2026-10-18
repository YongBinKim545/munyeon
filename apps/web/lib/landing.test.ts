import { describe, expect, test } from 'vitest';
import { makeSummary } from './fixtures';
import { landingIndexable, matchesSituation, situationTime, splitByCategory, summarizeWeek } from './landing';

const weekday = { dutyTime1s: '0900', dutyTime1c: '1800', dutyTime2s: '0900', dutyTime2c: '1800', dutyTime3s: '0900', dutyTime3c: '1800', dutyTime4s: '0900', dutyTime4c: '1800', dutyTime5s: '0900', dutyTime5c: '1800' };

describe('matchesSituation', () => {
  test('sunday needs code 7', () => {
    expect(matchesSituation({ dutyTime7s: '1000', dutyTime7c: '1400' }, 'sunday')).toBe(true);
    expect(matchesSituation(weekday, 'sunday')).toBe(false);
  });
  test('holiday needs code 8', () => {
    expect(matchesSituation({ dutyTime8s: '1000', dutyTime8c: '1400' }, 'holiday')).toBe(true);
    expect(matchesSituation(weekday, 'holiday')).toBe(false);
  });
  test('night: any weekday closing at or after 22:00, overnight counts', () => {
    expect(matchesSituation({ dutyTime3s: '0900', dutyTime3c: '2200' }, 'night')).toBe(true);
    expect(matchesSituation({ dutyTime1s: '2000', dutyTime1c: '0300' }, 'night')).toBe(true);
    expect(matchesSituation({ dutyTime6s: '0900', dutyTime6c: '2300' }, 'night')).toBe(false); // 토요일만은 제외
    expect(matchesSituation(weekday, 'night')).toBe(false);
  });
  test('all matches everything', () => expect(matchesSituation({}, 'all')).toBe(true));
});

describe('splitByCategory', () => {
  test('hospital list folds oriental, dental, other', () => {
    const items = [
      makeSummary({ id: 'G', kind: 'hospital', category: 'general' }),
      makeSummary({ id: 'O', kind: 'hospital', category: 'oriental' }),
      makeSummary({ id: 'D', kind: 'hospital', category: 'dental' }),
      makeSummary({ id: 'X', kind: 'hospital', category: 'other' }),
    ];
    const { main, folded } = splitByCategory(items);
    expect(main.map((i) => i.id)).toEqual(['G']);
    expect(folded.map((i) => i.id)).toEqual(['O', 'D', 'X']);
  });
  test('pharmacy list never folds', () => expect(splitByCategory([makeSummary()]).folded).toEqual([]));
});

describe('text helpers', () => {
  test('summarizeWeek', () => {
    expect(summarizeWeek(weekday)).toBe('평일 09:00~18:00');
    expect(summarizeWeek({ ...weekday, dutyTime5c: '2000', dutyTime6s: '0900', dutyTime6c: '1300' })).toBe('월 09:00~18:00 · 토 09:00~13:00');
    expect(summarizeWeek({})).toBe('진료시간 정보 없음');
  });
  test('situationTime', () => {
    expect(situationTime({ dutyTime7s: '1000', dutyTime7c: '1400' }, 'sunday')).toBe('일 10:00~14:00');
    expect(situationTime({ dutyTime8s: '1000', dutyTime8c: '1400' }, 'holiday')).toBe('공휴일 10:00~14:00');
    expect(situationTime({ dutyTime2s: '0900', dutyTime2c: '2300' }, 'night')).toBe('화 09:00~23:00');
  });
  test('landingIndexable', () => {
    expect(landingIndexable(2)).toBe(false);
    expect(landingIndexable(3)).toBe(true);
  });
});
