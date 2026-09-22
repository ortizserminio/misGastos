# Receptor misGastos — informe de implementación

Fecha: 2026-09-22. Área modificada exclusivamente `misGastos/apps/api/`.

## Entrega

- `server.mjs`: receptor HTTP Node 24 sin dependencias externas, SQLite persistente, arranque CLI únicamente en `127.0.0.1` (8787 por defecto).
- `api.test.mjs`: ocho pruebas de comportamiento; HTTP real contra puertos efímeros, datos sintéticos y SQLite temporal; limpieza al terminar.
- `.gitignore`: excluye `/data/` (token, DB y archivos auxiliares SQLite).
- Token de 32 bytes generado una vez en `apps/api/data/token.txt`, sin exponerlo en logs ni endpoints. Base `apps/api/data/misgastos.sqlite`. `MISGASTOS_DATA_DIR` sustituye el directorio; `MISGASTOS_PORT` sustituye el puerto.
- Autenticación Bearer con comparación de tiempo constante para longitud válida; Host/Origin limitados a loopback; sin CORS abierto. Cuerpos JSON limitados a 16 KiB, tipo de contenido obligatorio, errores estructurados sin detalles de datos privados.
- Importe positivo hasta 999999,99 EUR, céntimos exactos; validación de campos, fechas y asociaciones. Banco explícito prevalece. Nunca se infiere banco por marca de tarjeta.
- Idempotencia persistente y transaccional: entrada normalizada separada de transacción derivada. La misma entrada conserva la transacción original tras editar mappings o reintentar al día siguiente cuando se omitió fecha. Cambiar la carga para el mismo idEvento devuelve 409.
- Listado por fecha descendente, con desempate por inserción descendente. Mappings reemplazados atómicamente.

## Evidencia red/green

1. Antes de escribir implementación se ejecutó `node --test apps/api/*.test.mjs` desde `misGastos`: **6 fallos / 0 correctas**, aserciones de capacidad ausente (`parseAmount` y `createApp` no implementadas). El import opcional permite que el fallo sea una aserción explícita, no un error de carga del módulo.
2. Tras implementar: mismo comando, **6 correctas / 0 fallos**, código de salida 0.
3. Añadidas comprobaciones de reintento al día siguiente y privacidad de errores sobre el comportamiento ya implementado: mismo comando, **8 correctas / 0 fallos**, código de salida 0 (363,78 ms).

Runtime: Node v24.14.1. Node emite aviso `ExperimentalWarning: SQLite is an experimental feature and might change at any time`; no se oculta.

Pruebas cubren autenticación, Host/Origin adversos, importes ambiguos, fechas imposibles, campos desconocidos, JSON inválido, Content-Type incorrecto, límite de cuerpo, tarjeta desconocida, preferencia de banco explícito, reemplazo atómico, persistencia tras reapertura, reintentos concurrentes, conflictos, cambios de mapping y fecha omitida.

## Límites

No publicación ni llamadas a Apple/bancos. No se ha instalado o probado un atajo en iPhone; loopback no es accesible desde el teléfono. No integración nativa Apple ni App Intent. Los tests prueban el protocolo HTTP local.

Permisos de creación POSIX solicitados 0700 para directorio y 0600 para token; en Windows se heredan ACL del usuario/directorio y no se afirma aislamiento adicional mediante esos bits. Datos locales no cifrados. El directorio alternativo definido mediante `MISGASTOS_DATA_DIR` debe mantenerse fuera del repositorio.

Pendiente del coordinador/supervisor: integración de navegador y revisión independiente. Este informe no las da por superadas.
