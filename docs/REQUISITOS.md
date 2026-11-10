# Trazabilidad del diagrama de casos de uso

## Estudiante (BUAP)

- **Consultar recomendaciones de seguridad:** `#recomendaciones`, filtros por momento (antes, dentro, al bajar, después de robo).
- **Acceder a módulos interactivos/simulaciones:** `#modulos`; 4 grupos: reporte ágil, resguardo vulnerable, distracción por audífonos, tapón o empujones.
- **Reportar nuevo modus operandi (anónimo):** `#reportar`; se acepta sin cuenta. Requiere relato, táctica, ruta y horario.
- **Añadir evidencia multimedia («extend»):** imagen PNG/JPEG/WEBP o video MP4 de hasta 5 MB; opcional y privada para administración.

## Administrador (equipo de proyecto)

- **Gestionar usuarios y roles:** sección `#admin` > Usuarios. Autenticación real y permisos del servidor.
- **Validar y publicar reportes de modus operandi:** sección Reportes con revisión y eliminación. En esta versión, los reportes revisados **no se publican automáticamente** en el foro; el administrador selecciona qué compartir para evitar exposición de testimonios y archivos.
- **Actualizar contenido educativo y recomendaciones:** secciones Módulos, Situaciones, Recomendaciones y Contenido.
- **Generar reportes y métricas de uso:** sección Métricas; descarga CSV para análisis.
- **Mantenimiento:** administración, contenidos y moderación; el despliegue y backup siguen siendo tareas operativas.

## Adicionales del prototipo Figma

- Inicio de sesión, registro, recuperación por token de desarrollo, progreso por estudiante y comunidad/foro.

## Limitaciones explícitas

- Sin integración institucional BUAP, envío de correo, integración con autoridad, geolocalización o almacenamiento SQL.
- La verificación final del frontend requiere ejecutar `npm install` y `npm run build` en una máquina con acceso al registro npm.
