# Puesta en marcha del login (Supabase + Vercel)

Pasos que hace la dueña de la app una sola vez. Nada de esto va en Git.

## 1. Supabase → SQL Editor
1. Abrir el proyecto de Supabase → **SQL Editor** → **New query**.
2. Pegar el contenido de `supabase/schema.sql` y pulsar **Run**. Se puede repetir sin problema.
3. Crear el código de invitación (cámbialo por uno largo y difícil de adivinar):
   ```sql
   insert into public.invite_codes (code, uses_left) values ('AMIGOS-2026-XXXX', 10);
   ```
   Ver cuántos usos quedan: `select * from public.invite_codes;`

## 2. Supabase → Authentication
1. **Sign In / Providers → Email**: activado. Desactivar **Allow new users to sign up** (el registro se hace solo con código a través de la app).
2. **URL Configuration**: en **Site URL** poner la dirección de la app en Vercel (p. ej. `https://misgastos.vercel.app`). En **Redirect URLs** añadir esa misma dirección y `https://*-ortizserminio.vercel.app/**` para las versiones de prueba.

## 3. Vercel → Settings → Environment Variables
Añadir (Production y Preview):
- `VITE_SUPABASE_URL` = la misma URL que `SUPABASE_URL` (Supabase → Project Settings → API → Project URL).
- `VITE_SUPABASE_ANON_KEY` = la clave **anon / public** (Project Settings → API). Es pública por diseño; las reglas RLS protegen los datos.
- Ya existen `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (secreta: nunca en variables `VITE_`). `SHORTCUT_TOKEN` ya no se usa y se puede borrar.

Después, **Redeploy** para que la app coja las variables.

## 4. Primer uso
1. Abrir la app → **Crear cuenta** con tu email, contraseña y el código.
2. Si el navegador tenía datos, la app pregunta si subirlos: **Subir a mi cuenta**.
3. Asignarte los gastos antiguos del atajo (SQL Editor):
   ```sql
   update public.shortcut_events set user_id = (select id from auth.users where email = 'tu@email.com') where user_id is null;
   ```
4. Ajustes → **Atajo Apple Pay** → **Generar mi token** y pegarlo en tu atajo del iPhone (cabecera `Authorization: Bearer <token>`). El token anterior (`SHORTCUT_TOKEN`) deja de funcionar.

## Desarrollo local
Crear `apps/web/.env.local` (ignorado por Git: `*.local`) con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
