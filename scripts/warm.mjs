/**
 * 배포 직후 지역 페이지를 미리 만든다(P0-10). 배포마다 저장된 페이지가 지워져, 검색으로 처음 들어온 사람과 로봇이
 * 서버가 페이지를 만드는 동안 기다리기 때문이다. 사이트맵 0번 파일(시도·시군구·색인 대상 지역 랜딩)을 한 번씩 연다.
 *   node scripts/warm.mjs <사이트 주소> [기다릴 커밋]
 * 커밋을 주면 /api/version이 그 커밋을 돌려줄 때까지(새 배포로 바뀔 때까지) 기다린 뒤 시작한다.
 * 비밀값은 쓰지 않는다. 실패가 5%를 넘으면 종료 코드 1(GitHub가 메일로 알린다).
 */
const [base = 'https://findmedi.co.kr', sha] = process.argv.slice(2);
const CONCURRENCY = 4;
const TIMEOUT_MS = 30_000;
const WAIT_DEPLOY_MS = 20 * 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'findmedi-warm' } });
    await res.arrayBuffer();
    return { url, status: res.status, ms: Date.now() - t0, cache: res.headers.get('x-vercel-cache') ?? '' };
  } catch (e) {
    return { url, status: 0, ms: Date.now() - t0, cache: '', error: e instanceof Error ? e.message : String(e) };
  }
}

async function waitForDeploy() {
  const until = Date.now() + WAIT_DEPLOY_MS;
  while (Date.now() < until) {
    const v = await fetch(`${base}/api/version`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (v?.sha === sha) return;
    await sleep(15_000);
  }
  throw new Error(`새 배포(${sha.slice(0, 7)})로 바뀌지 않았습니다`);
}

if (sha) await waitForDeploy();
const xml = await (await fetch(`${base}/sitemaps/0.xml`, { signal: AbortSignal.timeout(60_000) })).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
if (urls.length === 0) throw new Error('사이트맵 0번 파일에 주소가 없습니다');
// 사이트맵은 정식 도메인으로 적혀 있어 미리보기에서 돌릴 때는 주소 앞부분을 바꾼다
const targets = urls.map((u) => base + new URL(u).pathname);

const results = [];
let next = 0;
const t0 = Date.now();
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < targets.length) results.push(await get(targets[next++]));
  }),
);

const failed = results.filter((r) => r.status !== 200);
const ms = results.map((r) => r.ms).sort((a, b) => a - b);
const pct = (p) => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))];
console.log(`warm: ${results.length}개, ${((Date.now() - t0) / 1000).toFixed(0)}초, 중간 ${pct(0.5)}ms, 95% ${pct(0.95)}ms, 실패 ${failed.length}개`);
for (const f of failed.slice(0, 20)) console.log(`  실패 ${f.status} ${decodeURIComponent(new URL(f.url).pathname)} ${f.error ?? ''}`);
if (failed.length > results.length * 0.05) process.exit(1);
