/**
 * 로컬 화면 확인용 인메모리 DB(PGlite + PostGIS)를 127.0.0.1:54329에 띄우고 표본 데이터를 넣는다.
 * 공공 API를 부르지 않는다. 실데이터는 `.env.local`의 DATABASE_URL로 `npm run sync`를 쓴다.
 *   node apps/worker/src/dev-db.ts   → 다른 터미널에서 DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres npm run dev -w @munyeon/web
 */
import { readFileSync } from 'node:fs';
import { finishRun, refreshNeighborhoods, startRun, upsertInstitutions, type InstitutionRow } from '@munyeon/db';
import { startTestDb } from '@munyeon/db/test-db';
import { toInstitutionRow } from './map.ts';
import { parsePage } from './portal.ts';

const fx = (n: string) => parsePage(readFileSync(new URL(`./__fixtures__/${n}`, import.meta.url), 'utf8')).items;

function synthetic(): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  const names = ['온누리약국', '365약국', '튼튼약국', '바른약국', '미소약국', '해맑은약국'];
  const dongs = ['역삼동', '논현동', '삼성동'];
  names.forEach((n, i) => {
    out.push({
      hpid: `C19${String(i).padStart(5, '0')}`, dutyName: `강남${n}`, dutyTel1: `02-555-01${String(i).padStart(2, '0')}`,
      dutyAddr: `서울특별시 강남구 테헤란로 ${100 + i} (${dongs[i % 3]})`, wgs84Lat: String(37.5 + i * 0.003), wgs84Lon: String(127.03 + i * 0.003),
      dutyTime1s: '0900', dutyTime1c: i === 1 ? '2500' : '2100', dutyTime2s: '0900', dutyTime2c: '2100', dutyTime3s: '0900', dutyTime3c: '2100',
      dutyTime4s: '0900', dutyTime4c: '2100', dutyTime5s: '0900', dutyTime5c: '2100',
      ...(i % 2 === 0 ? { dutyTime7s: '1000', dutyTime7c: '1800' } : {}),
      ...(i % 3 === 0 ? { dutyTime8s: '1000', dutyTime8c: '1500' } : {}),
    });
  });
  const clinics = [['튼튼소아청소년과의원', '의원'], ['바른정형외과의원', '의원'], ['맑은이비인후과의원', '의원'], ['좋은한의원', '한의원'], ['미소치과의원', '치과의원'], ['행복의원', '의원']];
  clinics.forEach(([n, div], i) => {
    out.push({
      hpid: `A19${String(i).padStart(5, '0')}`, dutyName: n!, dutyDivNam: div!, dutyTel1: `02-555-02${String(i).padStart(2, '0')}`,
      dutyAddr: `서울특별시 강남구 강남대로 ${200 + i} (${dongs[i % 3]})`, wgs84Lat: String(37.501 + i * 0.002), wgs84Lon: String(127.027 + i * 0.002),
      dutyTime1s: '0900', dutyTime1c: '1830', dutyTime2s: '0900', dutyTime2c: '1830', dutyTime3s: '0900', dutyTime3c: i === 0 ? '2200' : '1830',
      dutyTime4s: '0900', dutyTime4c: '1830', dutyTime5s: '0900', dutyTime5c: '1830', dutyTime6s: '0900', dutyTime6c: '1300',
      ...(i === 0 ? { dutyTime7s: '1000', dutyTime7c: '1400', dutyTime8s: '1000', dutyTime8c: '1400' } : {}),
    });
  });
  return out;
}

const { sql, url } = await startTestDb(54329);
const now = new Date();
for (const [kind, items] of [
  ['hospital', [...fx('hospital-sample.xml'), ...synthetic().filter((s) => s.hpid!.startsWith('A'))]],
  ['pharmacy', [...fx('pharmacy-sample.xml'), ...synthetic().filter((s) => s.hpid!.startsWith('C'))]],
] as const) {
  const rows = items.map((i) => toInstitutionRow(kind, i)).filter((r): r is InstitutionRow => r !== null);
  const id = await startRun(sql, kind, now);
  await upsertInstitutions(sql, rows, now);
  await finishRun(sql, id, { status: 'ok', pages: 1, rows: rows.length, changed: rows.length, deactivated: 0 });
  console.log(`${kind}: ${rows.length} rows`);
}
console.log(`neighborhoods: ${await refreshNeighborhoods(sql)}`);
console.log(`dev db ready: ${url}`);
