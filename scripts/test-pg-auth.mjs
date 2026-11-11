
import crypto from 'node:crypto';
import { pool } from '../server/db.mjs';
import * as auth from '../server/pg-auth.mjs';

const email = `test-${crypto.randomUUID()}@example.com`;
const password = crypto.randomBytes(18).toString('hex');

try {
  const registered = await auth.register(
    'Usuario de prueba',
    email,
    password
  );

  console.log('[OK] Registro en PostgreSQL');

  const logged = await auth.login(email, password);

  console.log('[OK] Inicio de sesión');

  const cookie = `sid=${logged.token}`;
  const user = await auth.getUser(cookie);

  if (user?.id !== registered.user.id) {
    throw new Error('La sesión no coincide.');
  }

  console.log('[OK] Identificación mediante cookie');

  await auth.logout(cookie);

  const afterLogout = await auth.getUser(cookie);

  if (afterLogout !== null) {
    throw new Error('La sesión sigue activa.');
  }

  console.log('[OK] Cierre de sesión');
  console.log('[Neon] Autenticación verificada.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;

} finally {
  // Eliminar solamente la cuenta ficticia de esta prueba.
  await pool.query(
    'DELETE FROM users WHERE email = $1',
    [email]
  ).catch(err => {
    console.error('Error al limpiar la prueba:', err.message);
    process.exitCode = 1;
  });

  await pool.end();
}
