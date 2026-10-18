import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { postgis } from '@electric-sql/pglite-postgis';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createSql, type Sql } from './client.ts';
import { migrate } from './migrate.ts';

/** 테스트용 인메모리 Postgres(PGlite + PostGIS)를 TCP로 띄우고 마이그레이션까지 적용한다. */
/** dataDir를 주면 디스크에 저장한다(로컬 실데이터 확인용, 재시작해도 유지). */
export async function startTestDb(port = 0, dataDir?: string): Promise<{ sql: Sql; url: string; stop: () => Promise<void> }> {
  const db = await PGlite.create({ dataDir, extensions: { postgis, pg_trgm } });
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  const url = `postgres://postgres:postgres@${server.getServerConn()}/postgres`;
  const sql = createSql(url, 1);
  await migrate(sql);
  return {
    sql,
    url,
    stop: async () => {
      await sql.end();
      await server.stop();
      await db.close();
    },
  };
}
