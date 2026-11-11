
import { pool } from './db.mjs';
import { publicState } from './pg-core.mjs';
import { syncEducationalContent } from './pg-educational-admin.mjs';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function validateList(value, name, max = 5000) {
  if (!Array.isArray(value) || value.length > max) {
    fail(`Lista inválida: ${name}`);
  }
  return value;
}

function validateIds(items, name) {
  const ids = items.map(item => item?.id);

  if (ids.some(id => typeof id !== 'string')) {
    fail(`Identificador inválido: ${name}`);
  }

  if (new Set(ids).size !== ids.length) {
    fail(`Identificadores duplicados: ${name}`);
  }
}

export async function adminSync(admin, payload) {
  if (!admin?.id || admin.role !== 'admin') {
    fail('Acceso restringido a administración.', 403);
  }

  if (!payload || typeof payload !== 'object') {
    fail('Datos inválidos.');
  }

  const users = validateList(payload.users, 'usuarios');
  const reports = validateList(payload.reports, 'reportes');

  validateIds(users, 'usuarios');
  validateIds(reports, 'reportes');

  const wantedUsers = new Map();

  for (const user of users) {
    if (!['admin', 'alumno'].includes(user.role)) {
      fail('Rol inválido.');
    }

    wantedUsers.set(user.id, user.role);
  }

  if (wantedUsers.get(admin.id) !== 'admin') {
    fail('No puedes modificar tu propio rol.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Serializar cambios administrativos.
    await client.query(
      'SELECT pg_advisory_xact_lock(20261112)'
    );

    // Comprobar el administrador contra PostgreSQL.
    const adminResult = await client.query(
      `SELECT role
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [admin.id]
    );

    if (adminResult.rows[0]?.role !== 'admin') {
      fail('Acceso restringido a administración.', 403);
    }

    // Actualizar el contenido usando la misma transacción.
    await syncEducationalContent(
      admin,
      payload,
      client
    );

    // Consultar y bloquear los usuarios existentes.
    const existingUsers = await client.query(
      'SELECT id FROM users ORDER BY id FOR UPDATE'
    );

    const existingIds = new Set(
      existingUsers.rows.map(row => row.id)
    );

    // Por seguridad, esta versión no elimina cuentas.
    if (
      existingUsers.rows.some(
        row => !wantedUsers.has(row.id)
      )
    ) {
      fail(
        'La eliminación de usuarios todavía no está habilitada.'
      );
    }

    if (
      users.some(user => !existingIds.has(user.id))
    ) {
      fail('La lista contiene usuarios inexistentes.');
    }

    // Actualizar los roles.
    for (const user of users) {
      if (user.id === admin.id) {
        continue;
      }

      await client.query(
        `UPDATE users
         SET role = $1
         WHERE id = $2`,
        [user.role, user.id]
      );
    }

    // Verificar que los reportes enviados existen.
    const existingReports = await client.query(
      'SELECT id FROM reports ORDER BY id FOR UPDATE'
    );

    const reportIds = new Set(
      existingReports.rows.map(row => row.id)
    );

    if (
      reports.some(report => !reportIds.has(report.id))
    ) {
      fail('La lista contiene reportes inexistentes.');
    }

    // Conservar el comportamiento original:
    // solo cambiar el estado cuando se marca "revisado".
    for (const report of reports) {
      if (report.status === 'revisado') {
        await client.query(
          `UPDATE reports
           SET status = 'revisado'
           WHERE id = $1`,
          [report.id]
        );
      }
    }

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }

  // Recuperar el estado después de confirmar los cambios.
  return publicState(admin);
}
