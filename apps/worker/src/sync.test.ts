import { describe, expect, test, vi } from 'vitest';
import type { InstitutionRow } from '@munyeon/db';
import type { Page } from './portal.ts';
import { syncSource, type SyncDeps } from './sync.ts';

const item = (id: string) => ({
  hpid: id, dutyName: `기관${id}`, dutyAddr: '서울특별시 중구 세종대로 1', dutyTime1s: '0900', dutyTime1c: '1800',
});

function makeDeps(total: number, perPage: number, opts: { failPages?: number[]; rowsPerPage?: number } = {}) {
  const pages = Math.ceil(total / perPage);
  const upserted: InstitutionRow[] = [];
  const deps = {
    fetchPage: vi.fn(async (_kind: string, pageNo: number, _size: number): Promise<Page> => {
      if (opts.failPages?.includes(pageNo)) throw new Error(`page ${pageNo} timeout`);
      const n = pageNo < pages ? perPage : total - perPage * (pages - 1);
      const count = Math.min(n, opts.rowsPerPage ?? n);
      return { totalCount: total, items: Array.from({ length: count }, (_, i) => item(`P${pageNo}-${i}`)) };
    }),
    upsert: vi.fn(async (rows: InstitutionRow[], _at: Date) => {
      upserted.push(...rows);
      return { inserted: rows.length, changed: 0, changedIds: [] as string[] };
    }),
    deactivate: vi.fn(async (_kind: string, _seen: string[], _at: Date) => ['GONE1', 'GONE2', 'GONE3']),
    startRun: vi.fn(async () => 42),
    finishRun: vi.fn(async () => {}),
  } satisfies SyncDeps;
  return { deps, upserted };
}

describe('syncSource', () => {
  test('walks ceil(totalCount/pageSize) pages', async () => {
    const { deps } = makeDeps(79006, 10000);
    // 테스트 속도를 위해 페이지당 1행만 돌려준다
    deps.fetchPage.mockImplementation(async (_k, pageNo) => ({ totalCount: 79006, items: [item(`P${pageNo}`)] }));
    await syncSource('hospital', deps, { pageSize: 10000 });
    expect(deps.fetchPage.mock.calls.map((c) => c[1])).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('deactivates unseen only after all pages ok', async () => {
    const { deps } = makeDeps(25, 10);
    const res = await syncSource('pharmacy', deps, { pageSize: 10 });
    expect(deps.deactivate).toHaveBeenCalledTimes(1);
    expect(deps.deactivate.mock.calls[0]![1]).toHaveLength(25);
    expect(res).toMatchObject({ pages: 3, rows: 25, deactivated: 3, failedPages: [] });
    expect(res.changedIds).toEqual(['GONE1', 'GONE2', 'GONE3']);
    expect(deps.finishRun).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'ok', rows: 25 }));
  });

  test('does not deactivate when any page failed', async () => {
    const { deps, upserted } = makeDeps(80, 10, { failPages: [5] });
    const res = await syncSource('hospital', deps, { pageSize: 10 });
    expect(deps.deactivate).not.toHaveBeenCalled();
    expect(res.failedPages).toEqual([5]);
    expect(upserted).toHaveLength(70); // 나머지 페이지는 반영
    expect(deps.finishRun).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'failed', deactivated: 0 }));
  });

  test('refuses to deactivate when rows < 90% of totalCount', async () => {
    const { deps } = makeDeps(100, 10, { rowsPerPage: 8 });
    const res = await syncSource('pharmacy', deps, { pageSize: 10 });
    expect(deps.deactivate).not.toHaveBeenCalled();
    expect(res.rows).toBe(80);
    expect(deps.finishRun).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'failed' }));
  });

  test('short middle page counts as failed', async () => {
    const { deps } = makeDeps(30, 10);
    const base = deps.fetchPage.getMockImplementation()!;
    deps.fetchPage.mockImplementation(async (k, pageNo, size) => {
      const p = await base(k, pageNo, size);
      return pageNo === 2 ? { ...p, items: p.items.slice(0, 5) } : p;
    });
    const res = await syncSource('pharmacy', deps, { pageSize: 10 });
    expect(res.failedPages).toEqual([2]);
    expect(deps.deactivate).not.toHaveBeenCalled();
  });

  test('stops fetching after the deadline and skips deactivation', async () => {
    const { deps } = makeDeps(30, 10);
    const res = await syncSource('pharmacy', deps, { pageSize: 10, deadlineAt: Date.now() - 1 });
    expect(deps.fetchPage).toHaveBeenCalledTimes(1);
    expect(res.failedPages).toEqual([2, 3]);
    expect(deps.deactivate).not.toHaveBeenCalled();
  });

  test('first page failure records failed run and throws', async () => {
    const { deps } = makeDeps(30, 10, { failPages: [1] });
    await expect(syncSource('pharmacy', deps, { pageSize: 10 })).rejects.toThrow(/page 1/);
    expect(deps.finishRun).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'failed' }));
  });

  test('zero totalCount never deactivates', async () => {
    const { deps } = makeDeps(0, 10);
    deps.fetchPage.mockImplementation(async () => ({ totalCount: 0, items: [] }));
    await syncSource('pharmacy', deps, { pageSize: 10 });
    expect(deps.deactivate).not.toHaveBeenCalled();
  });

  test('duplicate ids within a page are upserted once', async () => {
    const { deps, upserted } = makeDeps(2, 10);
    deps.fetchPage.mockImplementation(async () => ({ totalCount: 2, items: [item('X'), item('X')] }));
    await syncSource('pharmacy', deps, { pageSize: 10 });
    expect(upserted).toHaveLength(1);
  });
});
