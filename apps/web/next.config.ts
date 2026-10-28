import type { NextConfig } from 'next';

/** 옛 시도 주소 → 지금 시도 주소(P0-1). 광주·전남은 2026-07-01 통합. 시군구 이름은 그대로라 뒷부분은 옮겨 붙인다 */
const OLD_SIDO: Record<string, string> = {
  광주광역시: '전남광주통합특별시',
  전라남도: '전남광주통합특별시',
  강원도: '강원특별자치도',
  전라북도: '전북특별자치도',
};

/** 없앤 상황별 지역 페이지(D69). 지역 화면 하나가 지금·날짜를 모두 보여 준다 */
const SITUATIONS = ['전체', '일요일', '공휴일', '야간'];
const both = (seg: string) => [seg, encodeURIComponent(seg)];

function regionRedirects() {
  const out: { source: string; destination: string; statusCode: 301 }[] = [];
  for (const ph of both('약국')) {
    out.push({ source: `/:sido/:sigungu/${ph}`, destination: '/:sido/:sigungu', statusCode: 301 });
    for (const s of SITUATIONS.flatMap(both)) out.push({ source: `/:sido/:sigungu/${ph}/${s}`, destination: '/:sido/:sigungu', statusCode: 301 });
  }
  for (const ho of both('병원')) {
    for (const s of SITUATIONS.flatMap(both)) {
      out.push({ source: `/:sido/:sigungu/${ho}/${s}`, destination: `/:sido/:sigungu/${encodeURIComponent('병원')}`, statusCode: 301 });
    }
  }
  return out;
}

// cacheComponents는 끈다(D30): 첫 요청에도 본문이 완성된 HTML로 나가야 한다(네이버 로봇).
const nextConfig: NextConfig = {
  transpilePackages: ['@munyeon/core', '@munyeon/db'],
  poweredByHeader: false,
  // 가이드 글 파일(D74). 요청 때 그리는 페이지(푸터·사이트맵)도 읽을 수 있게 함수에 함께 싣는다
  outputFileTracingIncludes: { '/**': ['./content/guide/*.md'] },
  async redirects() {
    const sido = Object.entries(OLD_SIDO).flatMap(([from, to]) => {
      const dest = `/${encodeURIComponent(to)}`;
      return [from, encodeURIComponent(from)].flatMap((seg) => [
        { source: `/${seg}`, destination: dest, statusCode: 301 as const },
        { source: `/${seg}/:rest*`, destination: `${dest}/:rest*`, statusCode: 301 as const },
      ]);
    });
    return [...sido, ...regionRedirects()];
  },
};

export default nextConfig;
