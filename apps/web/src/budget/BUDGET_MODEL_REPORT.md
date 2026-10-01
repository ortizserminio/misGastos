# Corrección del snapshot de ahorro mensual

`saveMonthPlan` conserva un `goalSavingsSnapshotCents` ya guardado al editar un mes. En el primer guardado calcula el valor con los objetivos vigentes. `snapshotSavingsMonth` recalcula ese valor de forma explícita cuando cambian los objetivos del mes actual.

## Verificación (2026-10-01)

- Antes del cambio, `npm.cmd test -- --run src/budget/model.test.ts`: 1 fallo de 17 pruebas. La prueba `does not rewrite saved goal history when actual savings are annotated later` esperaba 200 céntimos y recibió 0.
- Después del cambio, `npm.cmd test -- --run src/budget/model.test.ts src/budget-ui/BudgetPage.test.tsx`: 2 archivos, 25 pruebas correctas.
- `npm.cmd test`: 18 archivos, 88 pruebas correctas.
- `npm.cmd run build`: correcto (`tsc -b`, `vite build` y generación del service worker).

La primera ejecución de Vitest en el sandbox falló al crear un archivo temporal bajo `node_modules/.vite-temp` (`EPERM`). Se repitió con acceso de escritura y obtuvo el fallo funcional esperado. No se ejecutaron pruebas de API ni de navegador para esta corrección del modelo.
