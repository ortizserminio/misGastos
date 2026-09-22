# misGastos — registro

## 22-09-2026

- Usuario autoriza nueva app misGastos, sin repostajes; prioridad importe/comercio/banco en Atajos.
- Contrato y plan escritos antes de implementación. Proyecto aislado en carpeta nueva, sin editar PracticaMatch. No se crea tarea de Codex nueva: el usuario ha pedido un proyecto.
- Ruling: PWA personal y receptor Node/SQLite separados — permitir captura HTTP desde Atajos sin fingir App Intent nativo — requiere futuro receptor HTTPS para iPhone automático.
- Ruling: banco explícito o asociación tarjeta/banco exacta — Cartera no está comprobada como fuente de campo banco — tarjeta desconocida se rechaza en lugar de inventar institución.
- Agentes backend, frontend y supervisor con áreas de escritura exclusivas; coordinador posee scripts y documentación.
- Verificación de implementación pendiente. No hay publicación ni prueba iPhone.

## Continuación tras límite de agentes

- Los tres agentes alcanzaron límite de uso. Backend dejó implementación, ocho pruebas y reporte; supervisor revisó API y ejecutó comprobación independiente. Frontend dejó dominio, pruebas, modal y atajo, pero faltaban App, estilos y paneles; el coordinador completó esas áreas. Ya no existen escritores concurrentes.
- Ruling: primera persistencia web mediante localStorage versionado y copias validadas — reduce infraestructura de esta entrega pequeña — IndexedDB del diseño original queda pendiente antes de añadir tickets o grandes importaciones. La UI no afirma almacenamiento ilimitado.
- Errores de síntaxis/tipado detectados por build y corregidos; no se consideró completa la app antes de compilar.
- Pruebas iniciales coordinador: API 8/8; web 6/6; build correcto. Navegador: gasto manual 12,50 € guardado y reflejado; receptor aislado puerto 8790 y web 5175 con credencial sintética para integración. Asociación Tarjeta sintética 4321 → Banco violeta de prueba; gasto 17,89 € recibido, repetido sin duplicación, banco visible y persistido tras recarga.
- Revisión independiente de frontend e integración **pendiente por límite del supervisor**; no se sustituye por un aprobado ficticio. Coordinador continúa comprobaciones.

## Verificación final del coordinador

- `node --test apps/api/*.test.mjs`: **8/8**, cero fallos. Advertencia de Node: `node:sqlite` experimental.
- `node docs/reviews/api-independent.mjs`: **PASS**, fecha omitida, asociación eliminada tras primer registro, tarjeta desconocida, conflicto y ausencia de token en respuestas.
- `npm.cmd test` en apps/web: **7/7**, dos archivos. Incluye creación/edición/persistencia, apertura de atajo, precisión de céntimos, separación ingresos/gastos, restauración y deduplicación. Caso categoría `constructor` primero falló; corregido agrupando en un objeto sin prototipo y repetido en verde.
- `npm.cmd run build` en apps/web: TypeScript y Vite correctos; JS 263,82 kB (82,51 kB gzip), CSS 16,05 kB. Service worker generado incluye los dos recursos compilados para uso offline y excluye `/api`.
- Navegador real: formulario de tres pasos, 12,50 € guardados, resumen actualizado. Pantalla de receptor autenticada contra API real en fixture aislada: tarjeta sintética asociada a banco, 17,89 € recibidos, reenvío mismo evento muestra duplicado sin nueva fila, recarga conserva banco y cantidad. Informes calculan el total y el calendario. Vista 390×844 inspeccionada.
- PWA compilada servida temporalmente en 5176; tras precarga y recarga se detuvo el servidor y se confirmó por petición HTTP que no respondía. El navegador volvió a cargar la aplicación y sus cinco movimientos DEMO desde caché. No equivale a verificación Safari/iPhone.
- Se retiró del origen principal 5174 el único movimiento sintético creado allí. Las pruebas del receptor quedaron en `test-results/browser-*`, ignorado por Git; receptor principal sin transacciones de prueba. Servidores de prueba detenidos. App principal disponible en http://127.0.0.1:5174 y API en 8787.
- El intento de consultar procesos por Get-NetTCPConnection/Get-CimInstance fue denegado por permisos; se detuvo la preview mediante su sesión de ejecución, sin escalación.

## Qué queda pendiente

- Elegir y desplegar receptor HTTPS accesible al iPhone; configuración del atajo en el dispositivo y comprobación de campos/ejecución bloqueada. Banco está implementado como campo explícito o asociación exacta de Tarjeta o pase, no como propiedad nativa bancaria inventada.
- Archivo `.shortcut` firmado/App Intent nativo no creados. Guía y plantilla JSON disponibles, receptor real verificado localmente.
- Paridad completa del catálogo: deudas, recurrentes, objetivos, patrimonio, viajes, importador CSV/Excel, hogar, IA/voz/OCR y configuraciones avanzadas. Presupuesto inicial es total mensual, no por categoría; informes no incluyen todas las vistas de referencia.
- Migración de localStorage a IndexedDB para grandes conjuntos/adjuntos y copia unificada del receptor. Edición web de un movimiento sincronizado es local; no modifica el registro original en API.
- Revisión independiente final de frontend/integración no completada debido al límite de uso de los agentes. Sí existen las verificaciones del coordinador indicadas arriba.

## Reverificación al continuar — 22-09-2026

- API: `node --test apps/api/*.test.mjs` — **8/8 pruebas superadas**.
- Frontend: `npm.cmd test` — **7/7 pruebas superadas** en 2 archivos.
- Producción: `npm.cmd run build` — compilación Vite superada; service worker generado con precache de la PWA.
- La vista de `http://127.0.0.1:5174/` sigue abierta para probar el flujo manual en el navegador.
- El alcance pendiente no cambia: para usar el atajo desde un iPhone fuera del ordenador hace falta publicar el receptor HTTPS; la paridad completa con mi€sencial y la revisión independiente del frontend siguen fuera de esta iteración.
