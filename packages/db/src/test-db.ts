import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createSql, type Sql } from './client.ts';
import { migrate } from './migrate.ts';

/** 테스트용 인메모리 Postgres(PGlite + PostGIS)를 TCP로 띄우고 마이그레이션까지 적용한다. */
export async function startTestDb(): Promise<{ sql: Sql; stop: () => Promise<void> }> {
  const db = await PGlite.create({ extensions: { postgis } });
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  await server.start();
  const sql = createSql(`postgres://postgres:postgres@${server.getServerConn()}/postgres`, 1);
  await migrate(sql);
  return {
    sql,
    stop: async () => {
      await sql.end();
      await server.stop();
      await db.close();
    },
  };
}
