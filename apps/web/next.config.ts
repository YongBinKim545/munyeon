import type { NextConfig } from 'next';

// cacheComponents는 끈다(D30): 첫 요청에도 본문이 완성된 HTML로 나가야 한다(네이버 로봇).
const nextConfig: NextConfig = {
  transpilePackages: ['@munyeon/core', '@munyeon/db'],
  poweredByHeader: false,
};

export default nextConfig;
