# Login con Supabase — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Cuentas por usuario con Supabase Auth, datos sincronizados por usuario y atajo con token personal.
**Architecture:** Documento `Data` por usuario en `user_data` con versión; copia local por usuario; Vercel solo para registro con invitación y receptor del atajo.
**Tech Stack:** React + TS, `@supabase/supabase-js`, Vercel functions (Node, fetch a Supabase REST/Admin), Vitest, node:test.
**Spec:** `docs/superpowers/specs/2026-09-23-login-supabase-design.md`

- [ ] **1. Esquema SQL** — `supabase/schema.sql` idempotente (tablas, RLS, funciones de invitación con `security definer` y permisos solo `service_role`). Commit.
- [ ] **2. `api/signup.mjs`** — test node (`apps/web/api/signup.test.mjs`, fetch simulado): 201 con código válido; 403 código agotado (sin crear usuario); 409 email existente con devolución del uso; 422 email/contraseña (<8) no válidos. Implementar: `consume_invite` RPC → `POST /auth/v1/admin/users {email,password,email_confirm:true}` → si falla, `refund_invite`. Commit.
- [ ] **3. `api/shortcut.mjs` por usuario** — test: token desconocido 401; token válido guarda con `user_id`; duplicado por `event_id`+`user_id`. Implementar hash SHA-256 → `shortcut_tokens` → `user_id`. Eliminar GET de transacciones y asociaciones (la app lee de Supabase). Commit.
- [ ] **4. `cloud/sync.ts`** — tests Vitest con remoto simulado: primera carga sin fila (crea / propone subida), carga remota, guardado con versión, conflicto (carga remota + aviso), sin conexión (pendiente) y reintento, conciliación caché pendiente con remoto igual/diferente. Implementar `createSync`. Commit.
- [ ] **5. `cloud/supabase.ts`** — cliente, `remoteFor(userId)` (load/create/update con filtro de versión), `createShortcutToken`, `fetchShortcutEvents`. Añadir dependencia `@supabase/supabase-js`. Commit.
- [ ] **6. `auth/Login.tsx` + `cloud/Root.tsx` + `main.tsx`** — tests con cliente simulado: sin sesión muestra login; registro llama a `/api/signup` y luego inicia sesión; errores en español. Root: sesión, sync, subida inicial, eventos online, avisos, `PASSWORD_RECOVERY`. Commit.
- [ ] **7. `App.tsx`, `Settings.tsx`, `Shortcut.tsx`** — App con almacén opcional (`cloud`), Cuenta (email) y Cerrar sesión en Ajustes, atajo con token personal. Actualizar tests existentes del atajo. Commit.
- [ ] **8. Verificación** — `npx vitest run`, `node --test apps/web/api/*.test.mjs`, `npm run build`; documentar pasos de Supabase/Vercel en `docs/login-supabase.md`; actualizar `docs/progress.md`; push de la rama para la versión de prueba.
