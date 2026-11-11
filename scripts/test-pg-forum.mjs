
import { pool } from '../server/db.mjs';
import {
  getPosts,
  createPost,
  createReply,
  deletePost
} from '../server/pg-forum.mjs';

let postId = null;

try {
  const initialPosts = await getPosts();

  console.log(
    '[OK] Publicaciones recuperadas:',
    initialPosts.length
  );

  // Publicación temporal anónima
  const post = await createPost({
    anonymous: true,
    route: 'Ruta de prueba',
    title: 'Publicación de prueba',
    text: 'Contenido temporal para verificar el foro.'
  }, null);

  postId = post.id;

  if (post.author !== 'Anónimo') {
    throw new Error('Error al crear publicación anónima.');
  }

  console.log('[OK] Publicación creada');

  // Agregar respuesta
  const reply = await createReply(postId, {
    anonymous: true,
    text: 'Respuesta temporal de prueba.'
  }, null);

  if (!reply.id || reply.author !== 'Anónimo') {
    throw new Error('La respuesta no se creó correctamente.');
  }

  console.log('[OK] Respuesta creada');

  // Recuperar publicación y respuesta
  const posts = await getPosts();
  const saved = posts.find(item => item.id === postId);

  if (
    !saved ||
    saved.replies.length !== 1 ||
    saved.replies[0].id !== reply.id
  ) {
    throw new Error('No se recuperó la respuesta.');
  }

  console.log('[OK] Publicación y respuesta recuperadas');

  // Verificar que un alumno no puede eliminarla
  let forbidden = false;

  try {
    await deletePost(postId, {
      id: 'test',
      role: 'alumno'
    });
  } catch (error) {
    forbidden = error.status === 403;
  }

  if (!forbidden) {
    throw new Error('Se permitió eliminar sin ser administrador.');
  }

  console.log('[OK] Permisos de administrador');

  // Utilizar la cuenta de administrador que ya creamos
  const adminResult = await pool.query(
    "SELECT id, name, role FROM users WHERE role = 'admin' LIMIT 1"
  );

  if (adminResult.rowCount === 0) {
    throw new Error('No se encontró el administrador de prueba.');
  }

  await deletePost(postId, adminResult.rows[0]);
  postId = null;

  console.log('[OK] Publicación eliminada');

  const finalPosts = await getPosts();

  if (finalPosts.length !== initialPosts.length) {
    throw new Error('El número de publicaciones no coincide.');
  }

  console.log('[OK] Publicaciones originales conservadas');
  console.log('[Neon] Pruebas del foro completadas.');

} catch (error) {
  console.error('[Neon] Error:', error.message);
  process.exitCode = 1;

} finally {
  // Limpieza adicional si la prueba se interrumpió.
  if (postId) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

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
      console.error('[Neon] Error de limpieza:', error.message);
      process.exitCode = 1;
    } finally {
      client.release();
    }
  }

  await pool.end();
}
