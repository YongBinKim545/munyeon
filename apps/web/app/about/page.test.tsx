import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import About from './page';

afterEach(() => vi.unstubAllEnvs());

test('about says it is a private service, lists sources, and shows the contact only when set (P0-13·A-2)', () => {
  vi.stubEnv('NEXT_PUBLIC_CONTACT_EMAIL', 'contact@findmedi.co.kr');
  const html = renderToString(<About />);
  expect(html).toContain('민간이 만든 서비스예요. 정부나 국립중앙의료원이 운영하지 않아요.');
  expect(html).toContain('국립중앙의료원 &lsquo;전국 병·의원 찾기 서비스&rsquo;'.replace(/&lsquo;|&rsquo;/g, (m) => (m === '&lsquo;' ? '‘' : '’')));
  expect(html).toContain('한국천문연구원');
  expect(html).toContain('문의 contact@findmedi.co.kr');
  expect(html).not.toContain('매시간');
  vi.stubEnv('NEXT_PUBLIC_CONTACT_EMAIL', '');
  expect(renderToString(<About />)).not.toContain('문의 ');
});
