
import crypto from 'node:crypto';
import { pool } from '../server/db.mjs';
import { register } from '../server/pg-auth.mjs';
import { createReport } from '../server/pg-reports.mjs';
import {
  updateUserRole,
  reviewReport
} from '../server/pg-admin-actions.mjs';

const email = `test-admin-${crypto.randomUUID()}@example.com`;
const password = crypto.randomBytes(18).toString('hex');

let userId = null;
let reportId = null;

try {
  const adminResult = await pool.query(
    `SELECT id, name, role
     FROM users
     WHERE role = 'admin'
     LIMIT 1`
  );

  const admin = adminResult.rows[0];

  if (!admin) {
    throw new Error('No existe un administrador.');
  }

  const registration = await register(
    'Alumno temporal',
    email,
    password
  );

  userId = registration.user.id;

  const created = await createReport({
    route: 'Ruta temporal',
    time: '12:00',
    tactic: 'Distracción',
    story: 'Reporte temporal para probar el panel administrativo.'
  });

  reportId = created.id;

  console.log('[OK] Datos temporales creados');

  const promoted = await updateUserRole(
    admin,
    userId,
    'admin'
  );

  if (promoted.role !== 'admin') {
    throw new Error('No se actualizó el rol.');
  }

  console.log('[OK] Rol actualizado');

  const demoted = await updateUserRole(
    admin,
    userId,
    'alumno'
  );

  if (demoted.role !== 'alumno') {
    throw new Error('No se restauró el rol.');
  }

  console.log('[OK] Rol restaurado');

  let selfChangeRejected = false;

  try {
    await updateUserRole(admin, admin.id, 'alumno');
  } catch (error) {
    selfChangeRejected = error.status === 403;
  }

  if (!selfChangeRejected) {
    throw new Error('Se permitió modificar el rol propio.');
  }

  console.log('[OK] Protección del administrador');

  let studentRejected = false;

  try {
    await reviewReport(
      { id: userId, role: 'alumno' },
      reportId
    );
  } catch (error) {
    studentRejected = error.status === 403;
  }

  if (!studentRejected) {
    throw new Error('Un alumno pudo revisar reportes.');
  }

  console.log('[OK] Permisos verificados');

  const reviewed = await reviewReport(
    admin,
    reportId
  );

  if (reviewed.status !== 'revisado') {
    throw new Error('No se actualizó el reporte.');
  }

  console.log('[OK] Reporte marcado como revisado');
  console.log('[Neon] Acciones administrativas verificadas.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;

} finally {
  try {
    if (reportId) {
      await pool.query(
        'DELETE FROM reports WHERE id = $1',
        [reportId]
      );
    }

    if (userId) {
      await pool.query(
        'DELETE FROM users WHERE id = $1',
        [userId]
      );
    }
  } catch (error) {
    console.error('[Neon] Error de limpieza:', error.message);
    process.exitCode = 1;
  }

  await pool.end();
}
