# misGastos

Aplicación personal de finanzas en React y TypeScript, con diseño morado y receptor opcional para Atajos de iPhone. Sin módulo de repostajes.

## Desarrollo local

Requiere Node.js 24. Desde esta carpeta:

```powershell
npm.cmd --prefix apps/web ci
npm.cmd run dev
```

Si PowerShell encuentra otro `npm` que falla, usar `& 'C:\Program Files\nodejs\npm.cmd'` en lugar de `npm.cmd`.

Abrir [misGastos local](http://127.0.0.1:5174). API en `127.0.0.1:8787`. Ambos procesos se ejecutan solo en loopback; Ctrl+C los detiene. Los gastos manuales se conservan en el navegador; no necesitan el receptor. Cambiar dominio, navegador o borrar datos del sitio puede perder ese almacenamiento: utilizar exportación y restauración.

El receptor almacena por separado los movimientos de Atajos en SQLite. La sincronización los incorpora al navegador sin sustituir los movimientos manuales. Una copia de la interfaz no equivale a una copia completa de los archivos privados del receptor.

## Prioridad: importe, comercio y banco

Al arrancar el receptor por primera vez se genera `apps/api/data/token.txt`. Copiar su contenido al campo de token en Ajustes para conectar el navegador local. Es una credencial privada: no subirla a Git ni compartirla. SQLite se guarda en `apps/api/data/misgastos.sqlite`. Para una copia del receptor, detenerlo primero y copiar su directorio de datos a una ubicación privada.

El contrato del atajo usa `importe`, `comercio`, `banco`, `tarjeta`, `fecha` e `idEvento`. Banco puede ser explícito o provenir de una asociación exacta entre tarjeta y banco. Los reintentos con el mismo evento no crean nuevos gastos; una tarjeta desconocida no inventa banco.

La [guía de Atajos](docs/atajo-apple-pay.md) explica las variables y la petición POST. Ajustes contiene la configuración y una prueba sintética. Configurar esa pantalla no instala una acción nativa de iOS.

**Para usar el atajo desde el iPhone hace falta un receptor HTTPS accesible.** El servidor loopback de este proyecto no lo es. El despliegue y la comprobación con el móvil bloqueado siguen pendientes. No se ha publicado nada ni activado servicios de pago.

## Documentación

- [Contrato de esta entrega](docs/contract.md).
- [Plan](docs/implementation-plan.md).
- [Registro de pruebas y límites](docs/progress.md).
- [Investigación original](../docs/miesencial-referencia-funcional.md).

## Verificación

```powershell
npm.cmd run test:api
npm.cmd run test:web
npm.cmd run build
```

Consultar el registro para los resultados efectivamente ejecutados y los módulos que aún no forman parte de esta primera entrega. No introducir datos personales en fixtures, capturas de prueba o Git. `apps/api/data/`, compilaciones y dependencias están ignorados.
