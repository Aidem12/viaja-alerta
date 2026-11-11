
import { pool } from '../server/db.mjs';
import {
  createReport,
  getReports,
  publishReport,
  deleteReport,
  reportsCsv
} from '../server/pg-reports.mjs';

import { getPosts } from '../server/pg-forum.mjs';

let reportId = null;
let postId = null;

try {
  // Usuario administrativo de prueba, solo para
  // comprobar las funciones de este módulo.
  const admin = { role: 'admin' };
  const alumno = { role: 'alumno' };

  // Crear reporte temporal.
  const created = await createReport({
    route: 'Ruta de prueba',
    time: '18:30',
    tactic: 'Distracción',
    story: 'Reporte temporal para comprobar PostgreSQL.'
  });

  reportId = created.id;
  console.log('[OK] Reporte creado');

  // Verificar que se guardó.
  const reports = await getReports(admin);
  const saved = reports.find(r => r.id === reportId);

  if (!saved || saved.status !== 'nuevo') {
    throw new Error('No se recuperó el reporte.');
  }

  console.log('[OK] Reporte recuperado');

  // Bloquear acceso de alumnos.
  let forbidden = false;

  try {
    await getReports(alumno);
  } catch (error) {
    forbidden = error.status === 403;
  }

  if (!forbidden) {
    throw new Error('Un alumno pudo consultar reportes.');
  }

  console.log('[OK] Permisos de consulta');

  // Rechazar evidencias sin almacenamiento persistente.
  let evidenceRejected = false;

  try {
    await createReport({
      route: 'Ruta de prueba',
      time: '18:30',
      tactic: 'Distracción',
      story: 'Intento de adjunto temporal.',
      evidence: { name: 'archivo.png', data: 'AAAA' }
    });
  } catch (error) {
    evidenceRejected = error.status === 400;
  }

  if (!evidenceRejected) {
    throw new Error('Se aceptó un archivo adjunto.');
  }

  console.log('[OK] Evidencia temporal rechazada');

  // Exportación CSV.
  const csv = await reportsCsv(admin);

  if (!csv.includes('Ruta de prueba')) {
    throw new Error('El reporte no aparece en CSV.');
  }

  console.log('[OK] Exportación CSV');

  // Publicar reporte.
  const published = await publishReport(
    admin,
    reportId,
    'Resumen público de prueba para verificar la publicación.'
  );

  postId = published.postId;

  const posts = await getPosts();

  if (!posts.some(p => p.id === postId)) {
    throw new Error('No apareció la publicación en el foro.');
  }

  console.log('[OK] Reporte publicado en el foro');

  // Evitar publicación duplicada.
  let duplicateRejected = false;

  try {
    await publishReport(
      admin,
      reportId,
      'Otro resumen público de prueba suficientemente largo.'
    );
  } catch (error) {
    duplicateRejected = error.status === 409;
  }

  if (!duplicateRejected) {
    throw new Error('Se permitió publicar dos veces.');
  }

  console.log('[OK] Publicación duplicada rechazada');

  // Eliminar reporte.
  await deleteReport(admin, reportId);
  reportId = null;

  console.log('[OK] Reporte eliminado');
  console.log('[Neon] Pruebas de reportes completadas.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;

} finally {
  // Limpiar únicamente los registros de esta prueba.
  try {
    if (reportId) {
      await pool.query(
        'DELETE FROM reports WHERE id = $1',
        [reportId]
      );
    }

    if (postId) {
      await pool.query(
        'DELETE FROM replies WHERE post_id = $1',
        [postId]
      );
      await pool.query(
        'DELETE FROM posts WHERE id = $1',
        [postId]
      );
    }
  } catch (error) {
    console.error('[Neon] Error de limpieza:', error.message);
    process.exitCode = 1;
  }

  await pool.end();
}
