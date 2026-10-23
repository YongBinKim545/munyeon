import { expect, test } from 'vitest';
import { summarizeWeek } from './weekSummary';

const weekday = { dutyTime1s: '0900', dutyTime1c: '1800', dutyTime2s: '0900', dutyTime2c: '1800', dutyTime3s: '0900', dutyTime3c: '1800', dutyTime4s: '0900', dutyTime4c: '1800', dutyTime5s: '0900', dutyTime5c: '1800' };

test('summarizeWeek', () => {
  expect(summarizeWeek(weekday)).toBe('평일 09:00~18:00');
  expect(summarizeWeek({ ...weekday, dutyTime5c: '2000', dutyTime6s: '0900', dutyTime6c: '1300' })).toBe('월 09:00~18:00 · 토 09:00~13:00');
  expect(summarizeWeek({ ...weekday, dutyTime7s: '1000', dutyTime7c: '1400', dutyTime8s: '1000', dutyTime8c: '1400' })).toBe(
    '평일 09:00~18:00 · 일 10:00~14:00 · 공휴일 10:00~14:00',
  );
  expect(summarizeWeek({})).toBe('진료시간 정보 없음');
});
