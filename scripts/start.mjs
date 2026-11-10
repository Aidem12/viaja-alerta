try {process.loadEnvFile('.env')} catch { /* variables aportadas por la plataforma */ }
process.env.NODE_ENV='production'
await import('../server/index.mjs')
