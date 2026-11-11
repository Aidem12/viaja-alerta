
import { pool } from './db.mjs';

export async function loadEducationalContent() {
  const [
    siteResult,
    modulesResult,
    situationsResult,
    optionsResult,
    tipsResult
  ] = await Promise.all([
    pool.query('SELECT * FROM site_settings WHERE id = 1'),
    pool.query('SELECT * FROM modules ORDER BY id'),
    pool.query('SELECT * FROM situations ORDER BY id'),
    pool.query(
      `SELECT * FROM situation_options
       ORDER BY situation_id, option_index`
    ),
    pool.query('SELECT * FROM tips ORDER BY id')
  ]);

  const siteRow = siteResult.rows[0];

  if (!siteRow) {
    throw new Error(
      'No se encontró la configuración inicial en Neon.'
    );
  }

  const site = {
    heroTitle: siteRow.hero_title,
    heroText: siteRow.hero_text
  };

  const modules = modulesResult.rows.map(m => ({
    id: m.id,
    tag: m.tag,
    title: m.title,
    desc: m.description
  }));

  const situations = situationsResult.rows.map(s => ({
    id: s.id,
    moduleId: s.module_id,
    where: s.location,
    img: s.image_url,
    q: s.question,
    opts: optionsResult.rows
      .filter(o => o.situation_id === s.id)
      .map(o => ({
        text: o.option_text,
        good: o.is_correct,
        consequence: o.consequence,
        feedback: o.feedback
      }))
  }));

  const tips = tipsResult.rows.map(t => ({
    id: t.id,
    moment: t.moment,
    title: t.title,
    text: t.body,
    img: t.image_url
  }));

  return { site, modules, situations, tips };
}
