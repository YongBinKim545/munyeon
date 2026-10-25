import { renderToString } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { makeRecord } from '@/lib/fixtures';
import { InstitutionView } from './InstitutionView';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/navigation', () => ({ usePathname: () => '/pharmacy/C1100005' }));

const base = { holidays: ['2026-12-25'], lastSyncAt: new Date('2026-11-20T05:07:00Z'), url: 'https://findmedi.co.kr/pharmacy/C1100005' };

describe('InstitutionView', () => {
  test('server HTML has no live status', () => {
    const html = renderToString(<InstitutionView rec={makeRecord()} {...base} />);
    expect(html).not.toMatch(/영업 중|영업 종료|곧 마감|영업 전/);
    expect(html).toContain('정보 없음');
    expect(html).toContain('방문 전 꼭 전화로 확인하세요');
    expect(html).toContain('국립중앙의료원 자료 · 11월 20일 오후 2시 7분 기준');
    expect(html).toContain('20:00~익일 03:00');
    expect(html).toContain('tel:027770000');
    expect(html).toContain('의식이 흐리거나 숨쉬기 어려우면');
    expect(html).not.toContain('tel:119');
  });

  test('no nearby section any more (D51)', () => {
    const html = renderToString(<InstitutionView rec={makeRecord()} {...base} />);
    expect(html).not.toMatch(/근처 (약국|병원)/);
  });

  test('inactive institution', () => {
    const html = renderToString(<InstitutionView rec={makeRecord({ isActive: false })} {...base} />);
    expect(html).toContain('현재 운영 정보가 없습니다');
    expect(html).toContain('위 지역 목록에서 다른');
    expect(html).not.toContain('tel:027770000');
  });

  test('no hours', () => {
    const html = renderToString(<InstitutionView rec={makeRecord({ hours: {}, hasHours: false })} {...base} />);
    expect(html).toContain('등록된 진료시간이 없어요 — 전화로 확인');
  });

  test('hospital shows specialty and pediatric badges', () => {
    const rec = makeRecord({ kind: 'hospital', category: 'general', divName: '의원', name: '튼튼소아청소년과의원', specialty: '소아청소년과', pediatricName: true });
    const html = renderToString(<InstitutionView rec={rec} {...base} />);
    expect(html).toContain('소아청소년과');
    expect(html).toContain('소아 전문');
  });
});
