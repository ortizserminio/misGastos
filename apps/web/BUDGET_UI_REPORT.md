# Informe de UI: presupuestos reales — 01-10-2026

## Implementado

- La tarjeta «Mis presupuestos» de Gastos abre el plan mensual. Se conserva la estética morada y la tarjeta de inicio.
- Cuatro tarjetas de ingresos, gasto previsto, fijos mensualizados y ahorro en matriz móvil 2×2; resumen del gasto real, disponible, déficit y exceso; límites por categoría e histórico de ahorro previsto frente al anotado manualmente, con instantánea mensual persistida de cuotas de objetivos.
- Ingreso manual o por partidas con importe propio, casilla recurrente, edición y borrado de partidas; guardado diferido del mes virtual mediante `saveMonthPlan`.
- Recurrentes con alta, pausa, reanudación y cancelación; deudas con dirección, filtro, pago y saldo pendiente; objetivos con alta, edición, borrado, progreso y cuota mensual.
- Formularios en panel inferior móvil. Los importes usan validación de céntimos; un pago de deuda, una asignación de ahorro o un recurrente no crean movimientos reales.

## Verificación

- Primero se ejecutaron 5 pruebas nuevas y fallaron por ausencia de las pantallas. Después, una prueba de edición de partida falló por la acción ausente y una prueba de vencimiento opcional falló porque se rellenaba automáticamente. Ambos casos se corrigieron y pasaron.
- `npm.cmd test -- --run src/budget-ui/BudgetPage.test.tsx src/budget-ui/RecurringDebtsPage.test.tsx src/budget-ui/SavingsGoalsPage.test.tsx src/App.test.tsx`: 11/11 en la primera integración.
- `npm.cmd test -- --run src/budget-ui/BudgetPage.test.tsx`: 5/5 tras añadir edición y navegación.
- `npm.cmd test`: 86/86 en 18 archivos, sin fallos. Incluye regresiones de nombres de más de 200 caracteres, instantánea histórica de ahorro, cuota tras editar un objetivo e importe separado de partida de ingreso.
- `npm.cmd run build`: TypeScript, Vite y precaché PWA correctos; 5 recursos en caché offline.

## Límites pendientes

- La matriz móvil 2×2 está fijada por CSS, pero la inspección visual real a 390 y 375 px queda para el recorrido de integración del coordinador; no la declaro superada aquí. La revisión independiente está en curso.
- Los recordatorios de deuda son una marca local, sin notificaciones automáticas.
- `npm.cmd run build` actualizó el archivo generado `apps/web/tsconfig.tsbuildinfo`; el coordinador puede decidir si lo conserva o revierte al integrar.
