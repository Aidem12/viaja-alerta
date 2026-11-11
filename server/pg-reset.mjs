
import crypto from 'node:crypto';
import { pool } from './db.mjs';
import { hashPassword, validEmail } from './pg-auth.mjs';

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function hash(value) {
  return crypto.createHash('sha256')
    .update(value)
    .digest('hex');
}

function validatePassword(password) {
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128
  ) {
    fail('La contraseña debe tener entre 8 y 128 caracteres.');
  }
}

// Solicitar un código de recuperación
export async function requestReset(email) {
  email = validEmail(email);

  const result = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  // No revelar si el correo existe.
  if (result.rowCount === 0) {
    return null;
  }

  const userId = result.rows[0].id;
  const code = crypto.randomBytes(18).toString('base64url');

  await pool.query(
    `INSERT INTO password_resets
       (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
    [hash(code), userId]
  );

  // Solo para pruebas de desarrollo.
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_SHOW_RESET_CODE === '1'
  ) {
    return code;
  }

  return null;
}

// Cambiar la contraseña utilizando un código válido
export async function resetPassword(email, code, password) {
  email = validEmail(email);
  validatePassword(password);

  if (typeof code !== 'string' || code.length < 20) {
    fail('Código de recuperación inválido.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT pr.user_id, pr.expires_at
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token_hash = $1
         AND u.email = $2
       FOR UPDATE OF pr`,
      [hash(code), email]
    );

    const entry = result.rows[0];

    if (
      !entry ||
      new Date(entry.expires_at).getTime() <= Date.now()
    ) {
      fail('Código inválido o vencido.');
    }

    await client.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2`,
      [hashPassword(password), entry.user_id]
    );

    // Invalidar todos los códigos del usuario.
    await client.query(
      'DELETE FROM password_resets WHERE user_id = $1',
      [entry.user_id]
    );

    // Cerrar todas las sesiones anteriores.
    await client.query(
      'DELETE FROM sessions WHERE user_id = $1',
      [entry.user_id]
    );

    await client.query('COMMIT');

    return { ok: true };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
