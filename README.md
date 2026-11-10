# Viaja Alerta — Plataforma web de autoprotección universitaria

Proyecto web funcional basado en el prototipo **Figma Make** contenido en `Pagina.rar` y en el diagrama de casos de uso de la Plataforma Web Autoprotección Universitaria (BUAP). Conserva la composición visual, estilos, imágenes y pantallas del prototipo y añade servidor, persistencia y control de acceso.

## Tecnologías

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4, HTML y CSS responsivo.
- **Backend:** Node.js 22+ y API HTTP JSON (sin dependencias de servidor externas).
- **Persistencia:** archivo JSON transaccional por reemplazo atómico, bajo `server/data/db.json`, y evidencias en `server/data/evidence/`.
- **Autenticación:** cookies `HttpOnly; SameSite=Lax`, claves derivadas con `scrypt`, autorización por rol en el servidor, recuperación por token de un solo uso (modo de desarrollo).

> **Estado:** prototipo funcional para desarrollo, prácticas y evaluación. No es una implementación institucional ni un sistema listo para manejar denuncias reales a gran escala. Antes de producción hacen falta auditoría de seguridad, política de datos, moderación, respaldo y base de datos transaccional multiusuario.

## Inicio rápido

Necesitas **Node.js >= 22.12** y npm.

```bash
npm install
npm run dev
```

- Abre **http://localhost:5173** (cliente Vite).
- La API se ejecuta en **http://localhost:3001**.
- Para comprobarla: http://localhost:3001/api/health.

En Windows (PowerShell), macOS y Linux funcionan los mismos comandos. No hace falta ejecutar la aplicación dentro de Figma Make.

### Crear administrador inicial

El servidor inicia sin credenciales administrativas públicas. Si necesitas probar el panel:

1. Copia `.env.example` a `.env`.
2. Cambia `ADMIN_EMAIL` y `ADMIN_PASSWORD` por valores tuyos. La contraseña debe tener **12 o más caracteres**.
3. Arranca de nuevo con `npm run dev`. Si no existía un administrador, el servidor creará la cuenta.
4. Entra por **Cuenta** con esas credenciales; aparecerá la sección **Administración**.
5. Después del primer arranque, puedes quitar `ADMIN_PASSWORD` del `.env` (el hash queda registrado en la base).

`.env` y los datos privados están excluidos del repositorio mediante `.gitignore`.

### Recuperación de contraseña

El modo de desarrollo genera códigos temporales (15 minutos) y los muestra **solo en la terminal del backend**. Opcionalmente, establece `DEV_SHOW_RESET_CODE=1` en `.env` para mostrarlos en la interfaz **solo en desarrollo local**. **No hay envío automático de correo**: antes de utilizar recuperación en producción se requiere integrar un proveedor de correo verificado.

## Funcionalidades

| Actor | Función | Implementación |
|---|---|---|
| Estudiante o visitante | Consultar recomendaciones | Sección con filtros por momento del viaje |
| Estudiante o visitante | Acceder a módulos / simulaciones | Cuatro módulos temáticos y 9 situaciones con retroalimentación |
| Estudiante registrado | Guardar progreso | Respuestas evaluadas en el servidor y vinculadas a su cuenta |
| Visitante | Reportar modus operandi anónimamente | Formulario público, persistido, con ruta, horario y táctica |
| Visitante | Añadir evidencia multimedia | PNG, JPG, WEBP o MP4 de hasta 5 MB, acceso restringido al equipo administrador |
| Comunidad | Publicar alertas y responder | Foro con filtros de ruta y moderación |
| Administrador | Gestionar usuarios y roles | Restricciones de rol aplicadas en la API |
| Administrador | Validar reportes | Marcado como revisado, eliminación y descarga CSV |
| Administrador | Actualizar contenido educativo | Edición de portada, recomendaciones, módulos y situaciones |
| Administrador | Métricas de uso | Visitas por sección, respuestas, reportes totales y pendientes |
| Administrador | Mantenimiento | CRUD de contenido y moderación; no sustituye backups institucionales |

**Simulaciones contempladas:** Reporte ágil, Resguardo vulnerable, Distracción por audífonos y Tapón o empujones. Se reutilizaron los nueve escenarios educativos del prototipo, agrupados según el diagrama.

## Desarrollo y pruebas

```bash
npm run test:api   # pruebas de API (no requieren instalar dependencias)
npm run build      # comprueba tipos y genera dist/
npm run start      # sirve frontend compilado y API, puerto 3001
```

`npm run start` presupone que `dist/` existe; primero ejecuta `npm run build`.

## Estructura

```text
src/                  React, pantallas, simulaciones y estilos originales adaptados
server/index.mjs      HTTP API, autorización de recursos y servidor estático
server/core.mjs       Negocio, autenticación, permisos y persistencia
server/seed.json      Datos educativos iniciales, sin cuentas demo
server/tests/         Pruebas de endpoints y roles
server/data/          Datos y evidencias privadas (se crea al ejecutar; no se distribuye)
scripts/              Arranque unificado de frontend y backend
docs/                 Diagrama original y trazabilidad de requisitos
referencia/           Archivo RAR original de Figma, solo para consulta
```

## Seguridad y límites del prototipo

- **No se publican correos ni contraseñas en el frontend**. El backend devuelve solo datos necesarios para cada rol.
- La información de reportes y sus evidencias únicamente es visible para administración. No adjuntes imágenes sensibles o rostros reconocibles sin autorización.
- Los reportes son orientativos, **no sustituyen una denuncia formal ni un servicio de emergencia**.
- Los datos estadísticos de la página vienen del prototipo original. No se han verificado de forma independiente; deben contrastarse y citarse antes de la publicación institucional.
- El almacenamiento JSON es apropiado para prueba local o demostración con pocos usuarios. Para producción se recomienda **PostgreSQL**, migraciones, backups, almacenamiento de archivos externo y límites de solicitudes por usuario.
- Las fotografías de fondo provienen de URLs externas indicadas en el prototipo. Revisa licencias y disponibilidad antes de publicar.
- No se envían correos reales en el flujo de recuperación. El token se emite por terminal **solo para desarrollo**.

## Origen y atribuciones

Los componentes y los materiales visuales se adaptaron de `Pagina.rar`, conservado sin alteraciones en `referencia/`. El diagrama aportado está en `docs/diagrama-casos-de-uso.png`. Este proyecto no afirma afiliación institucional oficial con la BUAP.
