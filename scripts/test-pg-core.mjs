
import { pool } from '../server/db.mjs';
import { publicState } from '../server/pg-core.mjs';

try {
  // Comprobar estado público.
  const publicData = await publicState(null);

  if (
    publicData.modules.length !== 4 ||
    publicData.situations.length !== 9 ||
    publicData.posts.length < 3
  ) {
    throw new Error('El contenido público está incompleto.');
  }

  if (
    publicData.session !== null ||
    publicData.users.length !== 0 ||
    publicData.reports.length !== 0 ||
    publicData.metrics !== undefined
  ) {
    throw new Error(
      'El estado público contiene información privada.'
    );
  }

  console.log('[OK] Estado público recuperado');
  console.log('[OK] Datos privados protegidos');

  // Obtener el administrador de Neon.
  const adminResult = await pool.query(
    `SELECT id, name, email, role, created_on
     FROM users
     WHERE role = 'admin'
     LIMIT 1`
  );

  const admin = adminResult.rows[0];

  if (!admin) {
    throw new Error('No existe un administrador.');
  }

  const adminData = await publicState(admin);

  if (
    adminData.session !== admin.id ||
    !adminData.users.some(u => u.id === admin.id) ||
    !adminData.metrics
  ) {
    throw new Error(
      'El estado administrativo está incompleto.'
    );
  }

  if (
    adminData.users.some(u => 'password_hash' in u)
  ) {
    throw new Error(
      'Se expusieron contraseñas protegidas.'
    );
  }

  console.log('[OK] Estado administrativo recuperado');
  console.log('[OK] Contraseñas protegidas');

  console.table({
    modules: adminData.modules.length,
    situations: adminData.situations.length,
    posts: adminData.posts.length,
    users: adminData.users.length,
    reports: adminData.reports.length
  });

  console.log('[Neon] Estado de la plataforma verificado.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
