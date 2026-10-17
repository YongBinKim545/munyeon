import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { contentHash, toInstitutionRow } from './map.ts';
import { parsePage } from './portal.ts';

const items = parsePage(readFileSync(new URL('./__fixtures__/hospital-sample.xml', import.meta.url), 'utf8')).items;

describe('toInstitutionRow', () => {
  test('maps row with region, tel, hours, coords', () => {
    const r = toInstitutionRow('hospital', items[0]!)!;
    expect(r).toMatchObject({
      id: 'A1100001', kind: 'hospital', name: '테스트소아청소년과의원', divName: '의원',
      sido: '서울특별시', sigungu: '강남구', tel: '02-555-0101', lat: 37.5006, lon: 127.0364, hasHours: true,
    });
    expect(r.hours).toEqual({
      dutyTime1s: '0900', dutyTime1c: '1800', dutyTime2s: '0900', dutyTime2c: '1800',
      dutyTime6s: '0900', dutyTime6c: '1300', dutyTime8s: '1000', dutyTime8c: '1400',
    });
    expect(r.raw.rnum).toBeUndefined();
  });
  test('si+gu region', () => expect(toInstitutionRow('hospital', items[1]!)?.sigungu).toBe('수원시 영통구'));
  test('no coords and no hours', () => {
    const r = toInstitutionRow('hospital', items[2]!)!;
    expect(r.lat).toBeNull();
    expect(r.hasHours).toBe(false);
  });
  test('missing name or hpid is skipped', () => {
    expect(toInstitutionRow('hospital', items[3]!)).toBeNull();
    expect(toInstitutionRow('hospital', { dutyName: 'x' })).toBeNull();
  });
});

describe('contentHash', () => {
  test('stable regardless of field order and rnum', () => {
    expect(contentHash({ a: '1', b: '2', rnum: '1' })).toBe(contentHash({ b: '2', a: '1', rnum: '99' }));
    expect(contentHash({ a: '1' })).not.toBe(contentHash({ a: '2' }));
  });
});
