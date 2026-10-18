import { expect, test } from 'vitest';
import { parseWeeklyHours } from './hours.ts';
import { situationFlags } from './situation.ts';

const f = (raw: Record<string, string>) => situationFlags(parseWeeklyHours(raw));

test('flags follow the parser, so malformed values do not count', () => {
  expect(f({ dutyTime7s: '1000', dutyTime7c: '1400' })).toEqual({ sunday: true, holiday: false, night: false });
  expect(f({ dutyTime8s: '1000', dutyTime8c: '1000' })).toEqual({ sunday: false, holiday: false, night: false });
  expect(f({ dutyTime1s: '2000', dutyTime1c: '0300' }).night).toBe(true);
  expect(f({ dutyTime2s: '0900', dutyTime2c: '2260' }).night).toBe(false);
  expect(f({ dutyTime6s: '0900', dutyTime6c: '2300' }).night).toBe(false);
});
