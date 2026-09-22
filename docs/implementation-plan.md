# misGastos Implementation Plan

**Goal:** app financiera morada usable y receptor probado para importe, comercio y banco, sin repostajes.
**Architecture:** React/TypeScript PWA local y receptor Node/SQLite opcional; despliegue HTTPS e iPhone pendientes.
**Spec:** docs/contract.md y ../../docs/miesencial-referencia-funcional.md.

- [x] Backend: pruebas fallidas de validación, autenticación, asociación tarjeta/banco, idempotencia y persistencia; implementar; ejecutar node --test. Propietario backend en apps/api.
- [x] Frontend: pruebas de dinero, informes/restauración JSON y fusión; implementar navegación, alta, informes, ajustes y atajo de primera entrega; test/build. Completado por coordinador tras límite del agente; alcance y diferencias en progress.md.
- [x] Coordinación: documentación, scripts de arranque, guía de Atajos, integración real local y corrección de interfaces.
- [ ] Supervisor: inspección independiente reproducible, sin editar apps; devolver fallos a cada responsable y verificar resolución.
- [x] Integración local final: persistencia, bancos, rechazos, duplicados y navegador. Documentar límites de iPhone/HTTPS y módulos aún pendientes.

Esta es la primera entrega de construcción, no toda la paridad funcional de mi€sencial. No confundir un simulador local del atajo con instalación o prueba en iPhone.
