
import { pool } from '../server/db.mjs';
import { loadEducationalContent } from '../server/pg-state.mjs';
import {
  syncEducationalContent
} from '../server/pg-educational-admin.mjs';

try {
  const adminResult = await pool.query(
    `SELECT id, role FROM users
     WHERE role = 'admin' LIMIT 1`
  );

  const admin = adminResult.rows[0];
  if (!admin) throw new Error('No existe administrador.');

  const before = await loadEducationalContent();

  // Escribir los mismos datos, sin alterar el contenido.
  await syncEducationalContent(admin, before);
  const after = await loadEducationalContent();

  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error('El contenido cambió inesperadamente.');
  }

  console.log('[OK] Sincronización del contenido');

  // Rechazar una situación que referencia un módulo inexistente.
  let invalidRejected = false;
  try {
    await syncEducationalContent(admin, {
      ...before,
      situations: before.situations.map((s, i) =>
        i === 0 ? { ...s, moduleId: 'inexistente' } : s
      )
    });
  } catch (error) {
    invalidRejected = error.status === 400;
  }

  if (!invalidRejected) {
    throw new Error('Se aceptó una relación inválida.');
  }

  console.log('[OK] Relaciones verificadas');

  // Rechazar la eliminación de una situación.
  let removalRejected = false;
  try {
    await syncEducationalContent(admin, {
      ...before,
      situations: before.situations.slice(1)
    });
  } catch (error) {
    removalRejected = error.status === 400;
  }

  if (!removalRejected) {
    throw new Error('Se permitió eliminar una situación.');
  }

  console.log('[OK] Protección contra eliminaciones');

  // Rechazar modificaciones de un alumno.
  let forbidden = false;
  try {
    await syncEducationalContent(
      { role: 'alumno' }, before
    );
  } catch (error) {
    forbidden = error.status === 403;
  }

  if (!forbidden) {
    throw new Error('Un alumno pudo modificar contenido.');
  }

  console.log('[OK] Permisos administrativos');
  console.log('[Neon] Contenido educativo verificado.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
