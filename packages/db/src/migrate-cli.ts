import { getSql } from './client.ts';
import { migrate } from './migrate.ts';

const sql = getSql();
try {
  const applied = await migrate(sql);
  console.log(applied.length ? `applied: ${applied.join(', ')}` : 'up to date');
} finally {
  await sql.end();
}
