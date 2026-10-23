import type { NextConfig } from 'next';

/** 옛 시도 주소 → 지금 시도 주소(P0-1). 광주·전남은 2026-07-01 통합. 시군구 이름은 그대로라 뒷부분은 옮겨 붙인다 */
const OLD_SIDO: Record<string, string> = {
  광주광역시: '전남광주통합특별시',
  전라남도: '전남광주통합특별시',
  강원도: '강원특별자치도',
  전라북도: '전북특별자치도',
};

// cacheComponents는 끈다(D30): 첫 요청에도 본문이 완성된 HTML로 나가야 한다(네이버 로봇).
const nextConfig: NextConfig = {
  transpilePackages: ['@munyeon/core', '@munyeon/db'],
  poweredByHeader: false,
  async redirects() {
    return Object.entries(OLD_SIDO).flatMap(([from, to]) => {
      const dest = `/${encodeURIComponent(to)}`;
      return [from, encodeURIComponent(from)].flatMap((seg) => [
        { source: `/${seg}`, destination: dest, statusCode: 301 as const },
        { source: `/${seg}/:rest*`, destination: `${dest}/:rest*`, statusCode: 301 as const },
      ]);
    });
  },
};

export default nextConfig;
