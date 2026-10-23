import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

let connections = 0;
const pool = new Map<number, { id: number }>();
const resetSql = vi.fn(async () => {});
const configurePool = vi.fn();
const attachDatabasePool = vi.fn();
vi.mock('@vercel/functions', () => ({ attachDatabasePool }));
vi.mock('@munyeon/db', () => ({
  configurePool,
  getSql: () => {
    if (!pool.has(connections)) pool.set(connections, { id: connections });
    return pool.get(connections);
  },
  resetSql: () => {
    connections += 1; // 다음 getSql은 새 연결
    return resetSql();
  },
}));

const { POOL_IDLE_MS, query } = await import('./db');
const quiet = { log: () => {} };

beforeEach(() => {
  vi.useFakeTimers();
  connections = 0;
  pool.clear();
  resetSql.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('query (D50)', () => {
  test('the pool closes idle connections before the function freezes (P0-10)', () => {
    expect(configurePool).toHaveBeenCalledWith(expect.objectContaining({ idleMs: POOL_IDLE_MS }));
    const pool = {};
    configurePool.mock.calls[0]![0].onCreate(pool);
    expect(attachDatabasePool).toHaveBeenCalledWith(pool);
  });

  test('consecutive queries reuse the connection', async () => {
    await query('a', async () => 1, quiet);
    vi.advanceTimersByTime(60_000);
    await query('b', async () => 2, quiet);
    expect(resetSql).not.toHaveBeenCalled();
  });

  test('a hung query times out, the connection is dropped, and the retry on a new connection answers', async () => {
    const seen: number[] = [];
    const p = query(
      'hang',
      (sql) => {
        const id = (sql as unknown as { id: number }).id;
        seen.push(id);
        return id === 0 ? new Promise<string>(() => {}) : Promise.resolve('ok');
      },
      quiet,
    );
    await vi.advanceTimersByTimeAsync(8_000);
    await expect(p).resolves.toBe('ok');
    expect(seen).toEqual([0, 1]);
    expect(resetSql).toHaveBeenCalledTimes(1);
  });

  test('two requests failing together do not cut each other retry', async () => {
    const seen: number[] = [];
    const run = () =>
      query(
        'hang',
        (sql) => {
          const id = (sql as unknown as { id: number }).id;
          seen.push(id);
          return id === 0 ? new Promise<string>(() => {}) : Promise.resolve('ok');
        },
        quiet,
      );
    const both = Promise.all([run(), run()]);
    await vi.advanceTimersByTimeAsync(8_000);
    await expect(both).resolves.toEqual(['ok', 'ok']);
    expect(resetSql).toHaveBeenCalledTimes(1);
    expect(seen).toEqual([0, 0, 1, 1]);
  });

  test('gives up after two tries so a page never waits forever', async () => {
    const p = query('hang', () => new Promise<never>(() => {}), quiet);
    const done = expect(p).rejects.toThrow('시간 초과');
    await vi.advanceTimersByTimeAsync(16_000);
    await done;
  });

  test('writes can opt out of the retry', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(query('w', fn, { tries: 1, ...quiet })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
