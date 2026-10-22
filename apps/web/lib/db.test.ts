import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

let connections = 0;
const pool = new Map<number, { id: number }>();
const resetSql = vi.fn(async () => {});
vi.mock('@munyeon/db', () => ({
  getSql: () => {
    if (!pool.has(connections)) pool.set(connections, { id: connections });
    return pool.get(connections);
  },
  resetSql: () => {
    connections += 1; // 다음 getSql은 새 연결
    return resetSql();
  },
}));

const { IDLE_RESET_MS, query, resetDbUsage } = await import('./db');
const quiet = { log: () => {} };

beforeEach(() => {
  vi.useFakeTimers();
  connections = 0;
  pool.clear();
  resetSql.mockClear();
  resetDbUsage();
});
afterEach(() => vi.useRealTimers());

describe('query (D50)', () => {
  test('consecutive queries reuse the connection', async () => {
    await query('a', async () => 1, quiet);
    vi.advanceTimersByTime(IDLE_RESET_MS - 1000);
    await query('b', async () => 2, quiet);
    expect(resetSql).not.toHaveBeenCalled();
  });

  test('after resting longer than IDLE_RESET_MS, a new connection is made before the query', async () => {
    await query('a', async () => 1, quiet);
    vi.advanceTimersByTime(IDLE_RESET_MS + 1);
    const seen = await query('b', async (sql) => (sql as unknown as { id: number }).id, quiet);
    expect(resetSql).toHaveBeenCalledTimes(1);
    expect(seen).toBe(1);
  });

  test('does not drop the connection while another query is still running', async () => {
    await query('a', async () => 1, quiet);
    vi.advanceTimersByTime(IDLE_RESET_MS + 1);
    let finish!: () => void;
    const slow = query('slow', () => new Promise<void>((r) => (finish = r)), quiet); // 여기서 한 번 새로 연결
    await query('c', async () => 1, quiet);
    expect(resetSql).toHaveBeenCalledTimes(1);
    finish();
    await slow;
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
