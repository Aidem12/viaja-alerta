
import { pool } from './db.mjs';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function validateId(id) {
  if (
    typeof id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,70}$/.test(id)
  ) {
    fail('Identificador inválido.');
  }

  return id;
}

async function runDeletion(admin, callback) {
  if (!admin?.id || admin.role !== 'admin') {
    fail('Acceso restringido a administración.', 403);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Mismo orden de bloqueos que adminSync().
    await client.query(
      'SELECT pg_advisory_xact_lock(20261112)'
    );

    await client.query(
      'SELECT pg_advisory_xact_lock(20261111)'
    );

    // Verificar el rol vigente en PostgreSQL.
    const actor = await client.query(
      `SELECT role FROM users
       WHERE id = $1
       FOR UPDATE`,
      [admin.id]
    );

    if (actor.rows[0]?.role !== 'admin') {
      fail('Permisos administrativos insuficientes.', 403);
    }

    const result = await callback(client);

    await client.query('COMMIT');

    return result;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}

// Eliminar módulo y sus situaciones.
export async function deleteModule(admin, moduleId) {
  validateId(moduleId);

  return runDeletion(admin, async client => {
    const module = await client.query(
      'SELECT id FROM modules WHERE id = $1 FOR UPDATE',
      [moduleId]
    );

    if (module.rowCount === 0) {
      fail('Módulo no encontrado.', 404);
    }

    // ON DELETE CASCADE elimina opciones y progreso.
    await client.query(
      'DELETE FROM situations WHERE module_id = $1',
      [moduleId]
    );

    await client.query(
      'DELETE FROM modules WHERE id = $1',
      [moduleId]
    );

    return { ok: true };
  });
}

// Eliminar situación y registros dependientes.
export async function deleteSituation(
  admin,
  situationId
) {
  validateId(situationId);

  return runDeletion(admin, async client => {
    const result = await client.query(
      `DELETE FROM situations
       WHERE id = $1
       RETURNING id`,
      [situationId]
    );

    if (result.rowCount === 0) {
      fail('Situación no encontrada.', 404);
    }

    return { ok: true };
  });
}

// Eliminar recomendación.
export async function deleteTip(admin, tipId) {
  validateId(tipId);

  return runDeletion(admin, async client => {
    const result = await client.query(
      `DELETE FROM tips
       WHERE id = $1
       RETURNING id`,
      [tipId]
    );

    if (result.rowCount === 0) {
      fail('Recomendación no encontrada.', 404);
    }

    return { ok: true };
  });
}
