# Login con Supabase (fase C) — diseño

Fecha: 23-09-2026 · Rama: `login-supabase` · Estado: aprobado por la usuaria en conversación.

## Objetivo
Hasta ~10 personas (amigos que prueban la app) con cuenta propia. Cada una ve solo sus datos, sincronizados entre dispositivos. Siempre hace falta iniciar sesión.

## Decisiones
- Acceso: email + contraseña (Supabase Auth). Recuperación de contraseña por email.
- Registro: solo con código de invitación. Registro público desactivado en Supabase; `/api/signup` (Vercel, clave de servicio) valida y consume el código de forma atómica y crea el usuario con el email ya confirmado.
- Datos: un documento por usuario (`user_data.data` jsonb, mismo formato `Data` v2) con `version` para control de concurrencia optimista. RLS: cada usuario solo su fila.
- Copia local por usuario (`misgastos.user.<id>`) para arranque inmediato y uso sin conexión; cambios pendientes se suben al volver la conexión.
- Conflicto (la versión remota cambió): se carga la remota y se avisa de que el último cambio local no se guardó. Nunca se sobrescribe a ciegas.
- Primer inicio de sesión: si la cuenta está vacía y el navegador tiene datos del modo local (`misgastos.local.v1`), se pregunta si subirlos.
- Atajo Apple Pay: token personal por usuario, generado en la app (se muestra una vez), guardado como SHA-256 en `shortcut_tokens`. `/api/shortcut` identifica al usuario por el hash y guarda el evento con `user_id`. El token global `SHORTCUT_TOKEN` deja de usarse. La app lee sus eventos de `shortcut_events` (RLS) y los fusiona sin duplicar.
- Ajustes: fila «Cuenta» con el email; «Cerrar sesión» en rojo.

## Esquema (`supabase/schema.sql`)
- `user_data(user_id pk → auth.users, data jsonb, version int, updated_at)` + RLS select/insert/update propios.
- `invite_codes(code pk, uses_left int ≥ 0)` + RLS sin políticas (solo servicio). Funciones `consume_invite(code)` y `refund_invite(code)` solo para `service_role`.
- `shortcut_tokens(token_hash pk, user_id → auth.users)` + RLS select/insert/delete propios.
- `shortcut_events.user_id` (nueva columna) + RLS select propio.

## Código
- `src/cloud/supabase.ts`: cliente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- `src/cloud/sync.ts`: lógica pura de conciliación y guardado con versión (probada con un remoto simulado).
- `src/cloud/Root.tsx`: sesión → Login o App; carga/sincroniza; subida inicial; avisos.
- `src/auth/Login.tsx`: entrar, crear cuenta (con código), recuperar contraseña, nueva contraseña.
- `App.tsx`: acepta un almacén en la nube opcional; sin él mantiene el modo local (pruebas existentes).
- `Shortcut.tsx`: generar token, URL del receptor, sincronizar, prueba, guía.
- `api/signup.mjs` nuevo; `api/shortcut.mjs` con token por usuario.

## Pasos de la usuaria
Supabase: ejecutar `schema.sql`, crear código (`insert into invite_codes values ('CODIGO', 10)`), desactivar «Allow new users to sign up», poner la URL de Vercel como Site URL / Redirect URL. Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (ya existen `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Tras registrarse: `update shortcut_events set user_id='<su id>' where user_id is null`.

## Fuera de alcance
Hogar compartido, Google, panel de administración, borrado de cuenta desde la app.
