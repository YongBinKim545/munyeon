import type { InstitutionRecord, InstitutionSummary } from '@munyeon/db';

/** 웹 테스트용 기관 표본 */
export function makeRecord(over: Partial<InstitutionRecord> = {}): InstitutionRecord {
  return {
    id: 'C1100005', kind: 'pharmacy', name: '테스트심야약국', divName: null, addr: '서울특별시 중구 세종대로 110',
    tel: '02-777-0000', hours: { dutyTime1s: '2000', dutyTime1c: '0300', dutyTime7s: '1000', dutyTime7c: '1400' },
    hasHours: true, category: 'pharmacy', specialty: null, pediatricName: false, lat: 37.5665, lon: 126.978,
    sido: '서울특별시', sigungu: '중구', dong: '태평로1가', hasGeom: true, isActive: true, updatedAt: new Date('2026-11-01T00:00:00Z'),
    ...over,
  };
}

export function makeSummary(over: Partial<InstitutionSummary> = {}): InstitutionSummary {
  return {
    id: 'C1100006', kind: 'pharmacy', name: '근처약국', divName: null, addr: '서울특별시 중구 세종대로 120',
    tel: '02-777-0001', hours: { dutyTime8s: '1000', dutyTime8c: '1400' }, hasHours: true, category: 'pharmacy',
    specialty: null, pediatricName: false, dong: '태평로1가', lat: 37.567, lon: 126.979, distanceM: 350,
    ...over,
  };
}
