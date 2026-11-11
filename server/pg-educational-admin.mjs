
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

function optional(value, name, max) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) {
    fail(`Campo inválido: ${name}`);
  }
  return value.trim();
}

function validList(value, name, max) {
  if (!Array.isArray(value) || value.length > max) {
    fail(`Lista inválida: ${name}`);
  }
  return value;
}

function uniqueIds(items, name) {
  const ids = items.map(item => item.id);
  if (new Set(ids).size !== ids.length) {
    fail(`Identificadores duplicados: ${name}`);
  }
}

export async function syncEducationalContent(admin, payload) {
  if (admin?.role !== 'admin') {
    fail('Acceso restringido a administración.', 403);
  }

  if (!payload || typeof payload !== 'object') {
    fail('Datos inválidos.');
  }

  const site = {
    heroTitle: required(
      payload.site?.heroTitle, 'título', 1, 220
    ),
    heroText: required(
      payload.site?.heroText, 'descripción', 1, 1000
    )
  };

  const modules = validList(
    payload.modules, 'módulos', 40
  ).map(m => ({
    id: required(m?.id, 'id', 1, 70),
    tag: required(m?.tag, 'etiqueta', 1, 70),
    title: required(m?.title, 'título', 1, 140),
    desc: required(m?.desc, 'descripción', 1, 500)
  }));

  const situations = validList(
    payload.situations, 'situaciones', 150
  ).map(s => ({
    id: required(s?.id, 'id', 1, 70),
    moduleId: required(s?.moduleId, 'módulo', 1, 70),
    where: required(s?.where, 'lugar', 1, 150),
    img: optional(s?.img, 'imagen', 2000),
    q: required(s?.q, 'pregunta', 1, 700),
    opts: validList(s?.opts, 'opciones', 8).map(o => ({
      text: required(o?.text, 'opción', 1, 600),
      good: o?.good === true,
      consequence: required(
        o?.consequence, 'consecuencia', 1, 2000
      ),
      feedback: required(
        o?.feedback, 'retroalimentación', 1, 2000
      )
    }))
  }));

  const tips = validList(
    payload.tips, 'recomendaciones', 100
  ).map(t => ({
    id: required(t?.id, 'id', 1, 70),
    moment: required(t?.moment, 'momento', 1, 100),
    title: required(t?.title, 'título', 1, 150),
    text: required(t?.text, 'texto', 1, 1000),
    img: optional(t?.img, 'imagen', 2000)
  }));

  uniqueIds(modules, 'módulos');
  uniqueIds(situations, 'situaciones');
  uniqueIds(tips, 'recomendaciones');

  const moduleIds = new Set(modules.map(m => m.id));

  if (situations.some(s => !moduleIds.has(s.moduleId))) {
    fail('Situaciones con módulos inexistentes.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Serializar las sincronizaciones administrativas.
    await client.query(
      'SELECT pg_advisory_xact_lock(20261111)'
    );

    // Impedir eliminaciones accidentales.

    const existing = [
        await client.query('SELECT id FROM modules'),
        await client.query('SELECT id FROM situations'),
        await client.query('SELECT id FROM tips'),
        await client.query(
    `SELECT situation_id, option_index
     FROM situation_options`
  )
];


    const suppliedModules = new Set(modules.map(m => m.id));
    const suppliedSituations = new Map(
      situations.map(s => [s.id, s])
    );
    const suppliedTips = new Set(tips.map(t => t.id));

    if (existing[0].rows.some(r => !suppliedModules.has(r.id))) {
      fail('No se permite eliminar módulos existentes.');
    }

    if (existing[1].rows.some(
      r => !suppliedSituations.has(r.id)
    )) {
      fail('No se permite eliminar situaciones existentes.');
    }

    if (existing[2].rows.some(r => !suppliedTips.has(r.id))) {
      fail('No se permite eliminar recomendaciones existentes.');
    }

    if (existing[3].rows.some(r => {
      const situation = suppliedSituations.get(r.situation_id);
      return !situation ||
        r.option_index >= situation.opts.length;
    })) {
      fail('No se permite eliminar opciones existentes.');
    }

    // Configuración general.
    await client.query(
      `INSERT INTO site_settings
         (id, hero_title, hero_text)
       VALUES (1, $1, $2)
       ON CONFLICT (id)
       DO UPDATE SET
         hero_title = EXCLUDED.hero_title,
         hero_text = EXCLUDED.hero_text`,
      [site.heroTitle, site.heroText]
    );

    // Módulos.
    for (const m of modules) {
      await client.query(
        `INSERT INTO modules
           (id, tag, title, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id)
         DO UPDATE SET
           tag = EXCLUDED.tag,
           title = EXCLUDED.title,
           description = EXCLUDED.description`,
        [m.id, m.tag, m.title, m.desc]
      );
    }

    // Situaciones y opciones.
    for (const s of situations) {
      await client.query(
        `INSERT INTO situations
           (id, module_id, location, image_url, question)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id)
         DO UPDATE SET
           module_id = EXCLUDED.module_id,
           location = EXCLUDED.location,
           image_url = EXCLUDED.image_url,
           question = EXCLUDED.question`,
        [s.id, s.moduleId, s.where, s.img, s.q]
      );

      for (const [index, o] of s.opts.entries()) {
        await client.query(
          `INSERT INTO situation_options
             (situation_id, option_index, option_text,
              is_correct, consequence, feedback)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (situation_id, option_index)
           DO UPDATE SET
             option_text = EXCLUDED.option_text,
             is_correct = EXCLUDED.is_correct,
             consequence = EXCLUDED.consequence,
             feedback = EXCLUDED.feedback`,
          [
            s.id, index, o.text, o.good,
            o.consequence, o.feedback
          ]
        );
      }
    }

    // Recomendaciones.
    for (const t of tips) {
      await client.query(
        `INSERT INTO tips
           (id, moment, title, body, image_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id)
         DO UPDATE SET
           moment = EXCLUDED.moment,
           title = EXCLUDED.title,
           body = EXCLUDED.body,
           image_url = EXCLUDED.image_url`,
        [t.id, t.moment, t.title, t.text, t.img]
      );
    }

    await client.query('COMMIT');

    return { site, modules, situations, tips };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
