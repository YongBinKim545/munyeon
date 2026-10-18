import { renderToString } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { makeRecord, makeSummary } from '@/lib/fixtures';
import { InstitutionView } from './InstitutionView';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

const base = { holidays: ['2026-12-25'], lastSyncAt: new Date('2026-11-20T05:07:00Z'), url: 'https://munyeon.kr/pharmacy/C1100005' };

describe('InstitutionView', () => {
  test('server HTML has no live status', () => {
    const html = renderToString(<InstitutionView rec={makeRecord()} nearby={[makeSummary()]} {...base} />);
    expect(html).not.toMatch(/영업 중|영업 종료|곧 마감|영업 전/);
    expect(html).toContain('정보 없음');
    expect(html).toContain('방문 전 꼭 전화로 확인하세요');
    expect(html).toContain('데이터 기준: 2026-11-20 14:07');
    expect(html).toContain('20:00~익일 03:00');
    expect(html).toContain('tel:027770000');
    expect(html).toContain('근처약국');
    expect(html).toContain('의식이 흐리거나 숨쉬기 어려우면');
    expect(html).not.toContain('tel:119');
  });

  test('inactive institution', () => {
    const html = renderToString(<InstitutionView rec={makeRecord({ isActive: false })} nearby={[makeSummary()]} {...base} />);
    expect(html).toContain('현재 운영 정보가 없습니다');
    expect(html).toContain('근처약국');
    expect(html).not.toContain('tel:027770000');
  });

  test('no hours', () => {
    const html = renderToString(<InstitutionView rec={makeRecord({ hours: {}, hasHours: false })} nearby={[]} {...base} />);
    expect(html).toContain('등록된 진료시간이 없어요 — 전화로 확인');
  });

  test('nearby skips null geom', () => {
    const html = renderToString(<InstitutionView rec={makeRecord({ hasGeom: false, lat: null, lon: null })} nearby={[]} {...base} />);
    expect(html).not.toContain('근처 약국');
  });

  test('hospital shows specialty and pediatric badges', () => {
    const rec = makeRecord({ kind: 'hospital', category: 'general', divName: '의원', name: '튼튼소아청소년과의원', specialty: '소아청소년과', pediatricName: true });
    const html = renderToString(<InstitutionView rec={rec} nearby={[]} {...base} />);
    expect(html).toContain('소아청소년과');
    expect(html).toContain('소아 전문');
  });
});
