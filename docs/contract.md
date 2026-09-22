# misGastos — contrato de implementación

Autorizado 22-09-2026: proyecto nuevo React + TypeScript; diseño morado basado en ../.. /docs/miesencial-referencia-funcional.md. Sin repostajes. Prioridad: atajo con importe, comercio y banco.

Proyecto independiente en misGastos/. No modificar PracticaMatch. Backend apps/api, frontend apps/web, coordinador docs/scripts raíz, supervisor docs/reviews. No trabajadores delegando.

## Entrega inicial
PWA personal usable: Gastos, listado, alta gasto/ingreso tres pasos, informes calculados, presupuestos locales, ajustes/cuentas, exportación/restauración, guía y simulador de atajo. Sin datos personales iniciales; demo explícita y marcada. Chat será asistente por reglas y no IA simulada. Áreas adicionales pendientes identificadas.

## Datos web
Transaction {id:string,type:'expense'|'income',amountCents:number,merchant:string,bank:string,category:string,date:'YYYY-MM-DD',source:'manual'|'shortcut'|'demo',externalId?:string}. Gastos positivos internamente. Cuenta manual identificada por nombre; efectivo valor 'Efectivo'. Totales en céntimos, ingresos separados. Categorías Alimentación, Transporte, Ocio, Hogar, Salud, Compras, Restauración, Suscripciones, Otros; ingresos Nómina, Venta, Otros. Persistencia local versionada; exportación/restauración valida campos. Ninguna clave en URLs.

## Receptor Node (sin dependencias)
Node 24, node:sqlite; servidor loopback 127.0.0.1:8787. CLI `node apps/api/server.mjs`; datos privados en apps/api/data ignorados. Token aleatorio 32 bytes generado una vez en archivo privado; no imprimirlo en logs. Leerlo manualmente para configurar app/atajo. Servir solo API, frontend Vite proxy /api a 8787. Variables MISGASTOS_PORT, MISGASTOS_DATA_DIR opcionales.

GET /api/health sin autenticación devuelve {ok:true,service:'misGastos'}.
Todos los demás endpoints Bearer token; Origin no local rechazado; límite body 16KB; no CORS abierto; comparar token de forma segura.
POST /api/shortcut body {importe:string|number,comercio:string,banco?:string,tarjeta?:string,fecha?:'YYYY-MM-DD',idEvento:string}. Importe EUR positivo máximo 999999.99, coma o punto decimal, sin ambiguos miles ni decimales extra. Requerir comercio no vacío y banco o tarjeta conocida. idEvento estable UUID o texto opaco 8..128 para reintentos. Devuelve 201 {transaction:Transaction,duplicate:false}; reintento igual 200 duplicate:true; misma clave distinta carga 409. Banco explícito o asociación exacta tarjeta→banco, desconocida 422. No inferir banco por marca Visa/Mastercard. Categoría inicial Otros. Fuente shortcut.
GET /api/transactions → {items:Transaction[]} orden descendente. No borrado remoto desde UI en entrega inicial.
GET /api/card-mappings → {items:[{tarjeta:string,banco:string}]}.
PUT /api/card-mappings body {items:[{tarjeta,banco}]} reemplazo validado atómico. Máx 100.
Errores {error:string,message:string}. Fechas válidas, cadenas acotadas, sin confiar en cliente. GET listado no devuelve tokens.

## Interfaz del atajo
Pantalla Ajustes > Atajo Apple Pay: estado real desconectado/conectado/última sincronización; token password opcional recordado solo durante sesión por defecto; API same-origin /api. Editor mappings. Prueba sintética explícita POST /api/shortcut por formulario importe/comercio/banco/tarjeta/idEvento. Sincronizar fusiona por id y externalId, nunca reemplaza manuales. Manejo de errores visible. Exportar instrucciones JSON sin token. No mostrar activado por visitar guía.
Guía: Cartera variable Importe → importe; Comercio → comercio; Tarjeta o pase → tarjeta; banco derivado mapping o texto fijo por automatización. idEvento generar UUID una vez por evento y conservar en reintento. Fecha yyyy-MM-dd. POST JSON Authorization Bearer. Guardar respuesta y mostrar éxito SOLO HTTP 2xx. No pago real en tests. No archivo .shortcut firmado ni App Intent nativo disponibles; decirlo.

## Límites explícitos
Loopback no es accesible desde iPhone. No publicar en esta tarea. HTTPS receptor siempre disponible queda pendiente de proveedor, seguridad y aprobación de despliegue. No prometer ejecución bloqueada comprobada. No cobros ni IA remota. No incorporar capturas/finanzas personales al repo.

## Verificación
API `node --test apps/api/*.test.mjs`. Web `npm.cmd test` y `npm.cmd run build`. Navegador local flujo guardar/informes y POST real con payload sintético, duplicados, banco, exportación. Supervisor registra fallos y relectura en docs/reviews.
