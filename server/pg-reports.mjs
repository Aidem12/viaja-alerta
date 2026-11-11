
import crypto from 'node:crypto';
import { pool } from './db.mjs';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function required(value, name, min, max) {
  if (typeof value !== 'string') {
    fail(`Campo inválido: ${name}`);
  }

  const text = value.trim();

  if (text.length < min || text.length > max) {
    fail(`Campo inválido: ${name}`);
  }

  return text;
}

function requireAdmin(user) {
  if (user?.role !== 'admin') {
    fail('Acceso restringido a administración.', 403);
  }
}

function validateId(value) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    fail('Identificador de reporte inválido.');
  }
  return value;
}

const reportColumns = `
  id, route, reported_time, tactic, story,
  TO_CHAR(reported_on, 'YYYY-MM-DD') AS date,
  status, evidence,
  TO_CHAR(
    published_at AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ) AS published_at,
  public_post_id
`;

function mapReport(row) {
  return {
    id: row.id,
    route: row.route,
    time: row.reported_time,
    tactic: row.tactic,
    story: row.story,
    date: row.date,
    status: row.status,
    evidence: row.evidence,
    ...(row.published_at
      ? { publishedAt: row.published_at }
      : {}),
    ...(row.public_post_id
      ? { publicPostId: row.public_post_id }
      : {})
  };
}

// Recuperar reportes: solo administración.
export async function getReports(user) {
  requireAdmin(user);

  const result = await pool.query(`
    SELECT ${reportColumns}
    FROM reports
    ORDER BY created_at DESC, id DESC
  `);

  return result.rows.map(mapReport);
}

// Crear un reporte sin evidencia multimedia.
export async function createReport(data) {
  if (!data || typeof data !== 'object') {
    fail('Datos inválidos.');
  }

  if (data.evidence != null) {
    fail(
      'Los archivos adjuntos aún no están disponibles. Envía el reporte sin evidencia.',
      400
    );
  }

  const report = {
    id: crypto.randomUUID(),
    route: required(data.route, 'ruta', 2, 120),
    time: required(data.time, 'horario', 2, 100),
    tactic: required(data.tactic, 'táctica', 2, 120),
    story: required(data.story, 'relato', 8, 2000)
  };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO reports (
         id, route, reported_time, tactic, story
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [
        report.id,
        report.route,
        report.time,
        report.tactic,
        report.story
      ]
    );

    await client.query(
      `UPDATE counters
       SET reports = reports + 1
       WHERE id = 1`
    );

    await client.query('COMMIT');

    return { id: report.id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Publicar un reporte revisado en el foro.
export async function publishReport(user, reportId, summary) {
  requireAdmin(user);
  validateId(reportId);

  summary = required(
    summary,
    'resumen público',
    20,
    1000
  );

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT id, route, tactic, published_at
       FROM reports
       WHERE id = $1
       FOR UPDATE`,
      [reportId]
    );

    const report = result.rows[0];

    if (!report) {
      fail('Reporte no encontrado.', 404);
    }

    if (report.published_at) {
      fail('Este reporte ya está publicado.', 409);
    }

    const postId = crypto.randomUUID();

    await client.query(
      `INSERT INTO posts (
         id, author, route, title, body, posted_on
       )
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)`,
      [
        postId,
        'Equipo de revisión',
        report.route,
        `Alerta preventiva · ${report.tactic}`,
        summary
      ]
    );

    await client.query(
      `UPDATE reports
       SET status = 'revisado',
           published_at = NOW(),
           public_post_id = $1
       WHERE id = $2`,
      [postId, reportId]
    );

    await client.query('COMMIT');

    return { postId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Eliminar un reporte.
// Conserva cualquier publicación que ya se haya creado.
export async function deleteReport(user, reportId) {
  requireAdmin(user);
  validateId(reportId);

  const result = await pool.query(
    'DELETE FROM reports WHERE id = $1 RETURNING id',
    [reportId]
  );

  if (result.rowCount === 0) {
    fail('Reporte no encontrado.', 404);
  }
}

// Exportar reportes a CSV.
export async function reportsCsv(user) {
  const reports = await getReports(user);

  const headers = [
    'Ruta',
    'Horario',
    'Táctica',
    'Relato',
    'Fecha',
    'Estado',
    'Evidencia'
  ];

  const quote = value => {
    const text = String(value ?? '')
      .replace(/^[=+@-]/, "'")
      .replace(/"/g, '""');

    return `"${text}"`;
  };

  const rows = reports.map(report => [
    report.route,
    report.time,
    report.tactic,
    report.story,
    report.date,
    report.status,
    report.evidence?.name ?? ''
  ]);

  return '\uFEFF' +
    [headers, ...rows]
      .map(row => row.map(quote).join(','))
      .join('\r\n');
}
