
import { pool } from '../server/db.mjs';
import { loadEducationalContent } from '../server/pg-state.mjs';
import { updateSiteSettings } from '../server/pg-admin-actions.mjs';

try {
  const result = await pool.query(
    "SELECT id, role FROM users WHERE role = 'admin' LIMIT 1"
  );

  const admin = result.rows[0];

  if (!admin) {
    throw new Error('No existe un administrador.');
  }

  const before = await loadEducationalContent();

  // Guardamos exactamente los mismos valores.
  const updated = await updateSiteSettings(
    admin,
    before.site
  );

  const after = await loadEducationalContent();

  if (
    updated.heroTitle !== before.site.heroTitle ||
    after.site.heroText !== before.site.heroText
  ) {
    throw new Error('La configuración no coincide.');
  }

  console.log('[OK] Configuración actualizada');
  console.log('[OK] Contenido original conservado');

  let rejected = false;

  try {
    await updateSiteSettings(
      { role: 'alumno' },
      before.site
    );
  } catch (error) {
    rejected = error.status === 403;
  }

  if (!rejected) {
    throw new Error('No se respetaron los permisos.');
  }

  console.log('[OK] Permisos verificados');
  console.log('[Neon] Configuración administrativa verificada.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
