
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../server/db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const seed = JSON.parse(
  await fs.readFile(
    path.join(here, '../server/seed.json'),
    'utf8'
  )
);

const added = {
  modules: 0,
  situations: 0,
  options: 0,
  tips: 0,
  posts: 0,
  replies: 0
};

let client;

async function insert(sql, params, key) {
  const result = await client.query(sql, params);
  added[key] += result.rowCount;
}

try {
  client = await pool.connect();

  await client.query('BEGIN');

  // 1. Configuración principal de la plataforma
  await client.query(
    `INSERT INTO site_settings (id, hero_title, hero_text)
     VALUES (1, $1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [seed.site.heroTitle, seed.site.heroText]
  );

  // 2. Módulos educativos
  for (const m of seed.modules) {
    await insert(
      `INSERT INTO modules (id, tag, title, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [m.id, m.tag, m.title, m.desc],
      'modules'
    );
  }

  // 3. Situaciones y opciones del cuestionario
  for (const s of seed.situations) {
    await insert(
      `INSERT INTO situations (
         id, module_id, location, image_url, question
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [
        s.id,
        s.moduleId,
        s.where,
        s.img || '',
        s.q
      ],
      'situations'
    );

    for (const [index, option] of s.opts.entries()) {
      await insert(
        `INSERT INTO situation_options (
           situation_id,
           option_index,
           option_text,
           is_correct,
           consequence,
           feedback
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (situation_id, option_index)
         DO NOTHING`,
        [
          s.id,
          index,
          option.text,
          option.good === true,
          option.consequence,
          option.feedback
        ],
        'options'
      );
    }
  }

  // 4. Recomendaciones
  for (const t of seed.tips) {
    await insert(
      `INSERT INTO tips (
         id, moment, title, body, image_url
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [
        t.id,
        t.moment,
        t.title,
        t.text,
        t.img || ''
      ],
      'tips'
    );
  }

  // 5. Publicaciones del foro
  for (const p of seed.posts) {
    await insert(
      `INSERT INTO posts (
         id, author, route, title, body, posted_on
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id,
        p.author,
        p.route,
        p.title,
        p.text,
        p.date
      ],
      'posts'
    );

    // 6. Respuestas de cada publicación
    for (const r of p.replies || []) {
      await insert(
        `INSERT INTO replies (
           id, post_id, author, body, posted_on
         )
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          p.id,
          r.author,
          r.text,
          r.date
        ],
        'replies'
      );
    }
  }

  // Confirmar todos los cambios
  await client.query('COMMIT');

  console.log(
    '[Neon] Datos iniciales importados correctamente.'
  );

  console.table(added);

} catch (error) {
  // Revertir toda la operación si ocurre un error
  if (client) {
    await client.query('ROLLBACK');
  }

  console.error(
    '[Neon] Error durante la importación:',
    error.message
  );

  process.exitCode = 1;

} finally {
  if (client) {
    client.release();
  }

  await pool.end();
}
