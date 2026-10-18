import { parseWeeklyHours, type DayCode } from '@munyeon/core';
import type { InstitutionRecord } from '@munyeon/db';

const DAY_NAMES: Record<Exclude<DayCode, 8>, string> = {
  1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday',
};

const hhmm = (m: number) => {
  const v = m % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

/**
 * schema.org Pharmacy / MedicalClinic. 요일별 시간은 정보가 있는 요일만 넣는다.
 * 자정을 넘기면 closes가 opens보다 작은 값(익일)이 되고, 하루 끝(24:00)은 23:59로 쓴다.
 * 공휴일(코드 8)은 날짜가 없는 일반 규칙이라 넣지 않는다.
 */
export function buildInstitutionJsonLd(rec: InstitutionRecord, url: string): object {
  const week = parseWeeklyHours(rec.hours);
  const spec = (Object.keys(DAY_NAMES) as unknown as Exclude<DayCode, 8>[])
    .map(Number)
    .flatMap((d) => {
      const r = week[d as Exclude<DayCode, 8>];
      if (!r) return [];
      return [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: DAY_NAMES[d as Exclude<DayCode, 8>],
        opens: hhmm(r.open),
        closes: r.close === 1440 ? '23:59' : hhmm(r.close),
      }];
    });
  return {
    '@context': 'https://schema.org',
    '@type': rec.kind === 'pharmacy' ? 'Pharmacy' : 'MedicalClinic',
    name: rec.name,
    url,
    ...(rec.tel ? { telephone: rec.tel } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: rec.addr,
      ...(rec.sido ? { addressRegion: rec.sido } : {}),
      ...(rec.sigungu ? { addressLocality: rec.sigungu } : {}),
      addressCountry: 'KR',
    },
    ...(rec.lat !== null && rec.lon !== null ? { geo: { '@type': 'GeoCoordinates', latitude: rec.lat, longitude: rec.lon } } : {}),
    ...(spec.length ? { openingHoursSpecification: spec } : {}),
  };
}

/** <script type="application/ld+json"> 안에 넣을 문자열. '<'를 이스케이프해 공공 데이터 값이 태그를 닫지 못하게 한다. */
export function serializeJsonLd(obj: object): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
