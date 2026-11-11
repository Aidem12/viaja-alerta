
import crypto from 'node:crypto';
import { pool } from './db.mjs';

function error(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function hash(value) {
  return crypto.createHash('sha256')
    .update(value)
    .digest('hex');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const encoded = crypto.scryptSync(
    password, salt, 64
  ).toString('hex');

  return `${salt}:${encoded}`;
}

function checkPassword(password, stored) {
  try {
    const [salt, encoded] = stored.split(':');
    const expected = Buffer.from(encoded, 'hex');
    const actual = crypto.scryptSync(
      password, salt, expected.length
    );

    return expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function publicUser(row) {
  const created = row.created_on;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created: created instanceof Date
      ? created.toISOString().slice(0, 10)
      : String(created).slice(0, 10)
  };
}

export function validEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();

  if (
    email.length > 200 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    error('Correo electrónico inválido.');
  }

  return email;
}

async function createSession(client, user) {
  const token = crypto.randomBytes(32)
    .toString('base64url');

  await client.query(
    `INSERT INTO sessions
       (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
    [hash(token), user.id]
  );

  return { token, user: publicUser(user) };
}

export async function register(name, email, password) {
  name = String(name ?? '').trim();
  email = validEmail(email);

  if (name.length < 2 || name.length > 80) {
    error('Nombre inválido.');
  }

  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128
  ) {
    error('La contraseña debe tener entre 8 y 128 caracteres.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO users
        (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'alumno')
       RETURNING *`,
      [
        crypto.randomUUID(),
        name,
        email,
        hashPassword(password)
      ]
    );

    const session = await createSession(
      client, result.rows[0]
    );

    await client.query('COMMIT');
    return session;
  } catch (err) {
    await client.query('ROLLBACK');

    if (err.code === '23505') {
      error('Ya existe una cuenta con ese correo.', 409);
    }

    throw err;
  } finally {
    client.release();
  }
}

export async function login(email, password) {
  email = validEmail(email);

  const result = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );

  const user = result.rows[0];

  if (
    !user ||
    !checkPassword(String(password ?? ''), user.password_hash)
  ) {
    error('Correo o contraseña incorrectos.', 401);
  }

  return createSession(pool, user);
}

function readToken(cookie) {
  return String(cookie ?? '')
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('sid='))
    ?.slice(4);
}

export async function getUser(cookie) {
  const token = readToken(cookie);

  if (!token || !/^[-\w]{40,200}$/.test(token)) {
    return null;
  }

  const result = await pool.query(
    `SELECT u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()`,
    [hash(token)]
  );

  return result.rows[0] ?? null;
}

export async function logout(cookie) {
  const token = readToken(cookie);

  if (!token || !/^[-\w]{40,200}$/.test(token)) {
    return;
  }

  await pool.query(
    'DELETE FROM sessions WHERE token_hash = $1',
    [hash(token)]
  );
}


export async function initializeAdmin() {
  const emailValue = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!emailValue || !password) {
    console.log('[Neon] No hay administrador por inicializar.');
    return;
  }

  const email = validEmail(emailValue);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Evitar inicializaciones simultáneas.
    await client.query(
      'SELECT pg_advisory_xact_lock(20261110)'
    );

    const existing = await client.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (existing.rowCount > 0) {
      await client.query('COMMIT');
      console.log('[Neon] Ya existe un administrador.');
      return;
    }

    if (password.length < 12) {
      error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
    }

    await client.query(
      `INSERT INTO users
        (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')`,
      [
        crypto.randomUUID(),
        'Administración',
        email,
        hashPassword(password)
      ]
    );

    await client.query('COMMIT');
    console.log('[Neon] Administrador inicial creado.');

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
