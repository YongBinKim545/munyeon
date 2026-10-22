import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';

const loadSidoCounts = vi.fn();
vi.mock('@/lib/data', () => ({ loadSidoCounts: () => loadSidoCounts() }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const { default: Regions } = await import('./page');

afterEach(() => {
  vi.unstubAllEnvs();
  loadSidoCounts.mockReset();
});

describe('/regions (D52)', () => {
  test('lists sido with counts from the DB', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://x');
    loadSidoCounts.mockResolvedValue([{ sido: '서울특별시', pharmacy: 5300, hospital: 18000 }]);
    const html = renderToString(await Regions());
    expect(html).toContain('지역으로 찾기');
    expect(html).toContain('href="/%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C"');
    expect(html).toContain('<td>5,300</td>');
    expect(html).toContain('<th scope="col">약국</th>');
  });

  test('without the DB still lists the 17 sido names (no empty page after a failed build query)', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://x');
    loadSidoCounts.mockResolvedValue([]);
    const html = renderToString(await Regions());
    expect(html.match(/<th scope="row">/g)?.length).toBe(17);
    expect(html).toContain('제주특별자치도');
    expect(html).not.toContain('>강원도<');
    expect(html).toContain('<td>–</td>');
  });
});
