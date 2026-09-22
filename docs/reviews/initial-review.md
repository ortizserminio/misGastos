# Revisión independiente — misGastos

Fecha: 22-09-2026. Estado: revisión de contrato completada; código e integración pendientes.

## Contrato

Se revisaron `docs/contract.md`, `docs/implementation-plan.md` y `../docs/miesencial-referencia-funcional.md`.

La prioridad es recibir importe, comercio y banco mediante POST autenticado; banco explícito o asociación exacta tarjeta/banco. El contrato distingue correctamente la prueba local del funcionamiento desde iPhone. No promete App Intent nativo, ejecución bloqueada ni publicación.

La entrega es un subconjunto del catálogo original. Deben permanecer visibles los módulos pendientes y la ausencia de paridad completa. Sin repostajes ni datos personales de referencia.

## Comprobaciones de implementación pendientes

- Autenticación de cada endpoint salvo health; token no aparece en logs, URL, copia ni caché.
- Escucha loopback y rechazo de Origin no local; cuerpo limitado y errores controlados.
- Dinero en céntimos, coma/punto, fechas válidas, textos acotados y banco desconocido rechazado.
- Evento repetido idéntico devuelve la misma transacción; carga distinta produce 409; persistencia tras reinicio.
- Reintentos con fecha omitida y cambios de mapping no producen duplicación silenciosa.
- Web fusiona por id/externalId preservando manuales; conexión comprobada con petición autenticada.
- Informes calculados separan gastos e ingresos; copia validada e ida y vuelta.
- Formulario, demo y simulador etiquetados; ninguna acción declara envío o iPhone probado.
- Tests API, tests web, build e integración navegador contra API real.

No se ha declarado aprobación del código ni integración. Esta revisión no prueba iOS ni disponibilidad HTTPS.

## Backend — revisión de código y ejecución independiente

Se inspeccionó `apps/api/server.mjs` completo. `node --test apps/api/*.test.mjs`: 6 pruebas, 6 pasan, 0 fallos. `node docs/reviews/api-independent.mjs`: PASS. Esta prueba adicional verifica fecha omitida, reintento tras eliminar la asociación, rechazo de nueva tarjeta desconocida, conflicto de carga y ausencia de token en listado. Crea datos sintéticos en temporal y los elimina al cerrar.

No se encontraron defectos bloqueantes en el backend revisado. SQLite emite el aviso experimental de Node; no es fallo de prueba. Frontend y navegador siguen pendientes.
