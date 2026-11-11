
import { pool } from './db.mjs';

// ============================================================
// Utilidades de validación
// ============================================================

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
  if (value == null) {
    return '';
  }

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

// ============================================================
// Sincronización del contenido educativo
//
// Sin externalClient:
//   Administra su propia transacción.
//
// Con externalClient:
//   Participa en una transacción externa.
//   La función llamadora controla COMMIT y ROLLBACK.
// ============================================================

export async function syncEducationalContent(
  admin,
  payload,
  externalClient = null
) {
  // ----------------------------------------------------------
  // 1. Validar permisos y entrada
  // ----------------------------------------------------------

  if (admin?.role !== 'admin') {
    fail('Acceso restringido a administración.', 403);
  }

  if (!payload || typeof payload !== 'object') {
    fail('Datos inválidos.');
  }

  // ----------------------------------------------------------
  // 2. Validar configuración general
  // ----------------------------------------------------------

  const site = {
    heroTitle: required(
      payload.site?.heroTitle,
      'título',
      1,
      220
    ),
    heroText: required(
      payload.site?.heroText,
      'descripción',
      1,
      1000
    )
  };

  // ----------------------------------------------------------
  // 3. Validar módulos
  // ----------------------------------------------------------

  const modules = validList(
    payload.modules,
    'módulos',
    40
  ).map(m => ({
    id: required(m?.id, 'id', 1, 70),
    tag: required(m?.tag, 'etiqueta', 1, 70),
    title: required(m?.title, 'título', 1, 140),
    desc: required(m?.desc, 'descripción', 1, 500)
  }));

  // ----------------------------------------------------------
  // 4. Validar situaciones y opciones
  // ----------------------------------------------------------

  const situations = validList(
    payload.situations,
    'situaciones',
    150
  ).map(s => ({
    id: required(s?.id, 'id', 1, 70),
    moduleId: required(
      s?.moduleId,
      'módulo',
      1,
      70
    ),
    where: required(
      s?.where,
      'lugar',
      1,
      150
    ),
    img: optional(
      s?.img,
      'imagen',
      2000
    ),
    q: required(
      s?.q,
      'pregunta',
      1,
      700
    ),

    opts: validList(
      s?.opts,
      'opciones',
      8
    ).map(o => ({
      text: required(
        o?.text,
        'opción',
        1,
        600
      ),
      good: o?.good === true,
      consequence: required(
        o?.consequence,
        'consecuencia',
        1,
        2000
      ),
      feedback: required(
        o?.feedback,
        'retroalimentación',
        1,
        2000
      )
    }))
  }));

  // ----------------------------------------------------------
  // 5. Validar recomendaciones
  // ----------------------------------------------------------

  const tips = validList(
    payload.tips,
    'recomendaciones',
    100
  ).map(t => ({
    id: required(t?.id, 'id', 1, 70),
    moment: required(
      t?.moment,
      'momento',
      1,
      100
    ),
    title: required(
      t?.title,
      'título',
      1,
      150
    ),
    text: required(
      t?.text,
      'texto',
      1,
      1000
    ),
    img: optional(
      t?.img,
      'imagen',
      2000
    )
  }));

  // ----------------------------------------------------------
  // 6. Validar identificadores y relaciones
  // ----------------------------------------------------------

  uniqueIds(modules, 'módulos');
  uniqueIds(situations, 'situaciones');
  uniqueIds(tips, 'recomendaciones');

  const moduleIds = new Set(
    modules.map(m => m.id)
  );

  if (
    situations.some(
      s => !moduleIds.has(s.moduleId)
    )
  ) {
    fail(
      'Situaciones con módulos inexistentes.'
    );
  }

  // ----------------------------------------------------------
  // 7. Preparar transacción PostgreSQL
  // ----------------------------------------------------------

  const ownsTransaction = externalClient === null;

  const client = externalClient ?? await pool.connect();

  try {
    if (ownsTransaction) {
      await client.query('BEGIN');
    }

    // Serializar las sincronizaciones administrativas.
    // Si hay una transacción externa, esta debe estar
    // iniciada antes de llamar a esta función.
    await client.query(
      'SELECT pg_advisory_xact_lock(20261111)'
    );

    // --------------------------------------------------------
    // 8. Consultar registros existentes
    //
    // Las consultas son secuenciales para evitar ejecutar
    // varias operaciones simultáneas sobre el mismo client.
    // --------------------------------------------------------

    const existing = [
      await client.query(
        'SELECT id FROM modules'
      ),

      await client.query(
        'SELECT id FROM situations'
      ),

      await client.query(
        'SELECT id FROM tips'
      ),

      await client.query(
        `SELECT situation_id, option_index
         FROM situation_options`
      )
    ];

    // --------------------------------------------------------
    // 9. Verificar que no se eliminen registros existentes
    // --------------------------------------------------------

    const suppliedModules = new Set(
      modules.map(m => m.id)
    );

    const suppliedSituations = new Map(
      situations.map(s => [s.id, s])
    );

    const suppliedTips = new Set(
      tips.map(t => t.id)
    );

    // Proteger módulos.
    if (
      existing[0].rows.some(
        row => !suppliedModules.has(row.id)
      )
    ) {
      fail(
        'No se permite eliminar módulos existentes.'
      );
    }

    // Proteger situaciones.
    if (
      existing[1].rows.some(
        row => !suppliedSituations.has(row.id)
      )
    ) {
      fail(
        'No se permite eliminar situaciones existentes.'
      );
    }

    // Proteger recomendaciones.
    if (
      existing[2].rows.some(
        row => !suppliedTips.has(row.id)
      )
    ) {
      fail(
        'No se permite eliminar recomendaciones existentes.'
      );
    }

    // Proteger opciones de cuestionarios.
    if (
      existing[3].rows.some(row => {
        const situation = suppliedSituations.get(
          row.situation_id
        );

        return (
          !situation ||
          row.option_index >= situation.opts.length
        );
      })
    ) {
      fail(
        'No se permite eliminar opciones existentes.'
      );
    }

    // --------------------------------------------------------
    // 10. Actualizar configuración general
    // --------------------------------------------------------

    await client.query(
      `INSERT INTO site_settings (
         id,
         hero_title,
         hero_text
       )
       VALUES (1, $1, $2)
       ON CONFLICT (id)
       DO UPDATE SET
         hero_title = EXCLUDED.hero_title,
         hero_text = EXCLUDED.hero_text`,
      [
        site.heroTitle,
        site.heroText
      ]
    );

    // --------------------------------------------------------
    // 11. Crear o actualizar módulos
    // --------------------------------------------------------

    for (const module of modules) {
      await client.query(
        `INSERT INTO modules (
           id,
           tag,
           title,
           description
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id)
         DO UPDATE SET
           tag = EXCLUDED.tag,
           title = EXCLUDED.title,
           description = EXCLUDED.description`,
        [
          module.id,
          module.tag,
          module.title,
          module.desc
        ]
      );
    }

    // --------------------------------------------------------
    // 12. Crear o actualizar situaciones y opciones
    // --------------------------------------------------------

    for (const situation of situations) {
      await client.query(
        `INSERT INTO situations (
           id,
           module_id,
           location,
           image_url,
           question
         )
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id)
         DO UPDATE SET
           module_id = EXCLUDED.module_id,
           location = EXCLUDED.location,
           image_url = EXCLUDED.image_url,
           question = EXCLUDED.question`,
        [
          situation.id,
          situation.moduleId,
          situation.where,
          situation.img,
          situation.q
        ]
      );

      for (
        const [index, option] of situation.opts.entries()
      ) {
        await client.query(
          `INSERT INTO situation_options (
             situation_id,
             option_index,
             option_text,
             is_correct,
             consequence,
             feedback
           )
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (
             situation_id,
             option_index
           )
           DO UPDATE SET
             option_text = EXCLUDED.option_text,
             is_correct = EXCLUDED.is_correct,
             consequence = EXCLUDED.consequence,
             feedback = EXCLUDED.feedback`,
          [
            situation.id,
            index,
            option.text,
            option.good,
            option.consequence,
            option.feedback
          ]
        );
      }
    }

    // --------------------------------------------------------
    // 13. Crear o actualizar recomendaciones
    // --------------------------------------------------------

    for (const tip of tips) {
      await client.query(
        `INSERT INTO tips (
           id,
           moment,
           title,
           body,
           image_url
         )
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id)
         DO UPDATE SET
           moment = EXCLUDED.moment,
           title = EXCLUDED.title,
           body = EXCLUDED.body,
           image_url = EXCLUDED.image_url`,
        [
          tip.id,
          tip.moment,
          tip.title,
          tip.text,
          tip.img
        ]
      );
    }

    // --------------------------------------------------------
    // 14. Confirmar cambios
    // --------------------------------------------------------

    if (ownsTransaction) {
      await client.query('COMMIT');
    }

    return {
      site,
      modules,
      situations,
      tips
    };

  } catch (error) {
    // --------------------------------------------------------
    // 15. Revertir cambios ante errores
    // --------------------------------------------------------

    if (ownsTransaction) {
      await client.query('ROLLBACK');
    }

    throw error;

  } finally {
    // --------------------------------------------------------
    // 16. Liberar conexión si pertenece a esta función
    // --------------------------------------------------------

    if (ownsTransaction) {
      client.release();
    }
  }
}
