# Modelo de presupuestos — 2026-10-01

## Entrega

- `Data` sube a versión 3 con `planning: BudgetData` obligatorio. `emptyData()` crea planificación vacía. `validateBackup()` acepta copias v1/v2/v3, conserva `transactions` y `budgets`, y migra cada límite mensual heredado a `planning.months[mes].plannedSpendCents`.
- Tipos exportados desde `src/budget/model.ts`: `IncomeItem`, `MonthPlan`, `Recurring`, `Debt`, `SavingsGoal`, `BudgetData`, `BudgetCategory`, `BudgetSummary`.
- Funciones exportadas: `emptyMonthPlan`, `emptyPlanning`, `validatePlanning`, `planForMonth`, `saveMonthPlan`, `renameCategoryLimit`, `debtBalance`, `monthlyRecurring`, `goalQuota`, `budgetSummary`.
- `planForMonth` devuelve una copia virtual del mes configurado anterior. `saveMonthPlan` la persiste solo al editar; nunca sobrescribe un mes ya configurado. `actualSavingsCents` se reinicia a cero en la copia virtual. `renameCategoryLimit` mueve referencias explícitamente; las categorías eliminadas quedan señaladas en `budgetSummary(...).categories[].orphaned`.
- Los cálculos recurrentes y de cuotas conservan fracciones de céntimo para los totales; la UI debe redondear solo al mostrar. `budgetSummary` toma gasto/ingreso real solo de transacciones y no las modifica. `plannedIncomeCents` usa las partidas cuando existen; en otro caso, `incomeTotalCents`.

## Verificación

- RED: prueba dirigida falló porque faltaba `./model`; después, caso `__proto__` falló por pérdida de límite y se corrigió.
- `npm.cmd test -- --run src/budget/model.test.ts`: **9/9 PASS**.
- `npm.cmd run build`: **PASS** (TypeScript, Vite, PWA).
- `npm.cmd test`: **65 PASS, 1 FAIL** en 15 archivos. Único fallo: `src/domain.test.ts` espera `version === 2` tras migrar v1; ahora el contrato es v3. El coordinador posee esa prueba y ya fue avisado.

## Límites de integración

- La UI debe usar `saveMonthPlan` para el primer guardado del mes y `renameCategoryLimit` al renombrar una categoría. Borrar una categoría no debe borrar su límite: aparecerá como huérfano hasta remapearlo.
- `monthlyRecurring` suma entradas activas de cualquier `kind`; `budgetSummary` separa gasto e inversión. Sus retornos pueden ser fraccionarios. `goalQuota` reparte el saldo restante entre el mes consultado y el mes objetivo, ambos incluidos, con mínimo un mes si el objetivo ya venció.
- No se han editado archivos de UI, backend, documentación raíz ni pruebas heredadas.

## Supervisor findings corrected — 2026-10-01

- `budgetSummary` now uses an own-property lookup for category limits. A movement categorized `constructor` with no limit reports `limitCents: 0`, `actualCents: 2500`, and `remainingCents: -2500` instead of inherited `Object.prototype` and `NaN`.
- `renameCategoryLimit(data, name, name)` is a no-op, preserving the configured limit.
- A new month inherits only income items marked `recurring`; one-time items remain in their original configured month. The manual income total still carries forward. Existing configured months are untouched.
- TDD: three new tests first failed for the reported behavior (9 passed, 3 failed), then passed after the fixes.
- `npm.cmd test -- --run src/budget/model.test.ts`: **12/12 PASS**.
- `npm.cmd run build`: **PASS** (TypeScript, Vite, PWA).
- Full `npm.cmd test` was run while UI work was in progress: **69 passed, 3 failed, 1 suite could not load** across 18 files. Failures were in `budget-ui/RecurringDebtsPage.test.tsx` (2), `budget-ui/SavingsGoalsPage.test.tsx` (1), and `budget-ui/BudgetPage.test.tsx` import of pending `budget.css`. Model and other suites passed. These UI files are owned by another worker.

## Histórico estable de objetivos — 2026-10-01

- `MonthPlan.goalSavingsSnapshotCents?: number | null` guarda una instantánea de la cuota total de objetivos para ese mes. `saveMonthPlan` la calcula en cada edición del plan. `snapshotSavingsMonth(data, month)` permite actualizarla explícitamente tras cambios de objetivos del mes actual.
- `historicalPlannedSavingsCents(data, month): number | null` devuelve la instantánea más el ahorro sin objetivo guardado. Devuelve `null` si el mes heredado no tiene instantánea, sin recalcular su pasado con objetivos actuales. `budgetSummary` sigue calculando la cuota actual en vivo.
- `validatePlanning` normaliza instantáneas ausentes a `null` y rechaza importes inválidos; las copias v1/v2 migradas quedan con histórico no disponible hasta que se edite el mes.
- TDD: tres pruebas fallaron primero por falta de helper. Después `npm.cmd test -- --run src/budget/model.test.ts`: **15/15 PASS**. `npm.cmd run build`: **PASS** (TypeScript, Vite, PWA).
- `npm.cmd test` completo durante integración UI: **82 PASS, 2 FAIL** en 18 archivos. Fallos ajenos al modelo: `budget-ui/BudgetPage.test.tsx` aún muestra 60,00 € donde espera 65,00 €; `budget-ui/SavingsGoalsPage.test.tsx` aún no invoca la instantánea al crear objetivo. El coordinador y el agente UI fueron avisados.

## Cuota fraccionaria al guardar — 2026-10-01

- Caso reproducido: objetivo con 10.000 céntimos restantes en 60 meses produce cuota viva de 166,666… céntimos. La instantánea intentaba persistir ese número fraccionario y `validatePlanning` rechazaba la edición.
- `saveMonthPlan` y `snapshotSavingsMonth` ahora redondean **la suma** de las cuotas de objetivos al céntimo entero al guardar. `goalQuota` y `budgetSummary` mantienen el cálculo exacto en vivo; la copia JSON conserva 167 céntimos y restaura correctamente.
- TDD: nueva prueba falló primero con `Planificación no válida`, luego pasó.
- `npm.cmd test -- --run src/budget/model.test.ts`: **16/16 PASS**.
- `npm.cmd run build`: **PASS**.
- `npm.cmd test`: **85/85 PASS** en 18 archivos.
