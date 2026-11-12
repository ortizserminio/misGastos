# Plan de ejecución: conexión con bancos (PSD2) y rediseño visual

Este documento está pensado para que un agente de código (Claude Code o Codex) lo ejecute en este repositorio. Está escrito para que se pueda seguir de arriba abajo. Antes de cada fase, lee los archivos que se citan; no inventes estructuras que ya existen.

## 0. Reglas generales para el agente

- Trabaja en ramas: `feat/bancos` para las fases 1–3 y `feat/rediseno` para la fase 4. Haz un commit por cada paso numerado, con mensaje en español.
- Después de cada paso, todo esto tiene que pasar: `npm run test:web`, `npm run test:vercel` y `npm --prefix apps/web run build` (incluye `tsc -b`).
- El estilo del código es compacto (funciones en una línea, sin librerías innecesarias). Respétalo y no reformatees archivos que no tocas.
- No añadas dependencias si `node:crypto` o `fetch` bastan. Las funciones de Vercel viven en `apps/web/api/`. Los archivos que empiezan por `_` no se exponen como rutas (mira `_supabase.mjs`).
- Nunca pongas secretos en el frontend, en Git ni en logs. Nada de `console.log` de tokens, códigos de autorización, IBAN completos ni claves.
- Los pasos marcados como **[MANUAL – Esterly]** los hace el usuario a mano. Cuando llegues a uno, para y pide los datos.
- Si un nombre de campo de la API de Enable Banking no coincide con lo que dice este plan, manda la referencia oficial (https://enablebanking.com/docs/api/reference/): adáptate a ella y anótalo en `docs/progress.md`.

### Prerrequisito

Aplica primero el parche `0001-Editar-cuenta-usa-el-saldo-actual-en-vez-del-saldo-i.patch` (opción A: editar el saldo actual). Este plan reutiliza `openingFromCurrent()`, que está en `apps/web/src/assets.ts`.

---

## 1. Contexto y decisiones ya tomadas

**Objetivo:** que los movimientos y saldos de BBVA y N26 entren solos en misGastos, como "pendientes de revisar", y que el saldo de cada cuenta se pueda igualar al del banco con un toque.

**Cómo funciona:** PSD2 (Open Banking) a través de un agregador con licencia AISP. No hay scraping ni contraseñas guardadas. El usuario se autentica en la web del banco y el banco devuelve un `code` a nuestra URL de callback.

**Agregador elegido: Enable Banking**, en "modo restringido".
- Es gratis para uso personal: solo se accede a las cuentas que el propio usuario vincula en su panel.
- GoCardless Bank Account Data (antes Nordigen) tiene cerradas las altas nuevas, así que se descarta.
- Tink, Plaid y similares son de uso empresarial o de pago. También se descartan.

**ngrok no hace falta.** En los tutoriales sirve para exponer `localhost` como URL HTTPS para el callback. Aquí el callback es la propia app desplegada en Vercel. Solo usa ngrok si quieres probar el callback contra `vite dev` en local, y aun así es preferible usar el sandbox con la URL de un *preview* de Vercel.

**Cobertura por banco:**

| Banco | Vía | Estado |
|---|---|---|
| BBVA | Enable Banking (Redsys/BBVA PSD2) | Soportado. Login con usuario y contraseña + push en la app de BBVA. Al entrar hay que elegir "particulares". |
| N26 | Enable Banking | Debería estarlo (N26 tiene interfaz PSD2 obligatoria), pero hay que **verificarlo** con `GET /aspsps` en `ES` y en `DE`. |
| Trade Republic | Ver fase 3 | Comprobar en `GET /aspsps` (`DE`). Si no aparece, se sigue con el importador de PDF que ya existe. |

---

## 2. Fase 1 – Backend de conexión (Vercel + Supabase)

### 1.1 [MANUAL – Esterly] Alta en Enable Banking

1. Crea una cuenta en https://enablebanking.com y entra en el Control Panel.
2. Crea primero una aplicación **Sandbox** para las pruebas.
   - Redirect URL: `https://<dominio-vercel>/api/bank/callback`. Añade también la del preview si vas a probar ahí.
   - Deja que el panel genere el par de claves y **descarga el `.pem` de la clave privada en ese momento**: no se puede volver a descargar.
   - Apunta el **Application ID**, que también es el `kid` del JWT.
3. Cuando el sandbox funcione, crea la aplicación **Production** y pulsa **"Activate by linking accounts"**. Vincula BBVA (particulares) y N26. Si no vinculas una cuenta aquí, la API no la devolverá nunca.
4. En Vercel → Project → Settings → Environment Variables, añade:
   - `EB_APP_ID`: el Application ID.
   - `EB_PRIVATE_KEY`: el PEM completo. Si Vercel no admite saltos de línea, guárdalo en una línea con `\n` y conviértelo en el código.
   - `EB_REDIRECT_URL`: `https://<dominio>/api/bank/callback`
   - `CRON_SECRET`: una cadena aleatoria de 32 caracteres o más.
   - `SUPABASE_ANON_KEY`, si no existe ya. Hace falta para validar la sesión del usuario.

### 1.2 Esquema de Supabase

Añade al final de `supabase/schema.sql` un bloque idempotente, con el mismo estilo que el resto (`create table if not exists`, `drop policy if exists`, `grant`):

```sql
-- Estado temporal del flujo de autorización (anti-CSRF). Caduca a los 15 min.
create table if not exists public.bank_auth_states (
  state text primary key,
  user_id uuid not null references auth.users on delete cascade,
  aspsp_name text not null, aspsp_country text not null,
  created_at timestamptz not null default now()
);
-- Sesiones de Enable Banking (una por banco y consentimiento).
create table if not exists public.bank_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  aspsp_name text not null, aspsp_country text not null,
  valid_until timestamptz not null,
  status text not null default 'active',          -- active | expired | revoked
  created_at timestamptz not null default now()
);
-- Cuentas devueltas por cada sesión.
create table if not exists public.bank_accounts (
  account_uid text primary key,
  user_id uuid not null references auth.users on delete cascade,
  session_id text not null references public.bank_sessions on delete cascade,
  iban_last4 text, display_name text, currency text,
  app_account_name text,                           -- nombre de la cuenta en Patrimonio (lo elige el usuario)
  balance_cents bigint, balance_type text, balance_at timestamptz,
  last_synced_at timestamptz, last_booking_date date
);
-- Movimientos recibidos del banco (cola que el cliente incorpora como pendientes).
create table if not exists public.bank_events (
  user_id uuid not null references auth.users on delete cascade,
  account_uid text not null references public.bank_accounts on delete cascade,
  external_id text not null,
  amount_cents bigint not null,                    -- siempre positivo
  direction text not null check (direction in ('in','out')),
  merchant text, booking_date date not null, value_date date,
  status text not null default 'BOOK',
  created_at timestamptz not null default now(),
  primary key (user_id, external_id)
);
```

- Activa RLS en las cuatro tablas. `authenticated` solo puede hacer **select** de sus propias filas en `bank_sessions`, `bank_accounts` y `bank_events`, y además puede hacer `update` de la columna `app_account_name` en `bank_accounts`. `bank_auth_states` no lleva ningún permiso para `authenticated`.
- `service_role` puede hacer `select, insert, update, delete` en las cuatro.
- **No guardes el IBAN completo**, solo los 4 últimos dígitos. Tampoco guardes el JSON crudo de las transacciones.
- **[MANUAL – Esterly]**: ejecuta el bloque en el SQL Editor de Supabase. Si el MCP de Supabase está conectado, el agente puede aplicarlo como migración, pero antes tiene que enseñarte el SQL.

### 1.3 `apps/web/api/_enablebanking.mjs` (helper, no es una ruta)

- `jwt()`: firma RS256 con `node:crypto`, sin dependencias.
  - Cabecera: `{ typ:'JWT', alg:'RS256', kid: EB_APP_ID }`.
  - Cuerpo: `{ iss:'enablebanking.com', aud:'api.enablebanking.com', iat, exp: iat+3600 }`. El TTL máximo que acepta la API es 86400 s.
  - Codifica en base64url y firma con `crypto.sign('RSA-SHA256', data, privateKey)`.
  - Cachea el token en memoria y renuévalo cuando le queden menos de 5 minutos.
- `eb(path, {method, body, psu})`: hace `fetch('https://api.enablebanking.com'+path)` con `Authorization: Bearer <jwt>`.
  - Si viene `psu` (una sincronización iniciada por el usuario), añade las cabeceras `Psu-Ip-Address` y `Psu-User-Agent` de la petición original. Con ellas el banco la trata como acceso "con el usuario presente" y no cuenta para el límite de 4 accesos diarios desatendidos que fija PSD2. Confirma los nombres exactos de las cabeceras en la referencia.
  - Errores: lanza `ApiError(502, 'bank_error', mensaje en español)`. En el mensaje no puede ir el cuerpo completo de la respuesta.
- `userFromRequest(req)`: valida el `Authorization: Bearer <access_token de Supabase>` del cliente llamando a `GET ${SUPABASE_URL}/auth/v1/user` con las cabeceras `apikey: SUPABASE_ANON_KEY` y `Authorization: Bearer <token>`. Devuelve `user.id` o lanza 401.
- `toEvent(tx, accountUid)`: mapea una transacción de Enable Banking a una fila de `bank_events`.
  - `amount_cents` = `Math.round(Number(tx.transaction_amount.amount)*100)`, en valor absoluto.
  - `direction` = `'in'` si `credit_debit_indicator==='CRDT'`; si es `'DBIT'`, `'out'`.
  - `merchant`: si sale dinero, `creditor.name`; si entra, `debtor.name`. Si falta, usa la primera línea de `remittance_information`. Limpia el texto, quita espacios dobles y córtalo a 100 caracteres.
  - `booking_date` = `tx.booking_date ?? tx.value_date ?? tx.transaction_date`.
  - `external_id` = `'eb:'+accountUid+':'+(tx.entry_reference || tx.transaction_id || sha256(fecha|importe|dirección|remittance))`. Con el hash de respaldo, dos ejecuciones nunca duplican un movimiento.
  - `status` = `tx.status` (`BOOK` o `PDNG`).
- `bestBalance(balances)`: elige el saldo por orden de preferencia de `balance_type`: `ITAV` (disponible intradía) > `CLAV` > `XPCD` > `ITBD` > `CLBD`. Devuelve `{cents, type, at}`.

Añade los tests en `apps/web/api/_enablebanking.test.mjs` con `node --test`:
- El JWT tiene tres partes, la cabecera correcta y la firma se puede verificar con la clave pública de prueba. Genera un par de claves RSA dentro del propio test.
- `toEvent` con fixtures `CRDT` y `DBIT`, sin `entry_reference` y con importes como `"12.5"` o `"-3.00"`.
- `bestBalance` respeta el orden de preferencia.

Añade el archivo de test al script `test:vercel` de `package.json`.

### 1.4 Rutas de API

Todas responden JSON con `json()` y `sendError()` de `_supabase.mjs`, y en español.

1. **`GET /api/bank/aspsps?country=ES`**: devuelve `GET /aspsps?country=…&psu_type=personal` filtrado a `{name, country, logo, maximum_consent_validity}`. Requiere usuario. Cachéalo 24 h en memoria.
2. **`POST /api/bank/connect`**: recibe el body `{aspsp_name, aspsp_country}` y requiere usuario.
   - Genera un `state` aleatorio (`crypto.randomUUID()`) y guárdalo en `bank_auth_states`.
   - Llama a `POST /auth` con `{access:{valid_until: ahora + min(maximum_consent_validity, 180 días)}, aspsp:{name, country}, state, redirect_url: EB_REDIRECT_URL, psu_type:'personal'}`.
   - Devuelve `{url}`, que el cliente abre con `location.href = url`.
3. **`GET /api/bank/callback?code=…&state=…`**: no lleva cabecera de usuario, porque viene redirigido desde el banco.
   - Busca el `state` (con menos de 15 minutos de antigüedad), lo borra y obtiene el `user_id`.
   - Si llega `?error=`, redirige a `/?bank=error&msg=…`.
   - Llama a `POST /sessions {code}` y guarda `bank_sessions`. Haz *upsert* de `bank_accounts` con las cuentas devueltas (`uid`, los 4 últimos dígitos del IBAN de `account_id.iban`, nombre y moneda).
   - Si una cuenta tiene el mismo IBAN que un activo de Patrimonio, rellena `app_account_name` automáticamente. El cliente envía los IBAN de sus activos en el `connect`, que los guarda en `bank_auth_states`. Añade esa columna `ibans text[]`.
   - Lanza una primera sincronización de 90 días (paso 4) y redirige con `302` a `/?bank=ok`.
4. **`POST /api/bank/sync`** (lo lanza el usuario) y **`GET /api/bank/sync`** (el cron, con `Authorization: Bearer ${CRON_SECRET}`):
   - Para cada cuenta de una sesión `active` con `valid_until` posterior a ahora, primero pide `GET /accounts/{uid}/balances`, aplica `bestBalance` y actualiza `bank_accounts`.
   - Después pide `GET /accounts/{uid}/transactions?date_from=<last_booking_date − 5 días, o hoy − 90 la primera vez>`. Ese solape de 5 días recoge los apuntes que el banco contabiliza tarde.
   - **Paginación:** repite con `continuation_key` hasta que venga `null`, manteniendo idénticos los demás parámetros. Una lista vacía con `continuation_key` **no** significa que haya terminado.
   - Inserta con `Prefer: resolution=ignore-duplicates`. **Ignora `PDNG`**: solo se guardan los `BOOK`, porque los pendientes cambian de importe e id.
   - Actualiza `last_booking_date` y `last_synced_at`.
   - Si el banco responde que el consentimiento ha caducado o fue revocado, marca la sesión como `expired`.
   - El cron solo pasa por las sesiones activas de todos los usuarios. El sync manual, solo por las del usuario que lo pide, y con las cabeceras `psu`.
   - Devuelve `{accounts: n, inserted: n, expired: [...]}`.
5. **`DELETE /api/bank/session?id=…`**: llama a `DELETE /sessions/{id}` en Enable Banking y borra las filas en cascada.

**Cron:** crea `apps/web/vercel.json` (si ya existe, añádele esto):

```json
{ "crons": [{ "path": "/api/bank/sync", "schedule": "17 6 * * *" }] }
```

El plan Hobby de Vercel permite un cron al día. Aparte, el cliente lanza un sync manual al abrirse si han pasado más de 6 horas desde el último.

Añade los tests de las rutas en `_api.test.mjs`, siguiendo el estilo que ya tiene: mockea `fetch` para Enable Banking y para Supabase. Tienen que cubrir que un `state` caducado o desconocido da 400, la paginación con `continuation_key`, que no se duplica en una segunda pasada y que un usuario sin token recibe 401.

---

## 3. Fase 2 – Cliente (React)

Lee primero `src/cloud/supabase.ts`, que tiene el *pull* de `shortcut_events`; `App.tsx` (`addShortcutItems`, la cola de pendientes); `src/import/review.ts` (`findPair`, `buildReview`, `applyReview`); `src/import/classify.ts` y `src/merchants.ts`.

### 2.1 Modelo

- En `domain.ts`, añade `'bank'` al tipo `source` de `Transaction` y a `validTransaction` y `validateBackup`, para que las copias de seguridad sigan siendo válidas. Añade un test.

### 2.2 Ajustes → nueva sección "Bancos conectados" (`src/BankConnections.tsx`)

- Lista de sesiones, que se leen directamente con el cliente de Supabase gracias a RLS. Cada una muestra el banco, sus cuentas (nombre y "···1234"), la última sincronización y "Válido hasta dd/mm".
- Si quedan menos de 14 días de consentimiento, aparece un aviso y el botón **Renovar acceso**, que repite el `connect` para ese banco.
- Botón **Conectar banco**: abre un selector con los ASPSP de `/api/bank/aspsps`, con BBVA y N26 arriba.
- Botón **Sincronizar ahora**: hace `POST /api/bank/sync` y muestra un aviso con "N movimientos nuevos".
- Cada cuenta del banco tiene un selector **"Cuenta en misGastos"** que guarda `app_account_name`. Las opciones son las cuentas de Patrimonio de tipo Cuenta, Ahorro o Efectivo. Sin esa asignación, los movimientos de esa cuenta no se incorporan.
- Botón **Desconectar**, con confirmación.
- Al volver con `?bank=ok` o `?bank=error`, muestra el aviso que corresponda y limpia la URL con `history.replaceState`.

### 2.3 Incorporación de movimientos (la parte delicada)

En el mismo sitio donde hoy se hace el *pull* de `shortcut_events` (al abrir, al volver a primer plano y cada 30 s), haz también el *pull* de `bank_events` junto con `bank_accounts`. Después, para cada evento cuya cuenta tenga `app_account_name`:

1. **Ya incorporado:** si existe una transacción con el mismo `externalId`, o el evento está en `dismissed`, no hagas nada.
2. **Fusión con el atajo de Apple Pay** (para no duplicar): busca una transacción `source:'shortcut'` de la misma cuenta, mismo importe, misma dirección y fecha a ±3 días que no tenga `externalId` de banco. Si la encuentras, **no crees otra**. Añádele `bankExternalId` (campo opcional nuevo, valídalo) y deja la fecha del banco. El comercio y la hora del atajo se conservan, porque son mejores.
3. **Fusión con importaciones de extracto:** aplica la misma regla contra `source:'import'` (mismo importe, fecha a ±1 día y misma cuenta).
4. **Transferencias entre cuentas propias** (BBVA → N26): reutiliza `findPair` de `import/review.ts`. Si hay una salida en una cuenta propia y una entrada del mismo importe en otra cuenta propia en ±2 días, crea **una sola** transacción `type:'transfer'`.
5. **El resto** se crea con `source:'bank'`, `pending:true`, `externalId` y la categoría que dé `guessCategory`/`classify` más las reglas de comercio del usuario (`merchants.ts`). Los ingresos van como `type:'income'`.
6. Los movimientos anteriores a `openingBalance.date` de la cuenta se incorporan, pero con `skipBalance:true`, para que no alteren un saldo inicial que ya los incluye.

Haz tests unitarios de cada regla en `src/bank/merge.test.ts`, con la lógica pura en `src/bank/merge.ts`.

### 2.4 Saldo del banco frente a saldo de la app (resuelve el descuadre de raíz)

- En la tarjeta de cada cuenta de Patrimonio con `bank_accounts` vinculada, muestra debajo "Banco: 4.000,00 € · hace 2 h". Si la diferencia con `accountBalance()` es mayor de 0,01 €, muestra también el chip "Descuadre de X €".
- El botón **Igualar al banco** recalcula `openingBalance.valueCents = openingFromCurrent(nombre, openingBalance.date, balance_cents, transactions)`. Antes de aplicarlo, avisa: "Hay N gastos pendientes de revisar; los pendientes no restan del saldo." Esto importa porque los pendientes son la causa más habitual de descuadre.
- No se iguala nunca de forma automática: siempre lo confirma el usuario.

### 2.5 Aceptación de las fases 1 y 2

- [ ] En sandbox, el flujo completo conecta y sincroniza, y los movimientos aparecen en "Pendientes".
- [ ] Hacer dos syncs seguidos no duplica nada, tampoco con los gastos del atajo de Apple Pay del mismo día.
- [ ] Una transferencia de BBVA a N26 aparece como una sola transferencia.
- [ ] "Igualar al banco" deja el saldo de la app igual al del banco.
- [ ] Ningún secreto aparece en el bundle del frontend. Compruébalo con `grep -r "PRIVATE KEY" apps/web/dist` sobre el build.
- [ ] Los tests y el build pasan.
- [ ] En producción (BBVA y N26 reales), lo hace **[MANUAL – Esterly]**.

---

## 4. Fase 3 – Trade Republic

1. Comprueba con `GET /aspsps?country=DE` si aparece Trade Republic. Si aparece, se conecta igual que los demás y no hay nada más que hacer.
2. Si no aparece, la recomendación es **seguir con el importador de PDF/CSV que ya existe** (`src/import/traderepublic.ts`).
3. Opción avanzada, solo si Esterly la pide expresamente: `pytr` (https://github.com/pytr-org/pytr) es un cliente **no oficial** de la API privada de Trade Republic.
   - Hay que ejecutarlo en local, en el portátil, nunca en Vercel, porque pide el teléfono, el PIN y un código 2FA.
   - El login por app cierra la sesión en el móvil; el login web no lo hace, pero pide un código cada cierto tiempo.
   - Con `pytr export_transactions` se genera un CSV, que se importa con el importador genérico de CSV.
   - Riesgos: puede romperse con cualquier cambio de Trade Republic y va contra sus condiciones de uso. Documéntalo en `docs/trade-republic-pytr.md` y no lo automatices.

---

## 5. Fase 4 – Rediseño visual (rama `feat/rediseno`)

Carga la skill **frontend-design** antes de empezar. Esta fase **no cambia ninguna lógica ni ningún texto funcional**: solo tokens, tipografía, espaciado y jerarquía.

### 4.1 Diagnóstico del estado actual

- El color principal es `#7c3aed` (violet-600 de Tailwind) con variantes sueltas: `#8b5cf6`, `#6d28d9`, `#a78bfa`, `#24114a` y unos 30 tintes lilas escritos a mano (`#f2ecfd`, `#f4edff`, `#e9ddff`…) repartidos por `styles.css`, `patrimonio.css`, `budget.css`, `settings.css`, `review.css`, `import.css`, `transaction-modal.css`, `date-field.css` y `auth/login.css`.
- Solo existen las variables `--purple`, `--muted` y `--border`. El resto son valores sueltos, y por eso cambiar el color hoy es costoso.
- La tipografía es Inter con la pila del sistema. Las cifras no usan `font-variant-numeric: tabular-nums`, así que los importes "bailan" en las listas.
- Es una app móvil (PWA) de finanzas personales en español, con las cuentas como tarjetas de cartera apiladas (`WalletStack.tsx`). Ese es el elemento más característico: tiene que seguir siéndolo.

### 4.2 Paso 1: tokenizar sin cambiar nada visible

1. Crea `src/tokens.css`, impórtalo primero en `main.tsx` y define variables semánticas con los valores **actuales**: `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-ink`, `--color-ink-2`, `--color-muted`, `--color-border`, `--color-primary`, `--color-primary-strong`, `--color-primary-soft`, `--color-primary-tint`, `--color-positive`, `--color-negative`, `--color-warning`, `--radius-s/m/l`, `--shadow-card`, `--space-1..8`, `--font-ui`, `--font-num`.
2. Sustituye **todos** los hex de los CSS por esas variables. Asocia cada tinte lila al token `soft` o `tint` más cercano. Deja los colores de los bancos de `assets.ts` y los que elige el usuario: son datos, no tema.
3. Para verificarlo, saca capturas con Playwright a 390×844 de: Gastos, Patrimonio, Presupuestos, Informes, Ajustes, Pendientes, el modal de movimiento y el editor de activo. Hazlas antes y después y compáralas. Tienen que salir prácticamente iguales. Guárdalas en `docs/rediseno/antes/`.

### 4.3 Paso 2: tres temas para elegir

Implementa los tres como `[data-theme="…"]` en `tokens.css`, con un selector **temporal** en Ajustes → Apariencia para que Esterly los compare en su iPhone. Después de elegir se borran los que sobren.

**A. "Violeta adulto"** (mantiene la identidad, pero menos chillona)
- `--color-primary #5B45C2`, `--color-primary-strong #3F2E96`, `--color-primary-soft #ECE8FA`
- `--color-ink #1E1B2E`, `--color-bg #F7F7FA`, `--color-surface #FFFFFF`
- `--color-positive #0E7C5A`, `--color-negative #C2413A`
- Es el violeta actual con menos saturación y un tinte frío. El lila deja de llenar los fondos y se reserva para las acciones.

**B. "Cobalto"** (más bancario y sobrio, con más contraste)
- `--color-primary #2546C7`, `--color-primary-strong #18308F`, `--color-primary-soft #E6ECFB`
- `--color-ink #141A2A`, `--color-bg #F4F6F9`, `--color-surface #FFFFFF`
- `--color-positive #11795B`, `--color-negative #C23B3B`, acento de ahorro `#C98A12`

**C. "Pizarra y menta"** (verde = dinero, sin parecerse a un banco)
- `--color-primary #0F6E66`, `--color-primary-strong #0A4F4A`, `--color-primary-soft #E3F2EF`
- `--color-ink #1B2528`, `--color-bg #F5F7F6`, `--color-surface #FFFFFF`
- `--color-positive #0F6E66`, `--color-negative #B8433A`, acento `#5A64D6` para las transferencias

Reglas comunes a los tres:
- Contraste AA: 4,5:1 para texto y 3:1 para iconos y bordes de controles. Compruébalo con un script, que es fácil equivocarse a ojo.
- Fondos casi blancos y fríos. **Nada de crema ni beige.**
- El color primario se usa solo en acciones y en el estado seleccionado. Los fondos de sección pasan a neutros.
- Modo oscuro: opcional, solo si sale fácil con los tokens. No es prioritario.

### 4.4 Paso 3: tipografía y cifras

- Cambia Inter por **Instrument Sans** (variable), autoalojada con `@fontsource-variable/instrument-sans` para que funcione offline en la PWA y no dependa de Google Fonts. Si al verla en el móvil no convence, la alternativa es **Figtree**.
- En todos los importes: `font-variant-numeric: tabular-nums` y `letter-spacing:-0.01em`.
- Escala modular de 1,2: 13 / 15 / 18 / 22 / 26 / 32 / 40 px. El cuerpo va a 15 px (16 px en los inputs, para que iOS no haga zoom).
- Pesos: 400 para el texto, 500 para las etiquetas y 600 para los títulos y los importes destacados. Nada de 800/900.
- Evita: etiquetas en MAYÚSCULAS con tracking, una palabra suelta de otro color en los títulos y flechas "→" pegadas a los botones.

### 4.5 Paso 4: jerarquía (el único sitio donde arriesgar)

- **El elemento memorable es el saldo.** En Patrimonio y en la cabecera de Gastos, el importe principal va grande (40 px, 600, tabular) y lo demás queda en silencio. No añadas degradados de adorno ni la combinación de número grande, etiqueta pequeña y degradado.
- Las tarjetas de cartera (`WalletStack`) mantienen el color del banco. Mejora la sombra a una sola sombra suave y coherente, y que el texto de la tarjeta cumpla el contraste usando la función `contrast()` que ya existe.
- **Radios con jerarquía**, no uno igual para todo: 20 px en las hojas y modales, 14 px en las tarjetas, 10 px en inputs y botones y 999 px en los chips.
- Listas de movimientos: más aire vertical (alto mínimo de fila de 56 px), el comercio a 15/500, la categoría y la hora a 13 en `--color-muted` y el importe alineado a la derecha y tabular. Los ingresos en `--color-positive`, con "+".
- Movimiento: solo el que responde a una acción del usuario (abrir una hoja, confirmar un gasto pendiente) y respetando `prefers-reduced-motion`. Nada de animaciones de entrada en cada sección.
- Actualiza `public/manifest.webmanifest` (`theme_color` y `background_color`), `index.html` (`<meta name="theme-color">`) y `public/icon.svg` con el tema que se elija.

### 4.6 Aceptación de la fase 4

- [ ] Capturas de "después" de las mismas pantallas, en `docs/rediseno/despues-<tema>/`.
- [ ] No queda ningún hex suelto en los CSS fuera de `tokens.css`. Compruébalo con `grep -rnE "#[0-9a-fA-F]{6}" apps/web/src --include=*.css`: solo debe salir `tokens.css`.
- [ ] Contraste AA verificado con un script.
- [ ] Los tests y el build pasan.
- [ ] El README ya no dice "diseño morado" si se elige B o C.

---

## 6. Orden recomendado y estimación

1. Aplicar el parche de la opción A (5 minutos).
2. Fase 4, pasos 1–2: tokens y tres temas. Es rápido, se ve enseguida y no depende de nadie.
3. **[MANUAL]** Alta en Enable Banking, en sandbox.
4. Fase 1 contra sandbox, luego fase 2.
5. **[MANUAL]** Aplicación de producción, vinculación de BBVA y N26 y prueba real.
6. Fase 4, pasos 3–5, con el tema ya elegido.
7. Fase 3 (Trade Republic): solo comprobar `/aspsps`.

## 7. Riesgos y matices

- **Caducidad del consentimiento:** el acceso a cada banco caduca (como máximo `maximum_consent_validity`, normalmente 90–180 días) y hay que renovarlo con login y SCA. La app avisa con 14 días de margen.
- **Límite PSD2 de 4 accesos desatendidos al día por cuenta:** el cron va una vez al día y los syncs manuales llevan las cabeceras PSU.
- **Los pendientes (`PDNG`) se ignoran:** un pago con tarjeta puede tardar 1–3 días en aparecer desde el banco. El atajo de Apple Pay sigue siendo la vía instantánea y la fusión (2.3, punto 2) evita duplicados.
- **Modo restringido:** solo funciona con las cuentas vinculadas en el panel. Es para uso personal: si misGastos se abriera a otros usuarios (ya hay códigos de invitación), haría falta un contrato con Enable Banking. No conectes cuentas de otras personas a tu aplicación.
- **BBVA** pide usuario y contraseña en su web y luego una push en la app. A veces no salta a la app sola: hay que abrirla a mano.
- **Si Enable Banking cambia sus condiciones** del modo gratuito, el diseño aísla el proveedor en `_enablebanking.mjs` y las tablas `bank_*`, así que cambiar a otro agregador solo toca ese archivo.
