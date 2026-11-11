
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('Falta configurar DATABASE_URL.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export async function testConnection() {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT current_database() AS database, version() AS version'
    );

    console.log(
      `[PostgreSQL] Conectado a ${result.rows[0].database}`
    );
  } finally {
    client.release();
  }
}
