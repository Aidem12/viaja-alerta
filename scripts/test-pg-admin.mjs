
import { pool } from '../server/db.mjs';
import {
  getUsers,
  getAdminState
} from '../server/pg-admin.mjs';

try {
  // Comprobar que existe el administrador.
  const result = await pool.query(`
    SELECT id, name, role
    FROM users
    WHERE role = 'admin'
    LIMIT 1
  `);

  const admin = result.rows[0];

  if (!admin) {
    throw new Error(
      'No hay un administrador registrado.'
    );
  }

  console.log('[OK] Administrador encontrado');

  // Verificar la lectura de usuarios.
  const users = await getUsers(admin);

  if (!users.some(user => user.id === admin.id)) {
    throw new Error(
      'El administrador no aparece en la lista.'
    );
  }

  if (users.some(user => 'password_hash' in user)) {
    throw new Error(
      'Se están exponiendo hashes de contraseñas.'
    );
  }

  console.log('[OK] Usuarios recuperados');
  console.log('[OK] Contraseñas protegidas');

  // Verificar los permisos del módulo.
  let forbidden = false;

  try {
    await getAdminState({
      id: 'test',
      role: 'alumno'
    });
  } catch (error) {
    forbidden = error.status === 403;
  }

  if (!forbidden) {
    throw new Error(
      'Se permitió acceder sin ser administrador.'
    );
  }

  console.log('[OK] Acceso administrativo restringido');

  // Recuperar los datos del panel.
  const state = await getAdminState(admin);

  if (
    !Array.isArray(state.modules) ||
    !Array.isArray(state.situations) ||
    !Array.isArray(state.posts) ||
    !Array.isArray(state.reports)
  ) {
    throw new Error(
      'La estructura del panel es incorrecta.'
    );
  }

  console.log('[OK] Estado administrativo recuperado');

  console.table({
    usuarios: state.users.length,
    modulos: state.modules.length,
    situaciones: state.situations.length,
    publicaciones: state.posts.length,
    reportes: state.reports.length
  });

  console.log(
    '[Neon] Lectura administrativa verificada.'
  );

} catch (error) {
  console.error(
    '[Neon] Error:',
    error.message
  );

  process.exitCode = 1;
} finally {
  await pool.end();
}
