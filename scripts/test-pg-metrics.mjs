
import { pool } from '../server/db.mjs';
import {
  viewPage,
  getMetrics
} from '../server/pg-metrics.mjs';

try {
  const before = await getMetrics();

  console.log('[OK] Estadísticas recuperadas');

  const previousViews = before.views.inicio ?? 0;

  // Registrar una visita válida
  await viewPage('inicio');

  const after = await getMetrics();

  if (after.views.inicio !== previousViews + 1) {
    throw new Error(
      'No se incrementó el contador de visitas.'
    );
  }

  console.log('[OK] Visita registrada');

  // Verificar que las páginas inválidas se ignoren
  await viewPage('pagina-inexistente');

  const invalid = await pool.query(
    `SELECT 1 FROM page_views
     WHERE page = $1`,
    ['pagina-inexistente']
  );

  if (invalid.rowCount !== 0) {
    throw new Error(
      'Se registró una página no permitida.'
    );
  }

  console.log('[OK] Validación de páginas');

  if (
    !Number.isFinite(after.answers) ||
    !Number.isFinite(after.reports)
  ) {
    throw new Error(
      'Los contadores generales son inválidos.'
    );
  }

  console.log('[OK] Contadores generales recuperados');
  console.log('[Neon] Pruebas de estadísticas completadas.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;

} finally {
  await pool.end();
}
