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

  test('resetSql drops the shared client so the next call opens a fresh one (D47)', async () => {
    const { getSql, resetSql } = await import('./client.ts');
    const first = getSql();
    await resetSql();
    expect(getSql()).not.toBe(first);
  });
});
