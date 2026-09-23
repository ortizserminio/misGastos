-- misGastos · esquema para cuentas de usuario (fase C).
-- Se puede ejecutar varias veces en el SQL Editor de Supabase.

-- Datos de cada usuario: un documento por persona.
create table if not exists public.user_data (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
drop policy if exists "user_data select own" on public.user_data;
drop policy if exists "user_data insert own" on public.user_data;
drop policy if exists "user_data update own" on public.user_data;
create policy "user_data select own" on public.user_data for select to authenticated using (auth.uid() = user_id);
create policy "user_data insert own" on public.user_data for insert to authenticated with check (auth.uid() = user_id);
create policy "user_data update own" on public.user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Códigos de invitación: solo los usa la API de Vercel con la clave de servicio.
create table if not exists public.invite_codes (
  code text primary key,
  uses_left integer not null check (uses_left >= 0),
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;

create or replace function public.consume_invite(p_code text) returns boolean
language sql security definer set search_path = public as $$
  update public.invite_codes set uses_left = uses_left - 1 where code = p_code and uses_left > 0 returning true;
$$;
create or replace function public.refund_invite(p_code text) returns void
language sql security definer set search_path = public as $$
  update public.invite_codes set uses_left = uses_left + 1 where code = p_code;
$$;
revoke all on function public.consume_invite(text) from public, anon, authenticated;
revoke all on function public.refund_invite(text) from public, anon, authenticated;
grant execute on function public.consume_invite(text) to service_role;
grant execute on function public.refund_invite(text) to service_role;

-- Tokens personales del atajo de Apple Pay (solo se guarda el SHA-256).
create table if not exists public.shortcut_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists shortcut_tokens_user_idx on public.shortcut_tokens (user_id);
alter table public.shortcut_tokens enable row level security;
drop policy if exists "shortcut_tokens select own" on public.shortcut_tokens;
drop policy if exists "shortcut_tokens insert own" on public.shortcut_tokens;
drop policy if exists "shortcut_tokens delete own" on public.shortcut_tokens;
create policy "shortcut_tokens select own" on public.shortcut_tokens for select to authenticated using (auth.uid() = user_id);
create policy "shortcut_tokens insert own" on public.shortcut_tokens for insert to authenticated with check (auth.uid() = user_id);
create policy "shortcut_tokens delete own" on public.shortcut_tokens for delete to authenticated using (auth.uid() = user_id);

-- Gastos recibidos del atajo: ahora pertenecen a un usuario.
alter table public.shortcut_events add column if not exists user_id uuid references auth.users on delete cascade;
create index if not exists shortcut_events_user_idx on public.shortcut_events (user_id);
alter table public.shortcut_events enable row level security;
drop policy if exists "shortcut_events select own" on public.shortcut_events;
create policy "shortcut_events select own" on public.shortcut_events for select to authenticated using (auth.uid() = user_id);

-- Crear un código (ejemplo, cámbialo):
-- insert into public.invite_codes (code, uses_left) values ('AMIGOS-2026', 10);
-- Asignar a tu usuario los gastos antiguos del atajo (tras registrarte):
-- update public.shortcut_events set user_id = (select id from auth.users where email = 'tu@email.com') where user_id is null;

-- Permisos de la API para usuarios con sesión (los proyectos nuevos no los conceden solos).
grant usage on schema public to authenticated;
grant select, insert, update on public.user_data to authenticated;
grant select, insert, delete on public.shortcut_tokens to authenticated;
grant select on public.shortcut_events to authenticated;
-- La API de Vercel usa la clave de servicio; en proyectos nuevos también hay que concedérselo.
grant select on public.shortcut_tokens to service_role;
grant select, insert on public.shortcut_events to service_role;
grant select, insert, update on public.user_data to service_role;
grant select, update on public.invite_codes to service_role;
