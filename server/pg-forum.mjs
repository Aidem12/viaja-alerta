
import crypto from 'node:crypto';
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

function authorName(data, user) {
  return data?.anonymous || !user
    ? 'Anónimo'
    : user.name;
}

function mapReply(row) {
  return {
    id: row.id,
    author: row.author,
    text: row.body,
    date: row.date
  };
}

// Recuperar el foro con todas sus respuestas
export async function getPosts() {
  const result = await pool.query(`
    SELECT
      p.id,
      p.author,
      p.route,
      p.title,
      p.body,
      TO_CHAR(p.posted_on, 'YYYY-MM-DD') AS date,
      p.created_at,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', r.id,
            'author', r.author,
            'text', r.body,
            'date', TO_CHAR(r.posted_on, 'YYYY-MM-DD')
          )
          ORDER BY r.created_at, r.id
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::json
      ) AS replies
    FROM posts p
    LEFT JOIN replies r ON r.post_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC, p.id DESC
  `);

  return result.rows.map(row => ({
    id: row.id,
    author: row.author,
    route: row.route,
    title: row.title,
    text: row.body,
    date: row.date,
    replies: row.replies
  }));
}

// Crear una publicación
export async function createPost(data, user) {
  if (!data || typeof data !== 'object') {
    fail('Datos inválidos.');
  }

  const post = {
    id: crypto.randomUUID(),
    author: authorName(data, user),
    route: required(data.route, 'ruta', 2, 90),
    title: required(data.title, 'título', 4, 150),
    text: required(data.text, 'publicación', 8, 2000)
  };

  const result = await pool.query(
    `INSERT INTO posts
       (id, author, route, title, body, posted_on)
     VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
     RETURNING TO_CHAR(posted_on, 'YYYY-MM-DD') AS date`,
    [
      post.id,
      post.author,
      post.route,
      post.title,
      post.text
    ]
  );

  return {
    ...post,
    date: result.rows[0].date,
    replies: []
  };
}

// Responder a una publicación
export async function createReply(postId, data, user) {
  if (!data || typeof data !== 'object') {
    fail('Datos inválidos.');
  }

  const text = required(data.text, 'respuesta', 2, 1000);

  const existing = await pool.query(
    'SELECT id FROM posts WHERE id = $1',
    [postId]
  );

  if (existing.rowCount === 0) {
    fail('Publicación no encontrada.', 404);
  }

  const reply = {
    id: crypto.randomUUID(),
    author: authorName(data, user),
    text
  };

  try {
    const result = await pool.query(
      `INSERT INTO replies
         (id, post_id, author, body, posted_on)
       VALUES ($1, $2, $3, $4, CURRENT_DATE)
       RETURNING
         id,
         author,
         body,
         TO_CHAR(posted_on, 'YYYY-MM-DD') AS date`,
      [reply.id, postId, reply.author, reply.text]
    );

    return mapReply(result.rows[0]);
  } catch (error) {
    // Una publicación puede eliminarse entre la consulta
    // de existencia y la inserción de la respuesta.
    if (error.code === '23503') {
      fail('Publicación no encontrada.', 404);
    }

    throw error;
  }
}

// Eliminar una publicación: solo administradores
export async function deletePost(postId, user) {
  if (user?.role !== 'admin') {
    fail('Acceso restringido a administración.', 403);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Bloquear la publicación durante su eliminación.
    const existing = await client.query(
      'SELECT id FROM posts WHERE id = $1 FOR UPDATE',
      [postId]
    );

    if (existing.rowCount === 0) {
      fail('Publicación no encontrada.', 404);
    }

    // Eliminamos primero las respuestas para no depender
    // de que la FK tenga ON DELETE CASCADE.
    await client.query(
      'DELETE FROM replies WHERE post_id = $1',
      [postId]
    );

    await client.query(
      'DELETE FROM posts WHERE id = $1',
      [postId]
    );

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
