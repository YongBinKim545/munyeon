import { afterAll, describe, expect, test, vi } from 'vitest';

// Next.js는 서버 코드 묶음마다 모듈을 따로 불러, 모듈 변수만으로는 연결이 여러 개 생긴다.
// 로컬 DB(PGlite)는 세션이 하나라 연결이 여럿이면 쿼리가 섞인다(2026-10-19 'bind message supplies 2 parameters').
describe('getSql', () => {
  const prev = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://u:p@127.0.0.1:1/db';
  afterAll(() => {
    process.env.DATABASE_URL = prev;
    delete (globalThis as { __munyeonSql?: unknown }).__munyeonSql;
  });

  test('separately loaded module copies share one client per process', async () => {
    const a = await import('./client.ts');
    vi.resetModules();
    const b = await import('./client.ts');
    expect(a).not.toBe(b);
    expect(a.getSql()).toBe(b.getSql());
  });

  test('pool holds at most DB_POOL_MAX connections, one by default (web)', async () => {
    const { createSql } = await import('./client.ts');
    expect(createSql('postgres://u:p@127.0.0.1:1/db').pool.options.max).toBe(1);
    expect(createSql('postgres://u:p@127.0.0.1:1/db', 4).pool.options.max).toBe(4);
  });

  test('resetSql drops the shared client so the next call opens a fresh one (D47)', async () => {
    const { getSql, resetSql } = await import('./client.ts');
    const first = getSql();
    await resetSql();
    expect(getSql()).not.toBe(first);
  });
});

describe('query building (pg, P0-10)', () => {
  test('values become numbered parameters, fragments are inlined', async () => {
    const { createSql } = await import('./client.ts');
    const sql = createSql('postgres://u:p@127.0.0.1:1/db');
    const cols = sql`a, b`;
    const cond = sql`x = ${1} and y = ${'z'}`;
    expect(sql`select ${cols} from t where ${cond} and k = ${'pharmacy'} limit ${5}`.build()).toEqual({
      text: 'select a, b from t where x = $1 and y = $2 and k = $3 limit $4',
      params: [1, 'z', 'pharmacy', 5],
    });
  });

  test('json() sends a JSON string, arrays stay arrays', async () => {
    const { createSql } = await import('./client.ts');
    const sql = createSql('postgres://u:p@127.0.0.1:1/db');
    expect(sql`select ${sql.json([{ a: 1 }])}::jsonb, ${sql.array(['a', 'b'])}::text[]`.build().params).toEqual(['[{"a":1}]', ['a', 'b']]);
  });

  test('a string value is never spliced into SQL', async () => {
    const { createSql } = await import('./client.ts');
    const sql = createSql('postgres://u:p@127.0.0.1:1/db');
    const evil = "x'; drop table institutions; --";
    expect(sql`select 1 where name = ${evil}`.build()).toEqual({ text: 'select 1 where name = $1', params: [evil] });
  });
});
