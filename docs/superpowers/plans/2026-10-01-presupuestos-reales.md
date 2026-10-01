# Presupuestos reales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el límite mensual básico de misGastos en un plan mensual con ingresos, gasto previsto, categorías, recurrentes, deudas y objetivos de ahorro accesible desde Gastos.

**Architecture:** Extender el documento Data existente con estructuras de planificación validadas y migración desde v2. Un módulo puro calcula cuotas y resúmenes; pantallas React separadas usan el guardado actual de App. No hace falta cambiar Node ni el esquema de Supabase, que ya sincroniza el documento completo.

**Tech Stack:** React, TypeScript, Vitest, Vite; localStorage versionado y documento JSON de Supabase existentes.

**Spec:** `docs/superpowers/specs/2026-10-01-presupuestos-reales-design.md`

## Global Constraints

- Mantener entrada a Presupuestos en la pantalla principal de Gastos y usar la estética actual.
- Dinero en céntimos enteros. Movimientos reales solo desde registro, importación o atajo.
- Ningún servicio de pago ni publicación; pruebas con datos sintéticos.
- El backend Node y las tablas Supabase no cambian en esta fase.
- Escritores con archivos exclusivos: agente de modelo (`apps/web/src/domain.ts`, `apps/web/src/budget/**`), agente de UI (`apps/web/src/App.tsx`, `apps/web/src/budget-ui/**`, CSS). Supervisor solo `docs/reviews/**`; coordinador plan, progreso e integración. Trabajadores no delegan.

## Review Focus

- Copia v1/v2 con `budgets` previos: conservar importes y transacciones tras migrar.
- Importe vacío, negativo o con más de dos decimales: mostrar error y no guardar.
- Recurrente anual de 49,99 €: mensualizar sin pérdida y sin insertar gasto real.
- Mes nuevo después de editar el anterior: clonar una sola vez y no sobrescribir ajustes propios.
- Categoría renombrada o eliminada: no perder el límite ni contar un gasto en otra categoría silenciosamente.

---

### Task 1: Modelo y migración

**Files:** Modify `apps/web/src/domain.ts`; create `apps/web/src/budget/model.ts`, `apps/web/src/budget/model.test.ts`.

**Interfaces:** `BudgetData` contiene `months: Record<string,MonthPlan>`, `recurrents: Recurring[]`, `debts: Debt[]`, `goals: SavingsGoal[]`; `MonthPlan` tiene `incomeTotalCents`, `incomeItems`, `plannedSpendCents`, `categoryLimits`, `unassignedSavingsCents`, `actualSavingsCents`; las colecciones se guardan en `Data.planning`. Exportar `planForMonth(data, month): MonthPlan`, `monthlyRecurring(items): number`, `goalQuota(goal,month): number`, `budgetSummary(data,month): BudgetSummary`, `validatePlanning(value): BudgetData`. IDs UUID locales.

- [ ] **Step 1: Write failing tests** for legacy backup preservation, invalid amounts, annual 4999 cents monthlyization (417 cents rounded for display, exact fractions in totals), month cloning, category rename/delete behavior, and goal with 12000 cents remaining over 60 months = 200 cents/month. Use synthetic data and assert no `transactions` mutation.
- [ ] **Step 2: Run** `npm.cmd test -- --run src/budget/model.test.ts` from `apps/web`; expect the new assertions to fail.
- [ ] **Step 3: Implement** types, migration in `validateBackup`, defaults in `emptyData`, and pure calculations. A month is cloned from nearest previous configured month only when first saved, not on mere navigation. Keep legacy `budgets` readable and migrate the selected month limit to `plannedSpendCents`. Store category references by stable name and update them when `Categories` renames/deletes a category; orphaned names remain visibly labeled until user remaps them.
- [ ] **Step 4: Run** `npm.cmd test -- --run src/budget/model.test.ts` and `npm.cmd run build`; expect PASS.
- [ ] **Step 5: Write** a concise implementation report in `apps/web/BUDGET_MODEL_REPORT.md` with commands, results and open risks.

### Task 2: Presupuestos UI

**Files:** Create `apps/web/src/budget-ui/BudgetPage.tsx`, `apps/web/src/budget-ui/budget.css`, `apps/web/src/budget-ui/BudgetPage.test.tsx`; modify `apps/web/src/App.tsx` to route the existing home card to this page.

**Interfaces:** `BudgetPage({data,month,onMonth,onSave,onBack,onRecurring,onGoals}: Props)` consumes Task 1 calculations and calls `onSave(nextData)` once per confirmed form action. Keep the home card visible.

- [ ] **Step 1: Write failing component tests**: home card opens Presupuestos; manual income, income line item with recurrence switch, planned spend and category limit save and survive remount; overspend and deficit messages show actual signed amounts; unknown month does not persist until edit.
- [ ] **Step 2: Run** `npm.cmd test -- --run src/budget-ui/BudgetPage.test.tsx src/App.test.tsx`; expect new tests to fail.
- [ ] **Step 3: Implement** mobile layout like screenshots with four plan cards, spend bar, category list, savings history, and accessible bottom-sheet editors. Use current colors/typography rather than copying orange branding. Inputs accept comma decimals and preserve editing drafts. Actual spend derives only from `summary` expense transactions. Show a plain explanation rather than nonfunctional IA banner.
- [ ] **Step 4: Run** component tests and `npm.cmd run build`; expect PASS.
- [ ] **Step 5: Write** `apps/web/BUDGET_UI_REPORT.md` with tested flows and limits.

### Task 3: Recurrentes y deudas

**Files:** Create `apps/web/src/budget-ui/RecurringDebtsPage.tsx`, `apps/web/src/budget-ui/RecurringDebtsPage.test.tsx`; extend `apps/web/src/budget-ui/budget.css`. Model agent owns any corrections to `apps/web/src/budget/model.ts` while UI agent owns these files; do not write concurrently to the same file.

**Interfaces:** `RecurringDebtsPage({data,onSave,onBack}: Props)` reads `planning.recurrents` and `planning.debts`. Recurring fields: id, name, amountCents, cadence (`monthly|quarterly|yearly`), nextDate, category, kind (`expense|investment`), status (`active|paused|cancelled`). Debt fields: id, direction (`owedToMe|iOwe`), counterparty, originalCents, paidCents, dueDate optional, reminder flag; balance = max(0, original-paid).

- [ ] **Step 1: Write failing tests** for add/pause/resume/cancel recurring, monthlyized total, debt add/payment/settlement/filter, and no expense transaction creation.
- [ ] **Step 2: Run** targeted Vitest; expect failures.
- [ ] **Step 3: Implement** two tabs and editors. Monthlyized totals count active entries only. Payment adjusts debt balance but does not create a bank transaction; label this explicitly. Reminder is stored locally as intent, with no push notification claim.
- [ ] **Step 4: Run** targeted Vitest and build; expect PASS.
- [ ] **Step 5: Update** UI report with commands and limitations.

### Task 4: Objetivos de ahorro

**Files:** Create `apps/web/src/budget-ui/SavingsGoalsPage.tsx`, `apps/web/src/budget-ui/SavingsGoalsPage.test.tsx`; extend budget CSS.

**Interfaces:** `SavingsGoalsPage({data,month,onSave,onBack}: Props)` uses `goalQuota` and edits `planning.goals`; `BudgetPage` receives total quota and unassigned savings.

- [ ] **Step 1: Write failing tests** for add/edit/delete goal, target/current/date validation, 60-month quota, multiple goals summed into monthly savings, unassigned savings without a bank transfer, and actual monthly savings entered manually.
- [ ] **Step 2: Run** targeted Vitest; expect failures.
- [ ] **Step 3: Implement** goals list and bottom sheet. Show target progress, remaining months and computed monthly quota. A completed goal contributes zero. Savings history shows planned savings and a separate manually entered actual savings amount. Never infer a bank balance or an actual transfer.
- [ ] **Step 4: Run** targeted Vitest and build; expect PASS.
- [ ] **Step 5: Update** UI report.

### Task 5: Integración y revisión

**Files:** Modify `apps/web/src/App.tsx`, `apps/web/src/Categories.tsx` if category rename needs coordination; create `docs/reviews/budgets-2026-10-01.md`; update `docs/progress.md`.

- [ ] **Step 1: Coordinator integrates** page routes, category rename mapping, month selector, and cloud/local save paths. Add test for export/restore round trip with planning data.
- [ ] **Step 2: Run** `npm.cmd test`, `npm.cmd run build` from `apps/web` and `node --test apps/api/*.test.mjs` from `misGastos`; record exact counts.
- [ ] **Step 3: Browser test** with synthetic data: open from Gastos, configure income/expense/category, add recurring annual, add debt and payment, create goal, switch month and reload; confirm actual transactions unchanged and restore works. Keep browser local.
- [ ] **Step 4: Supervisor reviews** without changing `apps/web` or `apps/api`; findings go to `docs/reviews/budgets-2026-10-01.md`. Send failures to owning worker; re-run targeted and full verification, then record actual status in `docs/progress.md`.


Aclaración de implementación: verificar el grid 2×2 de las cuatro tarjetas a 375 y 390 px, sin desbordamiento horizontal.
