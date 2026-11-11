
import crypto from 'node:crypto';
import { pool } from '../server/db.mjs';
import { publicState } from '../server/pg-core.mjs';
import { adminSync } from '../server/pg-admin-sync.mjs';

try {
  const result = await pool.query(
    `SELECT id, name, email, role, created_on
     FROM users
     WHERE role = 'admin'
     LIMIT 1`
  );

  const admin = result.rows[0];

  if (!admin) {
    throw new Error('No existe administrador.');
  }

  const before = await publicState(admin);

  // Sincronización sin cambios.
  const updated = await adminSync(admin, before);

  if (
    updated.site.heroTitle !== before.site.heroTitle ||
    updated.modules.length !== before.modules.length ||
    updated.users.length !== before.users.length
  ) {
    throw new Error('La sincronización modificó datos.');
  }

  console.log('[OK] Sincronización administrativa');

  // Comprobar que una operación fallida revierte
  // cambios educativos realizados previamente.
  const temporaryTitle =
    `Prueba de transacción ${crypto.randomUUID()}`;

  let rollbackVerified = false;

  try {
    await adminSync(admin, {
      ...before,
      site: {
        ...before.site,
        heroTitle: temporaryTitle
      },
      reports: [
        ...before.reports,
        {
          id: crypto.randomUUID(),
          status: 'revisado'
        }
      ]
    });
  } catch (error) {
    const afterError = await publicState(admin);

    rollbackVerified =
      error.status === 400 &&
      afterError.site.heroTitle === before.site.heroTitle;
  }

  if (!rollbackVerified) {
    throw new Error(
      'No se comprobó el rollback de la transacción.'
    );
  }

  console.log('[OK] Rollback verificado');

  let forbidden = false;

  try {
    await adminSync(
      { id: 'test', role: 'alumno' },
      before
    );
  } catch (error) {
    forbidden = error.status === 403;
  }

  if (!forbidden) {
    throw new Error('Se permitió el acceso a un alumno.');
  }

  console.log('[OK] Permisos administrativos');
  console.log('[Neon] adminSync verificado.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;

} finally {
  await pool.end();
}
