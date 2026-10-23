// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';
import { dateRange, NOW, parseWhen, readWhen, saveWhen } from './when';

const at = new Date('2026-10-23T12:00:00+09:00');

describe('when', () => {
  beforeEach(() => sessionStorage.clear());

  test('range is today to 90 days later (KST)', () => expect(dateRange(at)).toEqual({ min: '2026-10-23', max: '2027-01-21' }));

  test('only dates in range are kept, the rest is now', () => {
    expect(parseWhen('2026-10-25', at)).toEqual({ kind: 'date', ymd: '2026-10-25' });
    expect(parseWhen('2026-10-22', at)).toEqual(NOW);
    expect(parseWhen('2027-01-22', at)).toEqual(NOW);
    expect(parseWhen('x', at)).toEqual(NOW);
    expect(parseWhen(null, at)).toEqual(NOW);
  });

  test('remembered for this visit only (session), now clears it', () => {
    expect(readWhen(at)).toEqual(NOW);
    saveWhen({ kind: 'date', ymd: '2026-12-25' });
    expect(readWhen(at)).toEqual({ kind: 'date', ymd: '2026-12-25' });
    expect(readWhen(new Date('2026-12-26T09:00:00+09:00'))).toEqual(NOW); // 지난 날짜
    saveWhen(NOW);
    expect(readWhen(at)).toEqual(NOW);
  });
});
