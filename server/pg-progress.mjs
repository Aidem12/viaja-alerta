
import { pool } from './db.mjs';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

// Recuperar el progreso de un alumno
export async function getProgress(user) {
  if (!user?.id) {
    return {};
  }

  const result = await pool.query(
    `SELECT situation_id, is_correct
     FROM user_progress
     WHERE user_id = $1`,
    [user.id]
  );

  return Object.fromEntries(
    result.rows.map(row => [
      row.situation_id,
      row.is_correct
    ])
  );
}

// Guardar una respuesta del cuestionario
export async function choose(user, situationId, choiceIndex) {
  if (!user?.id) {
    fail('Inicia sesión para guardar tu progreso.', 401);
  }

  if (
    typeof situationId !== 'string' ||
    situationId.length > 70 ||
    !Number.isInteger(choiceIndex) ||
    choiceIndex < 0
  ) {
    fail('Opción inválida.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const situation = await client.query(
      'SELECT id FROM situations WHERE id = $1',
      [situationId]
    );

    if (situation.rowCount === 0) {
      fail('Situación no encontrada.', 404);
    }

    const option = await client.query(
      `SELECT is_correct
       FROM situation_options
       WHERE situation_id = $1
         AND option_index = $2`,
      [situationId, choiceIndex]
    );

    if (option.rowCount === 0) {
      fail('Opción inválida.');
    }

    const correct = option.rows[0].is_correct;

    await client.query(
      `INSERT INTO user_progress (
         user_id, situation_id, is_correct
       )
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, situation_id)
       DO UPDATE SET
         is_correct = EXCLUDED.is_correct,
         updated_at = NOW()`,
      [user.id, situationId, correct]
    );

    // Conservar la métrica de respuestas del sistema original
    await client.query(
      `UPDATE counters
       SET answers = answers + 1
       WHERE id = 1`
    );

    await client.query('COMMIT');

    return correct;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Eliminar el progreso de un alumno
export async function resetProgress(user) {
  if (!user?.id) {
    fail('Inicia sesión para borrar el progreso.', 401);
  }

  await pool.query(
    'DELETE FROM user_progress WHERE user_id = $1',
    [user.id]
  );
}
