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
    '@id': `${url}#place`,
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

/**
 * 기관 상세 페이지 자체(P0-6): 내용이 마지막으로 바뀐 때(dateModified, 데이터 기준일)와 다루는 기관.
 * 신선도 신호이자 AI 검색이 인용할 때 쓰는 기준일이다.
 */
export function buildDetailPageJsonLd(rec: InstitutionRecord, url: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url,
    name: rec.name,
    inLanguage: 'ko-KR',
    dateModified: new Date(rec.updatedAt).toISOString(),
    about: { '@id': `${url}#place` },
  };
}

/**
 * 메인의 사이트·운영 주체(P0-6). 구글은 검색 결과의 사이트 이름에 WebSite를 쓴다. 사이트 안 검색창(SearchAction)은
 * 구글이 2024-11 기능을 없애 넣지 않는다. 운영 주체는 서비스 이름과 서비스 전용 문의 메일만(개인 이름 없음, A-2).
 */
export function buildSiteJsonLd(siteUrl: string, name: string, email?: string): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${siteUrl}/#website`, url: siteUrl, name, alternateName: 'findmedi', inLanguage: 'ko-KR', publisher: { '@id': `${siteUrl}/#org` } },
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#org`,
        name,
        url: siteUrl,
        logo: `${siteUrl}/icons/icon-512.png`,
        ...(email ? { email, contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email } } : {}),
      },
    ],
  };
}

/** <script type="application/ld+json"> 안에 넣을 문자열. '<'를 이스케이프해 공공 데이터 값이 태그를 닫지 못하게 한다. */
export function serializeJsonLd(obj: object): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
