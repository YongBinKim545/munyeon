import { describe, expect, test } from 'vitest';
import { makeRecord } from './fixtures';
import { buildDetailPageJsonLd, buildInstitutionJsonLd, buildSiteJsonLd, serializeJsonLd } from './jsonld';

const url = 'https://findmedi.co.kr/pharmacy/C1100005';

describe('buildInstitutionJsonLd', () => {
  test('pharmacy JSON-LD', () => {
    const j = buildInstitutionJsonLd(makeRecord(), url) as Record<string, any>;
    expect(j['@type']).toBe('Pharmacy');
    expect(j.telephone).toBe('02-777-0000');
    expect(j.address).toMatchObject({ '@type': 'PostalAddress', addressRegion: '서울특별시', addressLocality: '중구', addressCountry: 'KR' });
    expect(j.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 37.5665, longitude: 126.978 });
    expect(j.url).toBe(url);
  });

  test('clinic JSON-LD', () => {
    const j = buildInstitutionJsonLd(makeRecord({ kind: 'hospital', category: 'general', divName: '의원' }), url) as Record<string, any>;
    expect(j['@type']).toBe('MedicalClinic');
  });

  test('openingHoursSpecification skips unknown days, maps overnight, excludes holiday code', () => {
    const j = buildInstitutionJsonLd(
      makeRecord({ hours: { dutyTime1s: '2000', dutyTime1c: '0300', dutyTime2s: '0900', dutyTime2c: '2500', dutyTime3s: '0000', dutyTime3c: '2400', dutyTime8s: '1000', dutyTime8c: '1400' } }),
      url,
    ) as Record<string, any>;
    expect(j.openingHoursSpecification).toEqual([
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Monday', opens: '20:00', closes: '03:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Tuesday', opens: '09:00', closes: '01:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Wednesday', opens: '00:00', closes: '23:59' },
    ]);
  });

  test('no geo and no telephone when missing', () => {
    const j = buildInstitutionJsonLd(makeRecord({ lat: null, lon: null, hasGeom: false, tel: null }), url) as Record<string, any>;
    expect(j.geo).toBeUndefined();
    expect(j.telephone).toBeUndefined();
  });
});

test('serializeJsonLd cannot close the script tag', () => {
  const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
  expect(out).not.toContain('</script');
  expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' });
});

type Node = { [k: string]: unknown };

describe('page and site JSON-LD (P0-6)', () => {
  test('detail page carries dateModified and points at the place', () => {
    const j = buildDetailPageJsonLd(makeRecord(), url) as Node;
    expect(j['@type']).toBe('WebPage');
    expect(j.dateModified).toBe('2026-11-01T00:00:00.000Z');
    expect(j.about).toEqual({ '@id': `${url}#place` });
    expect((buildInstitutionJsonLd(makeRecord(), url) as Node)['@id']).toBe(`${url}#place`);
  });

  test('site: WebSite with alternate name, Organization without a personal name, email only when set', () => {
    const [site, org] = (buildSiteJsonLd('https://findmedi.co.kr', '찾아줘 메디', 'contact@findmedi.co.kr') as { '@graph': Node[] })['@graph'];
    expect(site).toMatchObject({ '@type': 'WebSite', name: '찾아줘 메디', alternateName: 'findmedi', url: 'https://findmedi.co.kr' });
    expect(site!.potentialAction).toBeUndefined(); // 사이트 내 검색창은 구글이 없앰
    expect(org).toMatchObject({ '@type': 'Organization', name: '찾아줘 메디', email: 'contact@findmedi.co.kr' });
    expect((buildSiteJsonLd('https://x', 'n') as { '@graph': Node[] })['@graph'][1]!.email).toBeUndefined();
  });
});
