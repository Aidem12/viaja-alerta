
import { pool } from './db.mjs';
import { loadEducationalContent } from './pg-state.mjs';
import { getPosts } from './pg-forum.mjs';
import { getReports } from './pg-reports.mjs';
import { getMetrics } from './pg-metrics.mjs';

function requireAdmin(user) {
  if (user?.role !== 'admin') {
    const error = new Error(
      'Acceso restringido a administración.'
    );
    error.status = 403;
    throw error;
  }
}

function formatDate(value) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

// Recuperar usuarios sin exponer sus contraseñas.
export async function getUsers(user) {
  requireAdmin(user);

  const result = await pool.query(`
    SELECT id, name, email, role, created_on
    FROM users
    ORDER BY created_on, name, id
  `);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created: formatDate(row.created_on)
  }));
}

// Recuperar información para el panel administrativo.
export async function getAdminState(user) {
  requireAdmin(user);

  const [
    educational,
    posts,
    reports,
    users,
    metrics
  ] = await Promise.all([
    loadEducationalContent(),
    getPosts(),
    getReports(user),
    getUsers(user),
    getMetrics()
  ]);

  return {
    ...educational,
    posts,
    reports,
    users,
    metrics
  };
}
