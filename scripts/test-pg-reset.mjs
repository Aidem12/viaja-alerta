
import crypto from 'node:crypto';
import { pool } from '../server/db.mjs';
import { register, login, getUser } from '../server/pg-auth.mjs';
import { requestReset, resetPassword } from '../server/pg-reset.mjs';

const email = `test-reset-${crypto.randomUUID()}@example.com`;
const oldPassword = crypto.randomBytes(18).toString('hex');
const newPassword = crypto.randomBytes(18).toString('hex');

// Habilitar códigos visibles solo dentro de esta prueba.
process.env.DEV_SHOW_RESET_CODE = '1';

try {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('No ejecutar esta prueba en modo producción.');
  }

  const registered = await register(
    'Alumno temporal',
    email,
    oldPassword
  );

  console.log('[OK] Usuario temporal creado');

  const code = await requestReset(email);

  if (!code || code.length < 20) {
    throw new Error('No se generó el código.');
  }

  console.log('[OK] Código de recuperación generado');

  await resetPassword(email, code, newPassword);

  console.log('[OK] Contraseña actualizada');

  // La sesión original debe quedar invalidada.
  const previousUser = await getUser(
    `sid=${registered.token}`
  );

  if (previousUser !== null) {
    throw new Error('La sesión anterior sigue activa.');
  }

  console.log('[OK] Sesión anterior invalidada');

  // La contraseña anterior ya no debe funcionar.
  let oldPasswordRejected = false;

  try {
    await login(email, oldPassword);
  } catch (error) {
    oldPasswordRejected = error.status === 401;
  }

  if (!oldPasswordRejected) {
    throw new Error('La contraseña anterior sigue siendo válida.');
  }

  console.log('[OK] Contraseña anterior rechazada');

  // La contraseña nueva debe funcionar.
  await login(email, newPassword);

  console.log('[OK] Inicio de sesión con nueva contraseña');

  // El código no puede utilizarse dos veces.
  let codeRejected = false;

  try {
    await resetPassword(email, code, oldPassword);
  } catch (error) {
    codeRejected = error.status === 400;
  }

  if (!codeRejected) {
    throw new Error('El código pudo reutilizarse.');
  }

  console.log('[OK] Código de recuperación de un solo uso');
  console.log('[Neon] Recuperación de contraseñas verificada.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;

} finally {
  try {
    await pool.query(
      'DELETE FROM users WHERE email = $1',
      [email]
    );
  } catch (error) {
    console.error(
      '[Neon] Error al limpiar usuario temporal:',
      error.message
    );
    process.exitCode = 1;
  }

  await pool.end();
}
