/**
 * 수집 워커 CLI. 공공 API는 이 워커만 호출한다.
 *   node src/cli.ts all|hospital|pharmacy|holidays|probe
 * 로그에는 건수·소요 시간만 남긴다(인증키·URL은 남기지 않는다).
 */
import { writeFile } from 'node:fs/promises';
import { kstParts } from '@munyeon/core';
import {
  deactivateMissing, finishRun, getLastSyncAt, getSql, refreshNeighborhoods, startRun, upsertHolidays,
  upsertInstitutions, type Kind,
} from '@munyeon/db';
import { assertFresh } from './health.ts';
import { fetchKasiYear, syncHolidays } from './holidays.ts';
import { fetchFullDataPage, redactKey } from './portal.ts';
import { requestRevalidate } from './revalidate.ts';
import { syncSource } from './sync.ts';

const KINDS: Kind[] = ['hospital', 'pharmacy'];

/** 워크플로 제한(40분) 안에 끝내도록 페이지 수집을 멈추는 시각. 남은 페이지는 실패로 기록된다. */
const SYNC_BUDGET_MS = 25 * 60_000;
const startedAt = Date.now();

async function runSync(kinds: Kind[]): Promise<boolean> {
  const sql = getSql();
  let ok = true;
  const changed: { kind: Kind; id: string }[] = [];
  for (const kind of kinds) {
    const t0 = Date.now();
    try {
      const r = await syncSource(kind, {
        // 첫 페이지는 넉넉히, 이후 페이지는 짧게 재시도(전체 시간 상한은 deadlineAt)
        fetchPage: (k, pageNo, size) =>
          fetchFullDataPage(k, pageNo, size, pageNo === 1 ? {} : { timeoutMs: 150_000, retries: 2 }),
        upsert: (rows, at) => upsertInstitutions(sql, rows, at),
        deactivate: (k, seen, at) => deactivateMissing(sql, k, seen, at),
        startRun: (source, at) => startRun(sql, source, at),
        finishRun: (id, s) => finishRun(sql, id, s),
      }, { deadlineAt: startedAt + SYNC_BUDGET_MS });
      console.log(`${kind}: pages=${r.pages} rows=${r.rows} inserted=${r.inserted} changed=${r.changed} deactivated=${r.deactivated} failedPages=[${r.failedPages}] ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (r.failedPages.length) ok = false;
      changed.push(...r.changedIds.map((id) => ({ kind, id })));
    } catch (e) {
      ok = false;
      console.error(`${kind}: FAILED ${redactKey(e instanceof Error ? e.message : String(e))}`);
    }
  }
  try {
    console.log(`neighborhoods: ${await refreshNeighborhoods(sql)}`);
  } catch (e) {
    ok = false;
    console.error(`neighborhoods: FAILED ${e instanceof Error ? e.message : String(e)}`);
  }

  const baseUrl = process.env.WEB_BASE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (baseUrl && secret) {
    console.log(`revalidate: ${await requestRevalidate(changed, { baseUrl, secret })} (${changed.length} changed)`);
  }

  try {
    await assertFresh((k) => getLastSyncAt(sql, k));
  } catch (e) {
    ok = false;
    console.error(`health: ${e instanceof Error ? e.message : String(e)}`);
  }
  return ok;
}

async function runHolidays(): Promise<boolean> {
  const sql = getSql();
  const year = Number(kstParts(new Date()).ymd.slice(0, 4)); // 1월 1일 새벽(UTC로는 전년도)에도 올해 기준
  try {
    const n = await syncHolidays([year, year + 1], {
      fetchYear: (y) => fetchKasiYear(y),
      upsert: (rows) => upsertHolidays(sql, rows, 'kasi'),
    });
    console.log(`holidays: upserted=${n} years=${year},${year + 1}`);
    return true;
  } catch (e) {
    console.error(`holidays: FAILED ${redactKey(e instanceof Error ? e.message : String(e))}`);
    return false;
  }
}

/** 실행 환경에서 공공 API에 닿는지 확인(소스당 1호출, 10행). DB는 쓰지 않는다. */
async function runProbe(): Promise<boolean> {
  let ok = true;
  for (const kind of KINDS) {
    const t0 = Date.now();
    try {
      const page = await fetchFullDataPage(kind, 1, 10, { retries: 0 });
      const ms = Date.now() - t0;
      console.log(`probe ${kind}: ok totalCount=${page.totalCount} items=${page.items.length} ${ms}ms`);
      if (process.argv.includes('--save')) {
        await writeFile(new URL(`./__fixtures__/probe-${kind}.json`, import.meta.url), JSON.stringify(page.items, null, 1));
      }
    } catch (e) {
      ok = false;
      console.error(`probe ${kind}: FAILED ${redactKey(e instanceof Error ? e.message : String(e))}`);
    }
  }
  return ok;
}

const cmd = process.argv[2] ?? 'all';
let ok: boolean;
switch (cmd) {
  case 'all': ok = await runSync(KINDS); break;
  case 'hospital': case 'pharmacy': ok = await runSync([cmd]); break;
  case 'holidays': ok = await runHolidays(); break;
  case 'probe': ok = await runProbe(); break;
  default:
    console.error(`unknown command: ${cmd}`);
    ok = false;
}
if (cmd !== 'probe') await getSql().end().catch(() => {});
process.exitCode = ok ? 0 : 1;
