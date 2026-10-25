import { describe, expect, test } from 'vitest';
import { clockLabel, regionSummary } from './regionSummary';

const wk = (s: string, c: string) => Object.fromEntries([1, 2, 3, 4, 5].flatMap((d) => [[`dutyTime${d}s`, s], [`dutyTime${d}c`, c]]));
const at = new Date('2026-10-25T05:00:00Z');

describe('clockLabel', () => {
  test('words people use', () => {
    expect(clockLabel(480)).toBe('오전 8시');
    expect(clockLabel(720)).toBe('낮 12시');
    expect(clockLabel(1290)).toBe('오후 9시 30분');
    expect(clockLabel(1440)).toBe('밤 12시');
    expect(clockLabel(1560)).toBe('새벽 2시');
    expect(clockLabel(300)).toBe('새벽 5시');
  });
});

describe('regionSummary (P0-3)', () => {
  const rows = [
    { name: '나약국', hours: wk('0900', '2400') },
    { name: '가약국', hours: wk('0900', '2400') }, // 같으면 가나다순
    { name: '다약국', hours: { ...wk('0800', '1800'), dutyTime7s: '1000', dutyTime7c: '1400' } },
  ];
  const stats = { total: 3, withSunday: 1, withHoliday: 1 };

  test('count, latest and earliest by weekday hours, Sunday count, holiday rate, source and date', () =>
    expect(regionSummary({ area: '서울 마포구', kind: 'pharmacy', rows, stats, lastSync: at })).toBe(
      '서울 마포구 약국은 등록 기준 3곳이에요. 평일 가장 늦게까지 하는 곳은 가약국(밤 12시), 가장 일찍 여는 곳은 다약국(오전 8시)이에요. ' +
        '일요일에 여는 곳은 1곳, 공휴일 시간을 등록한 곳은 33%예요. 방문 전 꼭 전화로 확인하세요. (국립중앙의료원 자료, 10월 25일 기준)',
    ));

  test('24-hour place and no weekday hours', () => {
    expect(regionSummary({ area: '서울 중구', kind: 'pharmacy', rows: [{ name: '항상약국', hours: wk('0000', '2400') }], stats: { total: 1, withSunday: 0, withHoliday: 0 }, lastSync: null })).toBe(
      '서울 중구 약국은 등록 기준 1곳이에요. 평일 가장 늦게까지 하는 곳은 항상약국(24시간), 가장 일찍 여는 곳은 항상약국(24시간)이에요. ' +
        '일요일에 여는 곳은 0곳, 공휴일 시간을 등록한 곳은 0%예요. 방문 전 꼭 전화로 확인하세요. (국립중앙의료원 자료)',
    );
    expect(regionSummary({ area: '서울 중구', kind: 'hospital', rows: [{ name: '정보없는의원', hours: {} }], stats: { total: 1, withSunday: 0, withHoliday: 0 }, lastSync: null })).toBe(
      '서울 중구 병원은 등록 기준 1곳이에요. 일요일에 여는 곳은 0곳, 공휴일 시간을 등록한 곳은 0%예요. 방문 전 꼭 전화로 확인하세요. (국립중앙의료원 자료)',
    );
  });

  test('empty region', () =>
    expect(regionSummary({ area: '서울 중구', kind: 'hospital', rows: [], stats: { total: 0, withSunday: 0, withHoliday: 0 }, lastSync: null })).toBe(
      '서울 중구에 등록된 병원이 없어요.',
    ));
});
