
import crypto from 'node:crypto';
import { pool } from '../server/db.mjs';
import { register } from '../server/pg-auth.mjs';
import {
  getProgress,
  choose,
  resetProgress
} from '../server/pg-progress.mjs';

const email = `test-progress-${crypto.randomUUID()}@example.com`;
const password = crypto.randomBytes(18).toString('hex');

let testUser = null;

try {
  // Crear un usuario temporal
  const session = await register(
    'Alumno de prueba',
    email,
    password
  );

  testUser = session.user;

  console.log('[OK] Usuario temporal creado');

  // Responder la primera situación
  const correct = await choose(testUser, 's1', 1);

  if (correct !== true) {
    throw new Error('La respuesta esperada era correcta.');
  }

  console.log('[OK] Respuesta guardada');

  // Comprobar que PostgreSQL conserva el progreso
  const progress = await getProgress(testUser);

  if (progress.s1 !== true) {
    throw new Error('No se recuperó el progreso.');
  }

  console.log('[OK] Progreso recuperado desde Neon');

  // Reiniciar progreso
  await resetProgress(testUser);

  const afterReset = await getProgress(testUser);

  if (Object.keys(afterReset).length !== 0) {
    throw new Error('No se eliminó el progreso.');
  }

  console.log('[OK] Progreso reiniciado');
  console.log('[Neon] Pruebas de progreso completadas.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;

} finally {
  // Eliminar la cuenta ficticia y sus sesiones.
  try {
    await pool.query(
      'DELETE FROM users WHERE email = $1',
      [email]
    );
  } catch (error) {
    console.error(
      '[Neon] Error al limpiar:',
      error.message
    );
    process.exitCode = 1;
  }

  await pool.end();
}
