// 지역·기관 페이지의 응답 코드, noindex, canonical, 캐시 HTML의 영업 상태 문구 유무를 점검한다.
//   node scripts/check-routes.mjs [기본 http://localhost:3000 | https://munyeon.kr]
const base = process.argv[2] ?? 'http://localhost:3000';
const paths = [
  '/서울특별시', '/서울특별시/강남구', '/서울특별시/없는구', '/없는도', '/서울특별시/강남구/한의원/전체',
  '/서울특별시/강남구/약국/공휴일', '/서울특별시/중구/약국/야간', '/경기도/수원시 영통구/병원/전체',
  '/서울특별시/강남구/병원/일요일',
];
for (const p of paths) {
  const res = await fetch(base + encodeURI(p), { redirect: 'manual' });
  const html = await res.text();
  const robots = html.match(/<meta name="robots"[^>]*>/)?.[0] ?? '';
  const canon = decodeURI(html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? '');
  const live = /영업 중|영업 종료|곧 마감/.test(html);
  console.log(res.status, p, `bytes=${html.length}`, live ? 'LIVE-STATUS!' : '', robots, canon);
}
