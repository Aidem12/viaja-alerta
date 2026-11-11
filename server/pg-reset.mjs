
import crypto from 'node:crypto';
import { pool } from './db.mjs';
import { hashPassword, validEmail } from './pg-auth.mjs';
import { sendPasswordResetEmail } from './pg-mail.mjs';

// ============================================================
// Utilidades
// ============================================================

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function hash(value) {
  return crypto
    .createHash('sha256')
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

// ============================================================
// Solicitar un código de recuperación
// ============================================================

export async function requestReset(email) {
  email = validEmail(email);

  // Verificar configuración del servicio de correo.
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.MAIL_FROM
  ) {
    fail('Servicio de recuperación no disponible.', 503);
  }

  // Consultar la cuenta registrada en Neon.
  const result = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  // Evitar revelar si un correo está registrado.
  if (result.rowCount === 0) {
    return null;
  }

  const userId = result.rows[0].id;

  // Generar un código aleatorio y seguro.
  const code = crypto
    .randomBytes(18)
    .toString('base64url');

  // Únicamente se guarda el hash en PostgreSQL.
  const tokenHash = hash(code);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Coordinar solicitudes simultáneas de recuperación
    // para la misma cuenta.
    await client.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    // Invalidar códigos anteriores.
    await client.query(
      'DELETE FROM password_resets WHERE user_id = $1',
      [userId]
    );

    // Registrar el nuevo código con 15 minutos de validez.
    await client.query(
      `INSERT INTO password_resets
         (token_hash, user_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
      [tokenHash, userId]
    );

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }

  // ==========================================================
  // Enviar el código mediante Resend
  // ==========================================================

  try {
    await sendPasswordResetEmail(email, code);

  } catch (error) {
    // Si falla el envío, invalidar únicamente
    // el código que acabamos de generar.
    try {
      await pool.query(
        'DELETE FROM password_resets WHERE token_hash = $1',
        [tokenHash]
      );
    } catch (cleanupError) {
      console.error(
        '[Recuperación] No se pudo invalidar el código:',
        cleanupError
      );
    }

    console.error(
      '[Correo] Error al enviar recuperación:',
      error
    );

    // Mantener una respuesta indistinguible para correos
    // existentes o inexistentes.
    return null;
  }

  // Nunca devolver el código de recuperación por HTTP.
  return null;
}

// ============================================================
// Cambiar contraseña utilizando un código válido
// ============================================================

export async function resetPassword(email, code, password) {
  email = validEmail(email);
  validatePassword(password);

  if (
    typeof code !== 'string' ||
    code.length < 20
  ) {
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

    // Guardar la nueva contraseña protegida con scrypt.
    await client.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2`,
      [
        hashPassword(password),
        entry.user_id
      ]
    );

    // Invalidar todos los códigos de recuperación.
    await client.query(
      'DELETE FROM password_resets WHERE user_id = $1',
      [entry.user_id]
    );

    // Cerrar las sesiones anteriores por seguridad.
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
