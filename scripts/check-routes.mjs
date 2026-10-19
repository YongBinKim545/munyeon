// 메인·지역·기관·검색 페이지의 응답 코드, noindex, canonical, 캐시 HTML의 영업 상태 문구 유무를 점검한다.
//   node scripts/check-routes.mjs [기본 http://localhost:3000 | https://munyeon.kr]
// 메인의 상태 선택 메뉴에 '영업 중' 글자가 있으므로, 상태 문구는 '영업 중 ·'처럼 카드 문구 모양으로 찾는다.
const base = process.argv[2] ?? 'http://localhost:3000';
const LIVE = /영업 중 ·|영업 종료|곧 마감|곧 영업 ·|전화 확인 필요|24시간 영업/;
const paths = [
  '/', '/search', '/search?q=약국',
  '/서울특별시', '/서울특별시/강남구', '/서울특별시/없는구', '/없는도', '/서울특별시/강남구/한의원/전체',
  '/서울특별시/강남구/약국/공휴일', '/서울특별시/중구/약국/야간', '/경기도/수원시 영통구/병원/전체',
  '/서울특별시/강남구/병원/일요일',
];
for (const p of paths) {
  const res = await fetch(base + encodeURI(p), { redirect: 'manual' });
  const html = await res.text();
  const robots = html.match(/<meta name="robots"[^>]*>/)?.[0] ?? '';
  const canon = decodeURI(html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? '');
  console.log(res.status, p, `bytes=${html.length}`, LIVE.test(html) ? 'LIVE-STATUS!' : '', robots, canon);
}

// 격자 JSON(명동 칸, 약 5km·약 1km): 200, CDN 캐시 헤더, 영업 상태 문구 없음. 잘못된 칸은 400.
for (const p of ['/api/grid/pharmacy/834_2267', '/api/grid/hospital/f4173_11337', '/api/grid/pharmacy/1_1', '/api/grid/clinic/834_2267']) {
  const res = await fetch(base + p);
  const text = await res.text();
  console.log(res.status, p, `bytes=${text.length}`, LIVE.test(text) ? 'LIVE-STATUS!' : '', res.headers.get('cache-control') ?? '');
}
