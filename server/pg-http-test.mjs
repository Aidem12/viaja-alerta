
import http from 'node:http';
import { publicState } from './pg-core.mjs';
import { getUser, login } from './pg-auth.mjs';
import { pool } from './db.mjs';

const PORT = 3101;

function send(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let body = '';

  for await (const chunk of req) {
    body += chunk.toString();

    if (body.length > 16000) {
      const error = new Error('Solicitud demasiado grande.');
      error.status = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body || '{}');
  } catch {
    const error = new Error('JSON inválido.');
    error.status = 400;
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(
      req.url,
      `http://localhost:${PORT}`
    );

    if (req.method === 'GET' && url.pathname === '/api/health') {
      await pool.query('SELECT 1');

      return send(res, 200, {
        ok: true,
        database: 'connected'
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      const user = await getUser(req.headers.cookie);
      const state = await publicState(user);

      return send(res, 200, state);
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readJson(req);
      const session = await login(body.email, body.password);

      return send(res, 200, {
        ok: true,
        user: session.user
      }, {
        'Set-Cookie':
          `sid=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
      });
    }

    return send(res, 404, {
      error: 'Ruta no encontrada.'
    });

  } catch (error) {
    const status = [400, 401, 403, 413].includes(error.status)
      ? error.status
      : 500;

    console.error('[API prueba]', error.message);

    return send(res, status, {
      error: status === 500
        ? 'Error interno del servidor.'
        : error.message
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `[Neon] API de prueba: http://127.0.0.1:${PORT}`
  );
});
