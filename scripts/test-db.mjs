
import { testConnection, pool } from '../server/db.mjs';

try {
  await testConnection();
  console.log('Conexión a Neon verificada correctamente.');
} catch (error) {
  console.error('Error de conexión:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
