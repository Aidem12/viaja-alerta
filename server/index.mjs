
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool } from './db.mjs';
import * as auth from './pg-auth.mjs';
import * as reset from './pg-reset.mjs';
import * as progress from './pg-progress.mjs';
import * as forum from './pg-forum.mjs';
import * as reports from './pg-reports.mjs';
import * as metrics from './pg-metrics.mjs';

import { publicState } from './pg-core.mjs';
import { adminSync } from './pg-admin-sync.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..');

const PORT = Number(
  process.env.API_PORT || process.env.PORT || 3001
);

const rateCounters = new Map();

function throttle(req, key, limit, windowMs = 60_000) {
  const client = req.socket.remoteAddress || 'local';
  const id = `${key}:${client}`;
  const time = Date.now();

  const previous = rateCounters.get(id);

  const hit = previous && previous.until > time
    ? previous
    : { until: time + windowMs, count: 0 };

  hit.count++;
  rateCounters.set(id, hit);

  if (hit.count > limit) {
    const error = new Error(
      'Demasiados intentos. Vuelve a probar más tarde.'
    );
    error.status = 429;
    throw error;
  }

  if (rateCounters.size > 3000) {
    for (const [key, value] of rateCounters) {
      if (value.until < time) {
        rateCounters.delete(key);
      }
    }
  }
}

function allowedOrigins() {
  return [
    process.env.APP_ORIGIN,
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ].filter(Boolean);
}

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });

  res.end(JSON.stringify(data));
}

async function readBody(req, limit = 9_000_000) {
  const parts = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > limit) {
      const error = new Error('Solicitud demasiado grande.');
      error.status = 413;
      throw error;
    }

    parts.push(chunk);
  }

  try {
    const text = Buffer.concat(parts).toString('utf8');
    return text ? JSON.parse(text) : {};
  } catch {
    const error = new Error('JSON inválido.');
    error.status = 400;
    throw error;
  }
}

function sessionCookie(token, clear = false) {
  const maxAge = clear ? 0 : 60 * 60 * 24 * 7;
  const secure = process.env.SECURE_COOKIES === '1'
    ? '; Secure'
    : '';

  return [
    `sid=${clear ? '' : token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`
  ].join('; ') + secure;
}

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function requireAdmin(user) {
  if (user?.role !== 'admin') {
    httpError(
      'Acceso restringido a administración.',
      403
    );
  }
}

async function route(req, res) {
  const origin = req.headers.origin;

  // Protección básica contra solicitudes desde
  // orígenes no autorizados.
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    origin
  ) {
    let sameHost = false;

    try {
      sameHost = new URL(origin).host === req.headers.host;
    } catch {
      // Origen inválido.
    }

    if (!sameHost && !allowedOrigins().includes(origin)) {
      httpError('Origen no autorizado.', 403);
    }
  }

  const url = new URL(
    req.url || '/',
    `http://localhost:${PORT}`
  );

  const key = `${req.method} ${url.pathname}`;

  // Estado del servidor y conexión PostgreSQL.
  if (key === 'GET /api/health') {
    await pool.query('SELECT 1');

    return send(res, 200, {
      ok: true,
      service: 'viaja-alerta',
      database: 'connected',
      time: new Date().toISOString()
    });
  }

  const user = url.pathname.startsWith('/api/')
    ? await auth.getUser(req.headers.cookie)
    : null;

  // --------------------------------------------------------
  // Estado de la plataforma
  // --------------------------------------------------------

  if (key === 'GET /api/state') {
    return send(res, 200, await publicState(user));
  }

  // --------------------------------------------------------
  // Autenticación
  // --------------------------------------------------------

  if (key === 'POST /api/auth/register') {
    throttle(req, 'register', 10);

    const body = await readBody(req);
    const session = await auth.register(
      body.name,
      body.email,
      body.password
    );

    return send(
      res,
      201,
      { ok: true, user: session.user },
      { 'Set-Cookie': sessionCookie(session.token) }
    );
  }

  if (key === 'POST /api/auth/login') {
    throttle(req, 'login', 25);

    const body = await readBody(req);
    const session = await auth.login(
      body.email,
      body.password
    );

    return send(
      res,
      200,
      { ok: true, user: session.user },
      { 'Set-Cookie': sessionCookie(session.token) }
    );
  }

  if (key === 'POST /api/auth/logout') {
    await auth.logout(req.headers.cookie);

    return send(
      res,
      200,
      { ok: true },
      { 'Set-Cookie': sessionCookie('', true) }
    );
  }

  if (key === 'POST /api/auth/request-reset') {
    throttle(req, 'reset', 6, 15 * 60_000);

    const body = await readBody(req);
    const devCode = await reset.requestReset(body.email);

    return send(res, 200, {
      ok: true,
      message: 'Si existe la cuenta, se ha generado un código de recuperación.',
      ...(devCode ? { devCode } : {})
    });
  }

  if (key === 'POST /api/auth/reset') {
    const body = await readBody(req);

    await reset.resetPassword(
      body.email,
      body.code,
      body.password
    );

    return send(res, 200, { ok: true });
  }

  // --------------------------------------------------------
  // Progreso educativo
  // --------------------------------------------------------

  if (key === 'POST /api/progress/answer') {
    const body = await readBody(req);

    const correct = await progress.choose(
      user,
      body.situationId,
      body.choiceIndex
    );

    return send(res, 200, { correct });
  }

  if (key === 'POST /api/progress/reset') {
    await progress.resetProgress(user);
    return send(res, 200, { ok: true });
  }

  // --------------------------------------------------------
  // Reportes
  // --------------------------------------------------------

  if (key === 'POST /api/reports') {
    throttle(req, 'reports', 8, 60 * 60_000);

    const body = await readBody(req);
    const created = await reports.createReport(body);

    return send(res, 201, created);
  }

  // --------------------------------------------------------
  // Foro
  // --------------------------------------------------------

  if (key === 'POST /api/posts') {
    throttle(req, 'posts', 15, 60 * 60_000);

    const body = await readBody(req);
    const post = await forum.createPost(body, user);

    return send(res, 201, post);
  }

  const replyMatch = url.pathname.match(
    /^\/api\/posts\/([-\w]+)\/replies$/
  );

  if (req.method === 'POST' && replyMatch) {
    const body = await readBody(req);

    const reply = await forum.createReply(
      replyMatch[1],
      body,
      user
    );

    return send(res, 201, reply);
  }

  const postMatch = url.pathname.match(
    /^\/api\/posts\/([-\w]+)$/
  );

  if (req.method === 'DELETE' && postMatch) {
    requireAdmin(user);
    await forum.deletePost(postMatch[1], user);

    return send(res, 200, { ok: true });
  }

  // --------------------------------------------------------
  // Administración
  // --------------------------------------------------------

  if (key === 'POST /api/admin/state') {
    requireAdmin(user);

    const body = await readBody(req);
    const updated = await adminSync(user, body);

    return send(res, 200, updated);
  }

  const publishMatch = url.pathname.match(
    /^\/api\/admin\/reports\/([-\w]+)\/publish$/
  );

  if (req.method === 'POST' && publishMatch) {
    requireAdmin(user);

    const body = await readBody(req);

    const published = await reports.publishReport(
      user,
      publishMatch[1],
      body.summary
    );

    return send(res, 201, published);
  }

  const reportMatch = url.pathname.match(
    /^\/api\/admin\/reports\/([-\w]+)$/
  );

  if (req.method === 'DELETE' && reportMatch) {
    requireAdmin(user);

    await reports.deleteReport(
      user,
      reportMatch[1]
    );

    return send(res, 200, { ok: true });
  }

  if (key === 'GET /api/admin/reports.csv') {
    requireAdmin(user);

    const csv = await reports.reportsCsv(user);

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="reportes-viaja-alerta.csv"',
      'Cache-Control': 'no-store'
    });

    return res.end(csv);
  }

  // --------------------------------------------------------
  // Estadísticas
  // --------------------------------------------------------

  if (key === 'POST /api/metrics/view') {
    const body = await readBody(req);

    await metrics.viewPage(body.page);

    return send(res, 200, { ok: true });
  }

  // --------------------------------------------------------
  // Evidencias: pendientes de almacenamiento externo
  // --------------------------------------------------------

  if (
    req.method === 'GET' &&
    /^\/api\/evidence\/[-\w]+$/.test(url.pathname)
  ) {
    requireAdmin(user);

    return send(res, 404, {
      error: 'Evidencia no disponible.'
    });
  }

  // --------------------------------------------------------
  // API inexistente
  // --------------------------------------------------------

  if (url.pathname.startsWith('/api/')) {
    return send(res, 404, {
      error: 'Ruta de API no encontrada.'
    });
  }

  // --------------------------------------------------------
  // Archivos estáticos del frontend
  // --------------------------------------------------------

  if (!['GET', 'HEAD'].includes(req.method)) {
    return send(res, 405, {
      error: 'Método no permitido.'
    });
  }

  let requested;

  try {
    requested = decodeURIComponent(url.pathname);
  } catch {
    httpError('Ruta inválida.', 400);
  }

  const dist = path.join(root, 'dist');
  let filename = path.resolve(dist, '.' + requested);

  if (
    !filename.startsWith(dist + path.sep) &&
    filename !== dist
  ) {
    httpError('Ruta inválida.', 403);
  }

  try {
    if (!fs.statSync(filename).isFile()) {
      filename = path.join(dist, 'index.html');
    }
  } catch {
    filename = path.join(dist, 'index.html');
  }

  if (!fs.existsSync(filename)) {
    return send(res, 404, {
      error: 'Compila primero el frontend con npm run build.'
    });
  }

  const ext = path.extname(filename);

  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2'
  }[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': mime,
    'X-Content-Type-Options': 'nosniff'
  });

  if (req.method === 'HEAD') {
    return res.end();
  }

  return fs.createReadStream(filename).pipe(res);
}

export const server = http.createServer((req, res) => {
  route(req, res).catch(error => {
    if (res.headersSent) {
      res.destroy();
      return;
    }

    const status = Number.isInteger(error.status) &&
      error.status >= 400 &&
      error.status < 500
      ? error.status
      : 500;

    console.error('[API]', error.message);

    send(res, status, {
      error: status === 500
        ? 'Error interno del servidor.'
        : error.message
    });
  });
});

// Inicializar PostgreSQL antes de aceptar solicitudes.
if (process.env.NODE_ENV !== 'test') {
  try {
    await pool.query('SELECT 1');
    await auth.initializeAdmin();

    server.listen(PORT, () => {
      console.log(
        `[Viaja Alerta] PostgreSQL conectado`
      );
      console.log(
        `[Viaja Alerta] http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      '[Inicio] No se pudo conectar a PostgreSQL:',
      error.message
    );

    await pool.end();
    process.exitCode = 1;
  }
}
