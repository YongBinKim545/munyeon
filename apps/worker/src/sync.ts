import type { InstitutionRow, Kind } from '@munyeon/db';
import { toInstitutionRow } from './map.ts';
import type { Page } from './portal.ts';

export interface RunSummary {
  status: 'ok' | 'failed';
  pages: number;
  rows: number;
  changed: number;
  deactivated: number;
  error?: string;
}

export interface SyncDeps {
  fetchPage(kind: Kind, pageNo: number, pageSize: number): Promise<Page>;
  upsert(rows: InstitutionRow[], runAt: Date): Promise<{ inserted: number; changed: number; changedIds: string[] }>;
  deactivate(kind: Kind, seenIds: string[], runAt: Date): Promise<number>;
  startRun(source: string, at: Date): Promise<number>;
  finishRun(id: number, r: RunSummary): Promise<void>;
}

export interface SyncResult {
  pages: number;
  rows: number;
  inserted: number;
  changed: number;
  deactivated: number;
  failedPages: number[];
  /** 내용이 바뀐 기존 기관(페이지 갱신 요청 대상) */
  changedIds: string[];
}

/** 받은 행이 전체 건수의 이 비율 미만이면 비활성화하지 않는다(API 일시 이상 방어). */
export const MIN_SEEN_RATIO = 0.9;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * FullData 전 페이지를 받아 페이지마다 바로 upsert한다(메모리 절약).
 * 모든 페이지가 성공하고 충분한 행을 받았을 때만 이번에 안 보인 기관을 비활성화한다.
 */
export async function syncSource(
  kind: Kind,
  deps: SyncDeps,
  opts: { pageSize?: number; now?: Date } = {},
): Promise<SyncResult> {
  const pageSize = opts.pageSize ?? 10_000;
  const runAt = opts.now ?? new Date();
  const runId = await deps.startRun(kind, runAt);
  const seen = new Set<string>();
  const result: SyncResult = { pages: 0, rows: 0, inserted: 0, changed: 0, deactivated: 0, failedPages: [], changedIds: [] };

  const ingest = async (page: Page) => {
    const rows = new Map<string, InstitutionRow>();
    for (const item of page.items) {
      const row = toInstitutionRow(kind, item);
      if (row) rows.set(row.id, row);
    }
    const { inserted, changed, changedIds } = await deps.upsert([...rows.values()], runAt);
    result.changedIds.push(...changedIds);
    for (const id of rows.keys()) seen.add(id);
    result.inserted += inserted;
    result.changed += changed;
  };

  let totalCount: number;
  try {
    const first = await deps.fetchPage(kind, 1, pageSize);
    totalCount = first.totalCount;
    result.pages = Math.max(1, Math.ceil(totalCount / pageSize));
    await ingest(first);
  } catch (e) {
    await deps.finishRun(runId, { status: 'failed', pages: 0, rows: 0, changed: 0, deactivated: 0, error: `page 1: ${message(e)}` });
    throw new Error(`${kind} page 1 failed: ${message(e)}`);
  }

  const errors: string[] = [];
  for (let pageNo = 2; pageNo <= result.pages; pageNo++) {
    try {
      await ingest(await deps.fetchPage(kind, pageNo, pageSize));
    } catch (e) {
      result.failedPages.push(pageNo);
      errors.push(`page ${pageNo}: ${message(e)}`);
    }
  }
  result.rows = seen.size;

  if (result.failedPages.length === 0 && totalCount > 0) {
    if (seen.size >= totalCount * MIN_SEEN_RATIO) {
      result.deactivated = await deps.deactivate(kind, [...seen], runAt);
    } else {
      errors.push(`rows ${seen.size} < ${MIN_SEEN_RATIO * 100}% of totalCount ${totalCount}`);
    }
  }

  await deps.finishRun(runId, {
    status: errors.length ? 'failed' : 'ok',
    pages: result.pages,
    rows: result.rows,
    changed: result.inserted + result.changed,
    deactivated: result.deactivated,
    ...(errors.length ? { error: errors.join('; ') } : {}),
  });
  return result;
}
