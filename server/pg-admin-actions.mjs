
import { pool } from './db.mjs';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function requireAdmin(user) {
  if (user?.role !== 'admin') {
    fail('Acceso restringido a administración.', 403);
  }
}

// Modificar el rol de otro usuario.
export async function updateUserRole(admin, userId, role) {
  requireAdmin(admin);

  if (!['alumno', 'admin'].includes(role)) {
    fail('Rol inválido.');
  }

  if (admin.id === userId) {
    fail('No puedes modificar tu propio rol.', 403);
  }

  const result = await pool.query(
    `UPDATE users
     SET role = $1
     WHERE id = $2
     RETURNING id, role`,
    [role, userId]
  );

  if (result.rowCount === 0) {
    fail('Usuario no encontrado.', 404);
  }

  return result.rows[0];
}

// Marcar un reporte como revisado.
export async function reviewReport(admin, reportId) {
  requireAdmin(admin);

  const result = await pool.query(
    `UPDATE reports
     SET status = 'revisado'
     WHERE id = $1
     RETURNING id, status`,
    [reportId]
  );

  if (result.rowCount === 0) {
    fail('Reporte no encontrado.', 404);
  }

  return result.rows[0];
}


export async function updateSiteSettings(admin, site) {
  requireAdmin(admin);

  if (!site || typeof site !== 'object') {
    fail('Configuración inválida.');
  }

  const heroTitle = String(site.heroTitle ?? '').trim();
  const heroText = String(site.heroText ?? '').trim();

  if (
    heroTitle.length < 1 ||
    heroTitle.length > 220 ||
    heroText.length < 1 ||
    heroText.length > 1000
  ) {
    fail('Título o descripción inválidos.');
  }

  const result = await pool.query(
    `INSERT INTO site_settings
       (id, hero_title, hero_text)
     VALUES (1, $1, $2)
     ON CONFLICT (id)
     DO UPDATE SET
       hero_title = EXCLUDED.hero_title,
       hero_text = EXCLUDED.hero_text
     RETURNING hero_title, hero_text`,
    [heroTitle, heroText]
  );

  return {
    heroTitle: result.rows[0].hero_title,
    heroText: result.rows[0].hero_text
  };
}


export async function deleteUser(admin, userId) {
  if (!admin?.id || admin.role !== 'admin') {
    const error = new Error('Acceso restringido a administración.');
    error.status = 403;
    throw error;
  }

  if (
    typeof userId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(userId)
  ) {
    const error = new Error('Identificador de usuario inválido.');
    error.status = 400;
    throw error;
  }

  if (admin.id === userId) {
    const error = new Error('No puedes eliminar tu propia cuenta.');
    error.status = 403;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Coordinar operaciones administrativas.
    await client.query(
      'SELECT pg_advisory_xact_lock(20261112)'
    );

    // Comprobar que el administrador mantiene su rol.
    const actor = await client.query(
      `SELECT role FROM users
       WHERE id = $1
       FOR UPDATE`,
      [admin.id]
    );

    if (actor.rows[0]?.role !== 'admin') {
      const error = new Error('Permisos insuficientes.');
      error.status = 403;
      throw error;
    }

    const result = await client.query(
      `DELETE FROM users
       WHERE id = $1
       RETURNING id`,
      [userId]
    );

    if (result.rowCount === 0) {
      const error = new Error('Usuario no encontrado.');
      error.status = 404;
      throw error;
    }

    await client.query('COMMIT');

    return { ok: true };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}
