
import { pool } from './db.mjs';

// Secciones válidas de Viaja Alerta
const validPages = new Set([
  'inicio',
  'problema',
  'datos',
  'recomendaciones',
  'foro',
  'modulos',
  'progreso',
  'reportar',
  'cuenta',
  'admin'
]);

// Registrar una visita
export async function viewPage(page) {
  if (typeof page !== 'string' || !validPages.has(page)) {
    return;
  }

  await pool.query(
    `INSERT INTO page_views (page, views)
     VALUES ($1, 1)
     ON CONFLICT (page)
     DO UPDATE SET views = page_views.views + 1`,
    [page]
  );
}

// Recuperar las estadísticas generales
export async function getMetrics() {
  const [viewsResult, countersResult] = await Promise.all([
    pool.query(
      'SELECT page, views FROM page_views ORDER BY page'
    ),
    pool.query(
      'SELECT answers, reports FROM counters WHERE id = 1'
    )
  ]);

  const views = {};

  for (const row of viewsResult.rows) {
    views[row.page] = Number(row.views);
  }

  const counters = countersResult.rows[0];

  if (!counters) {
    throw new Error(
      'No se encontró el registro de contadores en Neon.'
    );
  }

  return {
    views,
    answers: Number(counters.answers),
    reports: Number(counters.reports)
  };
}
