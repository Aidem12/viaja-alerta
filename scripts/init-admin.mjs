
import { initializeAdmin } from '../server/pg-auth.mjs';
import { pool } from '../server/db.mjs';

try {
  await initializeAdmin();

  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM users
     WHERE role = 'admin'`
  );

  console.log(
    '[Neon] Administradores registrados:',
    result.rows[0].total
  );

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;

} finally {
  await pool.end();
}
