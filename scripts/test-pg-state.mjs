
import { loadEducationalContent } from '../server/pg-state.mjs';
import { pool } from '../server/db.mjs';

try {
  const content = await loadEducationalContent();

  console.log('[Neon] Lectura correcta.');

  console.table({
    modules: content.modules.length,
    situations: content.situations.length,
    options: content.situations.reduce(
      (total, situation) => total + situation.opts.length,
      0
    ),
    tips: content.tips.length
  });

  console.log(
    'Título de la plataforma:',
    content.site.heroTitle
  );

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
