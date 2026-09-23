# Ajustes, importación de extractos y transferencias propias — diseño

Fecha: 23-09-2026 · Rama: `importar-extractos` · Estado: aprobado por la usuaria en conversación.

## Alcance y fases

- **A.** Rediseño de Ajustes con la estructura de las capturas de referencia (color morado de misGastos, no naranja) y cabecera solo en la pantalla de inicio.
- **B.** Importación de extractos CSV/PDF con detección de transferencias entre cuentas propias y saldos calculados.
- **C.** Login real con Supabase (fase posterior, fuera de este documento; A y B se diseñan para no bloquearla).

## A. Interfaz

### Cabecera
`app-header` (marca, insignia «Solo en tu dispositivo», avatar) se muestra solo cuando `tab==='Gastos'` y no hay subpágina abierta. El resto de pantallas empiezan con su propio título.

### Ajustes (orden)
1. **Perfil**: avatar circular con botón cámara (imagen elegida del dispositivo, reducida a 256 px y guardada como data URL en el perfil; sin imagen → iniciales). Nombre visible editable con lápiz.
2. **Tarjeta general**: Moneda (Euro · EUR, solo lectura) · Patrimonio y cuentas · Categorías («N activas»).
3. **Atajos**: Atajo de Apple Pay (pantalla existente).
4. **Automatizaciones** (etiqueta NUEVO): Importar movimientos («CSV o PDF»).
5. **Cuenta**: Nombre del titular de las cuentas · Exportar copia · Restaurar copia · Borrar datos locales. **App info** con versión.
6. **Cerrar sesión**: no se muestra hasta la fase C.

No se incluyen filas sin funcionalidad (plan, recurrentes, objetivos, viajes, hogar, notificaciones, autónomo, textos legales).

### Categorías
Pantalla propia: campo «Nueva categoría» + botón añadir; lista con icono de color (tocar → selector de color de la paleta) y papelera. Borrar una categoría con movimientos los reasigna a «Otros»; «Otros» no se puede borrar. Nombres únicos sin distinguir mayúsculas.

## B. Modelo de datos

`Data` pasa a `version: 2`. Migración automática desde v1 al leer (localStorage y copias JSON):

- `Transaction.type`: `'expense' | 'income' | 'transfer'`.
- Para `transfer`: `bank` = cuenta origen, nuevo `toAccount` = cuenta destino. `category` = `'Transferencia'` (no se muestra en categorías). No cuenta en gastos, ingresos, informes, presupuesto ni donut.
- `source` añade `'import'`. `externalId` guarda el identificador de importación.
- Nuevo `profile: {displayName: string; ownerName: string; avatar?: string}`.
- Nuevo `categories: {name: string; color: string}[]` (por defecto las 9 actuales con sus colores).
- `Asset` añade `openingBalance?: {date: string; valueCents: number}` e `iban?: string`.

### Saldos
Para activos de tipo Cuenta/Efectivo/Ahorro **con** `openingBalance`: saldo = saldo inicial + ingresos − gastos + transferencias entrantes − salientes, contando movimientos con fecha ≥ fecha del saldo inicial y cuyo `bank`/`toAccount` coincide con el nombre del activo. El historial de evolución se genera por días a partir de esos movimientos. Activos sin `openingBalance` (y todas las inversiones) siguen usando valoraciones manuales. El editor de patrimonio permite fijar saldo inicial, fecha e IBAN.

Ejemplo de aceptación: TR saldo inicial 1000,00; N26 200,00; transferencia de 20,00 TR→N26 ⇒ TR 980,00, N26 220,00, gasto del mes 0,00, ingreso del mes 0,00.

## B. Importación

Todo en el navegador; los archivos no se envían a ningún servidor. PDF con `pdfjs-dist` (texto con coordenadas).

### Flujo (Ajustes → Automatizaciones → Importar movimientos)
1. Si `profile.ownerName` está vacío: pedir «¿A nombre de quién están tus cuentas?».
2. Elegir archivo (`.csv`, `.pdf`, máx. 10 MB).
3. Detección de formato; el usuario confirma la cuenta de la app a la que pertenece (preseleccionada por IBAN o por banco).
4. Revisión: lista con estado por fila (Nuevo / Duplicado / Transferencia propia / Posible transferencia propia / Emparejada), editable: tipo, categoría, cuenta destino, incluir sí/no. Resumen de totales.
5. Importar → un único `save`. Nada se guarda antes.

### Lectores
| Formato | Detección | Notas |
|---|---|---|
| Trade Republic CSV | cabecera con `transaction_id` y `counterparty_iban` | importe con signo en `amount`; `fee`/`tax` se suman al importe; nombre de `name` o `description`; id = `transaction_id` |
| BBVA PDF | texto «Últimos movimientos» y columnas Fecha/Concepto/Importe/Saldo | fila principal + línea «Fecha valor … <detalle>»; importes `-1000,00` |
| N26 PDF | texto «Extracto preliminar» / BIC `NTSBESM1XXX` | columnas separadas: importes y fechas de reserva a la derecha, bloques de descripción a la izquierda; emparejar por orden y coordenada vertical; importes `+130,00`; IBAN propio en pie de página |
| CSV genérico | cualquier otro CSV | el usuario elige columna fecha, importe (o cargo/abono), concepto; separador `,` o `;`; decimales `,` o `.` |

Cada lector produce `ImportRow {date, amountCents (con signo), description, counterpartyName?, counterpartyIban?, kindHint?, mcc?, externalId}`. Si un PDF no se reconoce: mensaje claro, sin importar nada.

### Clasificación
- Normalización de nombres: minúsculas, sin acentos, espacios colapsados, sin puntuación.
- **Transferencia propia** si nombre de contraparte normalizado == titular normalizado, o IBAN de contraparte == IBAN de una cuenta propia. Nombres parecidos pero distintos («Esterly Ortiz Ortiz») → gasto/ingreso normal. Nombres truncados («ESTERLY O..») → «Posible transferencia propia», decide el usuario.
- Cuenta destino: por IBAN; si no, elegida por el usuario; por defecto «Cuenta externa mía» (se crea como cuenta si no existe).
- TR `BUY` → transferencia de la cuenta a un activo de inversión elegido (por defecto uno con el nombre del fondo). TR `INTEREST_PAYMENT` → ingreso. «Retirada de efectivo» → transferencia a «Efectivo».
- Resto: importe negativo → gasto; positivo → ingreso. Categoría por MCC (TR) y palabras clave (Mercadona/Lidl → Alimentación, Plenergy/Repsol → Transporte, …); sin coincidencia → «Otros».

### Duplicados y emparejamiento
- `externalId`: TR → `tr:<transaction_id>`; PDF → `hash(cuenta|fecha|importe|descripción|n.º de aparición del mismo par)`. Una fila con `externalId` ya existente = Duplicado (desmarcada).
- Una transferencia propia entrante/saliente se **empareja** con una transferencia ya guardada si mismo importe absoluto, mismas cuentas (en sentido inverso) y |Δfecha| ≤ 3 días y no emparejada antes → no se crea nada (queda Emparejada).
- Al importar una transferencia saliente cuyo destino es una cuenta propia, se crea un único movimiento `transfer` que afecta a ambas cuentas.

## Organización del código (apps/web/src)
- `domain.ts`: tipos v2, migración, `summary` excluye transferencias.
- `assets.ts`: `accountBalance`, historial calculado.
- `import/csv.ts`, `import/pdfText.ts`, `import/traderepublic.ts`, `import/bbva.ts`, `import/n26.ts`, `import/genericCsv.ts`, `import/detect.ts`, `import/classify.ts`, `import/dedupe.ts`, `import/types.ts`.
- `ImportFlow.tsx`, `Categories.tsx`, `Settings.tsx` (rehecho).

## Pruebas
- Vitest: cada lector con fixtures **sintéticos** (nombres e IBAN inventados) que imitan la estructura real; para PDF, fixtures de texto posicionado (JSON), no PDFs reales.
- Casos obligatorios: ejemplo TR/N26 de saldos; reimportación sin duplicados; emparejamiento al importar el segundo extracto; «Esterly Ortiz Ortiz» ≠ titular; migración v1→v2; transferencias fuera de informes/presupuesto.
- Prueba manual local con los tres archivos reales de la usuaria. **Nunca** se añaden extractos reales a Git.

## Fase C (referencia)
Todo el guardado pasa por `save(Data)`. En la fase C se sustituye por un adaptador Supabase (Auth por email, datos por usuario con RLS) con subida inicial de los datos locales.

## Riesgos
- Formato N26 PDF frágil: si el emparejamiento por coordenadas no encaja, la fila se marca y el usuario puede excluirla; nunca se inventan importes.
- localStorage (~5 MB) suficiente para cientos de movimientos; avatar limitado a 256 px. IndexedDB sigue pendiente.
