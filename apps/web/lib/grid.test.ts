import { describe, expect, test } from 'vitest';
import { makeRecord } from './fixtures';
import { decodeGrid, encodeGrid } from './grid';

const row = (over = {}) => ({ ...makeRecord(over) });

describe('grid payload', () => {
  test('round-trip keeps hours including overnight and holiday codes', () => {
    const hours = { dutyTime1s: '2000', dutyTime1c: '0300', dutyTime5s: '0900', dutyTime5c: '2500', dutyTime8s: '1000', dutyTime8c: '1400' };
    const [e] = decodeGrid(encodeGrid([row({ hours })]), 'pharmacy');
    expect(e).toEqual({
      id: 'C1100005', kind: 'pharmacy', name: '테스트심야약국', lat: 37.5665, lon: 126.978, tel: '02-777-0000',
      category: 'pharmacy', badge: '약국', pediatric: false, sido: '서울특별시', sigungu: '중구', dong: '태평로1가', hours,
    });
  });

  test('drops malformed hour fields and rows without coordinates', () => {
    const p = encodeGrid([row({ hours: { dutyTime1s: '09', dutyTime1c: '1800' } }), row({ id: 'X', lat: null, lon: null })]);
    expect(p.items).toHaveLength(1);
    expect(decodeGrid(p, 'pharmacy')[0]?.hours).toEqual({});
  });

  test('pediatric badge only for general hospitals', () => {
    const p = encodeGrid([
      row({ id: 'A', kind: 'hospital', category: 'general', pediatricName: true, specialty: '소아청소년과' }),
      row({ id: 'B', kind: 'hospital', category: 'oriental', pediatricName: true }),
    ]);
    const [a, b] = decodeGrid(p, 'hospital');
    expect(a).toMatchObject({ pediatric: true, badge: '소아청소년과' });
    expect(b).toMatchObject({ pediatric: false, badge: '한의원' });
  });

  test('bad payload decodes to empty', () => {
    expect(decodeGrid({ v: 2 } as never, 'pharmacy')).toEqual([]);
  });
});
