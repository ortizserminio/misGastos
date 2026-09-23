# Ajustes e importación de extractos — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar Ajustes (estilo capturas, morado), mostrar la cabecera solo en inicio e importar extractos CSV/PDF (Trade Republic, BBVA, N26, CSV genérico) con transferencias entre cuentas propias que mueven saldos sin contar como gasto ni ingreso.

**Architecture:** Todo en el navegador. `Data` pasa a v2 (tipo `transfer`, perfil, categorías editables) con migración automática. Los saldos de cuentas con saldo inicial se calculan con los movimientos. Los lectores (`src/import/*`) convierten archivos en `ImportRow`; `classify` decide tipo/categoría/cuenta; `review` detecta duplicados, empareja transferencias y aplica el resultado con un único `save`.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + Testing Library, `pdfjs-dist@4` (build legacy) para PDF.

**Spec:** `docs/superpowers/specs/2026-09-23-ajustes-importacion-design.md`

**Convenciones:** código compacto como el existente; textos de UI en español; fixtures de prueba **sintéticos** (titular «Ana Prueba Ejemplo», IBAN inventados). Nunca añadir extractos reales al repositorio. Comandos desde `apps/web`: `npx vitest run <archivo>`; build `npm run build`.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/domain.ts` (mod) | Tipos v2, `TRANSFER`, categorías/perfil por defecto, validación y migración |
| `src/assets.ts` (mod) | `iban`, `openingBalance`, `accountDelta`, `accountBalance`, `assetSeries`, `portfolioHistory` con movimientos |
| `src/import/common.ts` | Tipos `ImportRow`/`ParsedStatement`, `parseAmount`, `parseDate`, `hash`, `withIds` |
| `src/import/csv.ts` | Parser CSV (comillas, separador `,` `;` tab, BOM) |
| `src/import/traderepublic.ts` | Lector CSV Trade Republic |
| `src/import/pdfText.ts` | Texto posicionado con pdfjs |
| `src/import/bbva.ts` | Lector PDF BBVA «Últimos movimientos» |
| `src/import/n26.ts` | Lector PDF N26 «Extracto» |
| `src/import/genericCsv.ts` | Mapeo de columnas para cualquier CSV |
| `src/import/detect.ts` | Elegir lector según archivo |
| `src/import/classify.ts` | Titular, IBAN/entidad, tipo, categoría |
| `src/import/review.ts` | Duplicados, emparejamiento, aplicar |
| `src/ImportFlow.tsx` + `src/import.css` | Pantalla de importación |
| `src/Settings.tsx` (reescrito) + `src/settings.css` | Ajustes estilo capturas |
| `src/Categories.tsx` | Gestión de categorías |
| `src/components.tsx`, `Reports.tsx`, `TransactionModal.tsx`, `Patrimonio.tsx`, `App.tsx` (mod) | Integración |

---

### Task 1: Dependencia pdfjs y línea base

**Files:** Modify `apps/web/package.json`, `apps/web/package-lock.json`

- [ ] **Step 1:** `cd apps/web && npm install pdfjs-dist@^4.10.38`
- [ ] **Step 2:** `npx vitest run` → Expected: 11 passed.
- [ ] **Step 3:** Commit `git add package.json package-lock.json && git commit -m "Añade pdfjs-dist para leer extractos PDF"`

### Task 2: Modelo de datos v2 y migración

**Files:** Modify `src/domain.ts`; Test `src/domain.test.ts`

- [ ] **Step 1: Tests que fallan** — añadir al final de `domain.test.ts`:

```ts
describe('data v2',()=>{
 it('migrates v1 backups adding default categories and empty profile',()=>{const v1={version:1,transactions:[tx],accounts:['Efectivo'],budgets:{}};const d=validateBackup(JSON.stringify(v1));expect(d.version).toBe(2);expect(d.categories.map(c=>c.name)).toContain('Alimentación');expect(d.profile).toEqual({displayName:'',ownerName:''});});
 it('accepts transfers between different accounts and excludes them from totals',()=>{const t={...tx,id:'tr',type:'transfer' as const,bank:'TR',toAccount:'N26',category:'Transferencia',source:'import' as const,externalId:'tr:1'};const d={...emptyData(),transactions:[tx,t]};expect(validateBackup(JSON.stringify(d)).transactions).toHaveLength(2);expect(()=>validateBackup(JSON.stringify({...d,transactions:[{...t,toAccount:'TR'}]}))).toThrow();const s=summary([tx,t],'2026-09');expect(s.expense).toBe(1050);expect(s.income).toBe(0);});
 it('rejects duplicated category names',()=>{expect(()=>validateBackup(JSON.stringify({...emptyData(),categories:[{name:'Ocio',color:'#7c3aed'},{name:'ocio',color:'#7c3aed'}]}))).toThrow();});
});
```

- [ ] **Step 2:** `npx vitest run src/domain.test.ts` → FAIL (version 1 / transfer no válido).
- [ ] **Step 3: Implementación** en `domain.ts`:
  - Sustituir las líneas de `Transaction` y `Data` por:

```ts
export type Transaction={id:string;type:'expense'|'income'|'transfer';amountCents:number;merchant:string;bank:string;toAccount?:string;category:string;date:string;source:'manual'|'shortcut'|'demo'|'import';externalId?:string;pairedExternalId?:string};
export type Category={name:string;color:string};
export type Profile={displayName:string;ownerName:string;avatar?:string};
export type Data={version:2;transactions:Transaction[];accounts:string[];budgets:Record<string,number>;assets?:Asset[];categories:Category[];profile:Profile};
```

  - Tras `colors` añadir:

```ts
export const TRANSFER='Transferencia';
export const defaultCategories=():Category[]=>categories.map((name,i)=>({name,color:colors[i%colors.length]}));
export const emptyProfile=():Profile=>({displayName:'',ownerName:''});
```

  - `emptyData` → `({version:2,transactions:[],accounts:['Efectivo'],budgets:{},assets:[],categories:defaultCategories(),profile:emptyProfile()})`.
  - `validTransaction` →

```ts
export function validTransaction(t:any):t is Transaction{return t&&text(t.id)&&['expense','income','transfer'].includes(t.type)&&Number.isSafeInteger(t.amountCents)&&t.amountCents>0&&t.amountCents<=99999999&&text(t.merchant)&&text(t.bank)&&text(t.category)&&typeof t.date==='string'&&validDate(t.date)&&['manual','shortcut','demo','import'].includes(t.source)&&(t.externalId===undefined||text(t.externalId))&&(t.pairedExternalId===undefined||text(t.pairedExternalId))&&(t.type==='transfer'?text(t.toAccount)&&t.toAccount!==t.bank:t.toAccount===undefined);}
```

  - `validateBackup`: aceptar `[1,2].includes(value.version)` en lugar de `value.version!==1`; después de la comprobación existente añadir la validación de categorías y perfil y devolver v2:

```ts
 const cats=value.categories??defaultCategories(),profile=value.profile??emptyProfile();
 if(!Array.isArray(cats)||!cats.length||!cats.every((c:any)=>c&&text(c.name)&&c.name.length<=40&&typeof c.color==='string'&&/^#[0-9a-f]{6}$/i.test(c.color))||new Set(cats.map((c:any)=>c.name.toLowerCase())).size!==cats.length)throw Error('Categorías no válidas en la copia.');
 if(!profile||typeof profile.displayName!=='string'||profile.displayName.length>100||typeof profile.ownerName!=='string'||profile.ownerName.length>200||(profile.avatar!==undefined&&(typeof profile.avatar!=='string'||!profile.avatar.startsWith('data:image/')||profile.avatar.length>400000)))throw Error('Perfil no válido en la copia.');
 return {version:2,transactions:value.transactions.map((t:Transaction)=>({id:t.id,type:t.type,amountCents:t.amountCents,merchant:t.merchant,bank:t.bank,...(t.toAccount?{toAccount:t.toAccount}:{}),category:t.category,date:t.date,source:t.source,...(t.externalId?{externalId:t.externalId}:{}),...(t.pairedExternalId?{pairedExternalId:t.pairedExternalId}:{})})),accounts:value.accounts,budgets:value.budgets,assets:validateAssets(value.assets),categories:cats.map((c:any)=>({name:c.name,color:c.color})),profile:{displayName:profile.displayName,ownerName:profile.ownerName,...(profile.avatar?{avatar:profile.avatar}:{})}};
```

- [ ] **Step 4:** `npx vitest run` → todo PASS (incluidos los tests antiguos).
- [ ] **Step 5:** Commit `Añade modelo v2 con transferencias, perfil y categorías`.

### Task 3: Saldos calculados con movimientos

**Files:** Modify `src/assets.ts`; Test `src/assets.test.ts`

- [ ] **Step 1: Tests que fallan** — añadir a `assets.test.ts`:

```ts
import {accountBalance,assetSeries} from './assets';
import type {Transaction} from './domain';
const tr:Asset={id:'tr',type:'Cuenta',bank:'Trade Republic',name:'Trade Republic',color:'#252525',notes:'',valuations:[],openingBalance:{date:'2026-09-01',valueCents:100000}};
const n26:Asset={...tr,id:'n26',bank:'N26',name:'N26',openingBalance:{date:'2026-09-01',valueCents:20000}};
const move=(p:Partial<Transaction>):Transaction=>({id:crypto.randomUUID(),type:'expense',amountCents:100,merchant:'x',bank:'N26',category:'Otros',date:'2026-09-10',source:'import',...p});
it('moves money between own accounts without counting spending',()=>{const list=[move({type:'transfer',amountCents:2000,bank:'Trade Republic',toAccount:'N26',category:'Transferencia'})];expect(accountBalance(tr,list)).toBe(98000);expect(accountBalance(n26,list)).toBe(22000);});
it('applies expenses and incomes from the opening date onwards',()=>{const list=[move({amountCents:500}),move({type:'income',amountCents:300}),move({amountCents:999,date:'2026-08-31'})];expect(accountBalance(n26,list)).toBe(19800);expect(assetSeries(n26,list)).toEqual([{date:'2026-09-01',valueCents:20000},{date:'2026-09-10',valueCents:19800}]);});
it('keeps iban and opening balance through validation',()=>{expect(validateAssets([{...tr,iban:'ES6115860001467451815811'}])[0]).toMatchObject({iban:'ES6115860001467451815811',openingBalance:{date:'2026-09-01',valueCents:100000}});expect(()=>validateAssets([{...tr,iban:'nope'}])).toThrow();});
```

- [ ] **Step 2:** `npx vitest run src/assets.test.ts` → FAIL.
- [ ] **Step 3: Implementación** en `assets.ts`:
  - Primera línea: `import type {Transaction} from './domain';`
  - Tipo: `export type Asset = {id:string;type:typeof assetTypes[number];bank:string;name:string;color:string;notes:string;valuations:{date:string;valueCents:number}[];iban?:string;openingBalance?:{date:string;valueCents:number}};`
  - Añadir `export const cashTypes:readonly string[]=['Cuenta','Efectivo','Ahorro'];`
  - Sustituir `portfolioHistory` por:

```ts
export function accountDelta(name:string,t:Transaction){if(t.type==='transfer')return (t.toAccount===name?t.amountCents:0)-(t.bank===name?t.amountCents:0);if(t.bank!==name)return 0;return t.type==='income'?t.amountCents:-t.amountCents;}
export function accountBalance(asset:Asset,transactions:Transaction[]=[]){const o=asset.openingBalance;if(!o)return assetValue(asset);return transactions.reduce((n,t)=>t.date>=o.date?n+accountDelta(asset.name,t):n,o.valueCents);}
export function assetSeries(asset:Asset,transactions:Transaction[]=[]){const o=asset.openingBalance;if(!o)return [...asset.valuations].sort((a,b)=>a.date.localeCompare(b.date));const byDate=new Map<string,number>([[o.date,0]]);for(const t of transactions){const d=accountDelta(asset.name,t);if(d&&t.date>=o.date)byDate.set(t.date,(byDate.get(t.date)??0)+d);}let value=o.valueCents;return [...byDate].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,d])=>({date,valueCents:value+=d}));}
export function portfolioHistory(assets:Asset[],transactions:Transaction[]=[]){const series=assets.map(a=>assetSeries(a,transactions));const dates=[...new Set(series.flat().map(v=>v.date))].sort();return dates.map(date=>({date,valueCents:series.reduce((sum,s)=>sum+([...s].reverse().find(v=>v.date<=date)?.valueCents??0),0)}));}
```

  - En `validateAssets`: definir `const point=(v:any)=>v&&typeof v.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.date)&&Number.isFinite(Date.parse(v.date))&&new Date(v.date).toISOString().slice(0,10)===v.date&&Number.isSafeInteger(v.valueCents)&&Math.abs(v.valueCents)<=99999999999;`; sustituir `!a.valuations.length||a.valuations.some((v:any)=>!v||…)` por `(!a.valuations.length&&!a.openingBalance)||a.valuations.some((v:any)=>!point(v))||(a.openingBalance!==undefined&&!point(a.openingBalance))||(a.iban!==undefined&&(typeof a.iban!=='string'||!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(a.iban)))`; en el `map` final añadir `...(a.iban?{iban:a.iban}:{}),...(a.openingBalance?{openingBalance:{date:a.openingBalance.date,valueCents:a.openingBalance.valueCents}}:{})`.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `Calcula saldos de cuentas a partir de los movimientos`.

### Task 4: Utilidades comunes y CSV

**Files:** Create `src/import/common.ts`, `src/import/csv.ts`; Test `src/import/common.test.ts`

- [ ] **Step 1: Tests**

```ts
import {describe,it,expect} from 'vitest';
import {parseAmount,parseDate,withIds} from './common';
import {parseCsv} from './csv';
describe('import helpers',()=>{
 it('parses european, dotted and signed amounts to cents',()=>{expect(parseAmount('-1.351,99€')).toBe(-135199);expect(parseAmount('+4,00 €')).toBe(400);expect(parseAmount('-9.490000')).toBe(-949);expect(parseAmount('0.100000')).toBe(10);expect(parseAmount('1.000')).toBe(100000);expect(parseAmount('-1000,00 €')).toBe(-100000);expect(()=>parseAmount('abc')).toThrow();});
 it('parses common date formats',()=>{expect(parseDate('20/04/2026')).toBe('2026-04-20');expect(parseDate('07.09.2026')).toBe('2026-09-07');expect(parseDate('2025-11-01T03:40:59Z')).toBe('2025-11-01');expect(()=>parseDate('31/02/2026')).toThrow();});
 it('numbers identical rows so both survive deduplication',()=>{const r={date:'2026-09-07',amountCents:400,description:'Bizum',kind:'bizum' as const};const [a,b]=withIds('n26',[r,r]);expect(a.externalId).not.toBe(b.externalId);expect(withIds('n26',[r])[0].externalId).toBe(a.externalId);});
 it('reads quoted csv with semicolons and BOM',()=>{expect(parseCsv('﻿a;b\r\n"x;1";"di ""y"""\n')).toEqual([['a','b'],['x;1','di "y"']]);expect(parseCsv('"a","b"\n"1","2"')).toEqual([['a','b'],['1','2']]);});
});
```

- [ ] **Step 2:** `npx vitest run src/import/common.test.ts` → FAIL (módulos inexistentes).
- [ ] **Step 3: `common.ts`**

```ts
import {validDate} from '../domain';
export type RowKind='card'|'transfer'|'bizum'|'interest'|'trade'|'cash'|'salary'|'tax'|'other';
export type ImportRow={date:string;amountCents:number;description:string;kind:RowKind;counterpartyName?:string;counterpartyIban?:string;mcc?:string;bankCategory?:string;instrument?:string;externalId:string};
export type ParsedStatement={format:'traderepublic'|'bbva'|'n26'|'csv';bankName:string;ownIban?:string;opening?:{date:string;valueCents:number};rows:ImportRow[]};
export function parseAmount(raw:string){let v=raw.replace(/[€\s ]/g,'');if(!/^[+-]?\d[\d.,]*$/.test(v))throw Error(`Importe no válido: ${raw}`);const sign=v.startsWith('-')?-1:1;v=v.replace(/^[+-]/,'');const comma=v.lastIndexOf(','),dot=v.lastIndexOf('.');if(comma>dot)v=v.replace(/\./g,'').replace(',','.');else if(comma>=0)v=v.replace(/,/g,'');else if(/^\d{1,3}(\.\d{3})+$/.test(v))v=v.replace(/\./g,'');const n=Number(v);if(!Number.isFinite(n))throw Error(`Importe no válido: ${raw}`);return sign*Math.round(n*100);}
export function parseDate(raw:string){const s=raw.trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/),d='';if(m)d=`${m[1]}-${m[2]}-${m[3]}`;else if((m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)))d=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;if(!validDate(d))throw Error(`Fecha no válida: ${raw}`);return d;}
export function hash(s:string){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');}
export function withIds(prefix:string,rows:Omit<ImportRow,'externalId'>[]):ImportRow[]{const seen=new Map<string,number>();return rows.map(r=>{const key=`${r.date}|${r.amountCents}|${r.description}`,n=(seen.get(key)??0)+1;seen.set(key,n);return {...r,externalId:`${prefix}:${hash(key)}:${n}`};});}
```

- [ ] **Step 4: `csv.ts`**

```ts
export function parseCsv(text:string):string[][]{
 const src=text.replace(/^﻿/,''),first=src.split(/\r?\n/,1)[0]??'';
 const count=(c:string)=>{let n=0,q=false;for(const ch of first){if(ch==='"')q=!q;else if(ch===c&&!q)n++;}return n;};
 const sep=count(';')>count(',')?';':count('\t')>count(',')?'\t':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 const end=()=>{row.push(cell);cell='';if(row.some(c=>c.trim()))rows.push(row);row=[];};
 for(let i=0;i<src.length;i++){const ch=src[i];
  if(quoted){if(ch==='"'){if(src[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=ch;continue;}
  if(ch==='"')quoted=true;else if(ch===sep){row.push(cell);cell='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&src[i+1]==='\n')i++;end();}else cell+=ch;}
 end();return rows;
}
```

- [ ] **Step 5:** tests PASS → Commit `Añade utilidades de importación y lector CSV`.

### Task 5: Lector Trade Republic

**Files:** Create `src/import/traderepublic.ts`; Test `src/import/traderepublic.test.ts`

- [ ] **Step 1: Test** (CSV sintético con la cabecera real)

```ts
import {it,expect} from 'vitest';
import {parseCsv} from './csv';
import {isTradeRepublic,parseTradeRepublic} from './traderepublic';
const H='"datetime","date","account_type","category","type","asset_class","name","symbol","shares","price","amount","fee","tax","currency","original_amount","original_currency","fx_rate","description","transaction_id","counterparty_name","counterparty_iban","payment_reference","mcc_code"';
const row=(date:string,type:string,name:string,amount:string,tax:string,description:string,id:string,mcc='')=>`"${date}T10:00:00Z","${date}","DEFAULT","CASH","${type}","","${name}","","","","${amount}","","${tax}","EUR","","","","${description}","${id}","","","","${mcc}"`;
const csv=[H,row('2026-09-01','INTEREST_PAYMENT','','0.100000','-0.02','Interest payment for payout','i1'),row('2026-09-02','TRANSFER_INSTANT_INBOUND','','1000.000000','','Incoming transfer from ANA PRUEBA EJEMPLO (ES6400000000000000000001)','t1'),row('2026-09-03','TRANSFER_INSTANT_OUTBOUND','','-20.000000','','Outgoing transfer for Ana Prueba Ejemplo  (ES7215630000000000000002)','t2'),row('2026-09-04','CARD_TRANSACTION','LIDL PRUEBA','-9.490000','','LIDL PRUEBAnull','c1','5411'),`"2026-09-05T10:00:00Z","2026-09-05","DEFAULT","TRADING","BUY","FUND","Core S&P 500 USD (Acc)","IE00B5BMR087","0.15","629.4","-100.00","","","EUR","","","","Savings plan execution","b1","","","",""`].join('\n');
it('reads trade republic rows with net interest, counterparties and trades',()=>{const rows=parseCsv(csv);expect(isTradeRepublic(rows[0])).toBe(true);const st=parseTradeRepublic(rows);expect(st.bankName).toBe('Trade Republic');expect(st.rows.map(r=>[r.kind,r.amountCents])).toEqual([['interest',8],['transfer',100000],['transfer',-2000],['card',-949],['trade',-10000]]);expect(st.rows[1]).toMatchObject({counterpartyName:'ANA PRUEBA EJEMPLO',counterpartyIban:'ES6400000000000000000001',externalId:'tr:t1'});expect(st.rows[2].counterpartyName).toBe('Ana Prueba Ejemplo');expect(st.rows[3]).toMatchObject({description:'LIDL PRUEBA',mcc:'5411'});expect(st.rows[4].instrument).toBe('Core S&P 500 USD (Acc)');});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementación**

```ts
import {type ImportRow,type ParsedStatement,type RowKind,parseAmount,parseDate} from './common';
export const isTradeRepublic=(header:string[])=>['transaction_id','counterparty_iban','asset_class'].every(h=>header.includes(h));
function kindOf(type:string):RowKind{if(type.startsWith('CARD_TRANSACTION'))return 'card';if(type.startsWith('TRANSFER'))return 'transfer';if(type==='INTEREST_PAYMENT')return 'interest';if(type==='BUY'||type==='SELL')return 'trade';return 'other';}
export function parseTradeRepublic(rows:string[][]):ParsedStatement{
 const [header,...body]=rows,col=(r:string[],n:string)=>(r[header.indexOf(n)]??'').trim(),out:ImportRow[]=[];
 for(const r of body){
  const id=col(r,'transaction_id');if(!id)continue;
  const amountCents=['amount','fee','tax'].reduce((n,c)=>n+(col(r,c)?parseAmount(col(r,c)):0),0);if(!amountCents)continue;
  const kind=kindOf(col(r,'type')),description=col(r,'description'),name=col(r,'name');
  const m=description.match(/^(?:Incoming transfer from|Outgoing transfer for)\s+(.+?)\s*(?:\(([A-Z]{2}\d{2}[A-Z0-9]{10,30})\))?\s*$/);
  const counterpartyName=col(r,'counterparty_name')||m?.[1],counterpartyIban=col(r,'counterparty_iban')||m?.[2];
  const label=kind==='card'||kind==='trade'?name:kind==='interest'?'Intereses Trade Republic':counterpartyName;
  out.push({date:parseDate(col(r,'date')||col(r,'datetime')),amountCents,kind,description:(label||description.replace(/null$/,'')||col(r,'type')).slice(0,200),...(kind!=='card'&&counterpartyName?{counterpartyName}:{}),...(counterpartyIban?{counterpartyIban}:{}),...(col(r,'mcc_code')?{mcc:col(r,'mcc_code')}:{}),...(kind==='trade'?{instrument:name||col(r,'symbol')}:{}),externalId:`tr:${id}`});
 }
 if(!out.length)throw Error('No hay movimientos en este CSV de Trade Republic.');
 return {format:'traderepublic',bankName:'Trade Republic',rows:out};
}
```

- [ ] **Step 4:** PASS → Commit `Añade lector CSV de Trade Republic`.

### Task 6: Texto de PDF y lector BBVA

**Files:** Create `src/import/pdfText.ts`, `src/import/bbva.ts`; Test `src/import/bbva.test.ts`

- [ ] **Step 1: `pdfText.ts`** (no se prueba en Vitest; se verifica en navegador en Task 13)

```ts
export type PdfItem={x:number;y:number;str:string};export type PdfPage=PdfItem[];
export async function readPdf(data:ArrayBuffer):Promise<PdfPage[]>{
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
 const doc=await pdfjs.getDocument({data:new Uint8Array(data)}).promise,pages:PdfPage[]=[];
 for(let n=1;n<=doc.numPages;n++){const content=await (await doc.getPage(n)).getTextContent();pages.push(content.items.flatMap(i=>'str' in i&&i.str.trim()?[{x:i.transform[4],y:i.transform[5],str:i.str.trim()}]:[]));}
 await doc.destroy();return pages;
}
export const pdfText=(pages:PdfPage[])=>pages.flat().map(i=>i.str).join(' ');
```

- [ ] **Step 2: Test BBVA** (coordenadas copiadas de la estructura real, datos inventados)

```ts
import {it,expect} from 'vitest';
import {isBbva,parseBbva} from './bbva';
const w=(x:number,y:number,str:string)=>({x,y,str});
const page=[w(40,731,'Últimos'),w(129,731,'movimientos'),w(45,701,'Fecha'),w(145,701,'Concepto'),w(440,701,'Importe'),w(504,701,'Saldo'),
 w(45,681,'20/04/2026'),w(145,681,'TRANSFERENCIA'),w(234,681,'REALIZADA'),w(454,683,'-10,00 €'),w(522,683,'1,74 €'),w(45,671,'Fecha'),w(68,671,'valor'),w(88,671,'18/04/2026'),w(145,671,'PARA'),w(168,671,'Ana'),w(195,671,'Prueba'),w(230,671,'Ejemplo'),
 w(45,652,'02/04/2026'),w(145,652,'ABONO'),w(180,652,'DE'),w(200,652,'NÓMINA'),w(452,654,'660,16 €'),w(517,654,'11,74 €'),w(45,642,'Fecha'),w(68,642,'valor'),w(88,642,'02/04/2026'),w(145,642,'EMPRESA'),w(190,642,'DEMO'),
 w(45,623,'01/04/2026'),w(145,623,'RETIRADA'),w(190,623,'DE'),w(205,623,'EFECTIVO'),w(440,625,'-1000,00 €'),w(515,625,'-648,42 €'),w(45,613,'Fecha'),w(68,613,'valor'),w(88,613,'01/04/2026'),w(145,613,'CAJERO'),
 w(218,24,'Registro'),w(349,24,'Mercantil')];
it('reads bbva rows, own transfer counterparty and opening balance',()=>{expect(isBbva([page])).toBe(true);const st=parseBbva([page]);expect(st.rows.map(r=>[r.date,r.amountCents,r.kind])).toEqual([['2026-04-20',-1000,'transfer'],['2026-04-02',66016,'salary'],['2026-04-01',-100000,'cash']]);expect(st.rows[0]).toMatchObject({counterpartyName:'Ana Prueba Ejemplo',description:'TRANSFERENCIA REALIZADA · PARA Ana Prueba Ejemplo'});expect(st.opening).toEqual({date:'2026-04-01',valueCents:35158});expect(st.rows[0].externalId).toMatch(/^bbva:/);});
```

- [ ] **Step 3:** FAIL.
- [ ] **Step 4: `bbva.ts`**

```ts
import {type ParsedStatement,type RowKind,type ImportRow,parseAmount,parseDate,withIds} from './common';
import {type PdfItem,type PdfPage,pdfText} from './pdfText';
const DATE=/^\d{2}\/\d{2}\/\d{4}$/,MONEY=/^-?[\d.]+,\d{2}\s*€$/;
export const isBbva=(pages:PdfPage[])=>/Últimos\s+movimientos/i.test(pdfText(pages))&&pages.some(p=>['Concepto','Importe','Saldo'].every(h=>p.some(i=>i.str===h)));
function lines(items:PdfItem[]){const out:PdfItem[][]=[];for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){const line=out.find(l=>Math.abs(l[0].y-it.y)<=3);if(line)line.push(it);else out.push([it]);}return out.map(l=>l.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' '));}
function kindOf(concept:string):RowKind{const c=concept.toUpperCase();if(c.includes('RETIRADA DE EFECTIVO'))return 'cash';if(c.includes('TRANSFERENCIA'))return 'transfer';if(c.includes('BIZUM'))return 'bizum';if(/N[ÓO]MINA/.test(c))return 'salary';if(c.includes('IMPUESTO'))return 'tax';if(/TARJETA|COMPRA/.test(c))return 'card';return 'other';}
export function parseBbva(pages:PdfPage[]):ParsedStatement{
 const raw:Omit<ImportRow,'externalId'>[]=[];let last:{date:string;amount:number;balance:number}|undefined;
 for(const page of pages){
  const h=(s:string)=>page.find(i=>i.str===s),fecha=h('Fecha'),concepto=h('Concepto'),importe=h('Importe'),saldo=h('Saldo');
  if(!fecha||!concepto||!importe||!saldo)continue;
  const starts=page.filter(i=>DATE.test(i.str)&&Math.abs(i.x-fecha.x)<6&&i.y<fecha.y).sort((a,b)=>b.y-a.y);
  starts.forEach((start,k)=>{
   const bottom=Math.max(starts[k+1]?.y??-Infinity,start.y-22),own=page.filter(i=>i.y<=start.y+4&&i.y>bottom+4);
   const amount=own.find(i=>MONEY.test(i.str)&&i.x>=importe.x-40&&i.x<saldo.x-5&&Math.abs(i.y-start.y)<=5);if(!amount)return;
   const balance=own.find(i=>MONEY.test(i.str)&&i.x>=saldo.x-10&&Math.abs(i.y-start.y)<=5);
   const [concept='',...rest]=lines(own.filter(i=>i.x>=concepto.x-2&&i.x<importe.x-40)),detail=rest.join(' ').trim();
   const to=concept.toUpperCase().includes('TRANSFERENCIA REALIZADA')?detail.match(/^PARA\s+(.+)$/i)?.[1]:undefined;
   const row={date:parseDate(start.str),amountCents:parseAmount(amount.str),kind:kindOf(concept),description:[concept,detail].filter(Boolean).join(' · ').slice(0,200),...(to?{counterpartyName:to}:{})};
   if(!row.amountCents)return;raw.push(row);if(balance)last={date:row.date,amount:row.amountCents,balance:parseAmount(balance.str)};
  });
 }
 if(!raw.length)throw Error('No he encontrado movimientos en este PDF de BBVA.');
 return {format:'bbva',bankName:'BBVA',rows:withIds('bbva',raw),...(last?{opening:{date:last.date,valueCents:last.balance-last.amount}}:{})};
}
```

- [ ] **Step 5:** PASS → Commit `Añade lector PDF de BBVA`.

### Task 7: Lector N26

**Files:** Create `src/import/n26.ts`; Test `src/import/n26.test.ts`

- [ ] **Step 1: Test**

```ts
import {it,expect} from 'vitest';
import {isN26,parseN26} from './n26';
const w=(x:number,y:number,str:string)=>({x,y,str});
const footer=[w(43,69,'ANA PRUEBA EJEMPLO'),w(43,38,'IBAN: ES7215630000000000000002 • BIC: NTSBESM1XXX'),w(506,69,'Emitido en'),w(533,21,'1 / 2')];
const p1=[w(44,790,'Extracto preliminar'),w(44,756,'01.09.2026 hasta 21.09.2026'),w(45,704,'Descripción'),w(356,704,'Fecha de reserva'),w(502,704,'Cantidad'),
 w(44,678,'ANA PRUEBA EJEMPLO'),w(44,664,'Ingresos'),w(44,648,'IBAN: ES6400000000000000000001 • BIC: BBVAESMMXXX'),w(44,632,'SIN CONCEPTO'),w(44,616,'Fecha de valor 02.09.2026'),w(388,676,'02.09.2026'),w(501,676,'+130,00€'),
 w(44,590,'Persona Ajena S.B.'),w(44,577,'Bizum Enviado'),w(44,561,'+34600000000'),w(44,545,'Seguro de coche'),w(44,529,'Fecha de valor 03.09.2026'),w(388,588,'03.09.2026'),w(499,588,'-1.312,00€'),
 w(44,503,'MERCADO PRUEBA'),w(44,490,'Mastercard • Comida'),w(44,474,'Fecha de valor 04.09.2026'),w(388,501,'04.09.2026'),w(512,501,'-9,00€'),...footer];
const p2=[w(44,790,'Resumen'),w(44,756,'01.09.2026 hasta 21.09.2026'),w(45,704,'Descripción'),w(44,676,'Saldo previo'),w(508,677,'+10,20€'),w(45,597,'Tu nuevo saldo'),w(512,597,'+0,20€'),...footer];
it('pairs n26 amounts with their description blocks',()=>{expect(isN26([p1,p2])).toBe(true);const st=parseN26([p1,p2]);expect(st.ownIban).toBe('ES7215630000000000000002');expect(st.opening).toEqual({date:'2026-09-01',valueCents:1020});expect(st.rows.map(r=>[r.date,r.amountCents,r.kind])).toEqual([['2026-09-02',13000,'transfer'],['2026-09-03',-131200,'bizum'],['2026-09-04',-900,'card']]);expect(st.rows[0]).toMatchObject({counterpartyName:'ANA PRUEBA EJEMPLO',counterpartyIban:'ES6400000000000000000001'});expect(st.rows[1].description).toBe('Persona Ajena S.B. · Seguro de coche');expect(st.rows[2]).toMatchObject({description:'MERCADO PRUEBA',bankCategory:'Comida'});expect(st.rows[2].counterpartyName).toBeUndefined();});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: `n26.ts`**

```ts
import {type ParsedStatement,type RowKind,type ImportRow,parseAmount,parseDate,withIds} from './common';
import {type PdfPage,pdfText} from './pdfText';
const DATE=/^\d{2}\.\d{2}\.\d{4}$/,MONEY=/^[+-][\d.]+,\d{2}\s*€$/;
export const isN26=(pages:PdfPage[])=>/NTSBESM1XXX/.test(pdfText(pages))||(/Extracto/.test(pdfText(pages))&&pages.some(p=>p.some(i=>i.str==='Fecha de reserva')));
function kindOf(type:string):RowKind{if(/^Mastercard/i.test(type))return 'card';if(/^Bizum/i.test(type))return 'bizum';if(/^(Ingresos|Transferencias)/i.test(type))return 'transfer';return 'other';}
export function parseN26(pages:PdfPage[]):ParsedStatement{
 const all=pdfText(pages),ownIban=all.match(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]{10,30})\s*•\s*BIC:\s*NTSBESM1XXX/)?.[1],period=all.match(/(\d{2}\.\d{2}\.\d{4})\s+hasta/)?.[1];
 const raw:Omit<ImportRow,'externalId'>[]=[];let opening:ParsedStatement['opening'];
 for(const page of pages){
  const prev=page.find(i=>i.str==='Saldo previo');
  if(prev&&period&&!opening){const v=page.find(i=>MONEY.test(i.str)&&Math.abs(i.y-prev.y)<=4);if(v)opening={date:parseDate(period),valueCents:parseAmount(v.str)};}
  const reserva=page.find(i=>i.str==='Fecha de reserva'),desc=page.find(i=>i.str==='Descripción');if(!reserva||!desc)continue;
  const footer=page.find(i=>i.str==='Emitido en')?.y??60;
  const amounts=page.filter(i=>MONEY.test(i.str)&&i.x>reserva.x+80&&i.y<reserva.y).sort((a,b)=>b.y-a.y);
  amounts.forEach((amount,k)=>{
   const date=page.find(i=>DATE.test(i.str)&&i.x>=reserva.x-10&&i.x<reserva.x+80&&Math.abs(i.y-amount.y)<=6);if(!date)return;
   const bottom=Math.max(amounts[k+1]?.y??-Infinity,footer)+6;
   const lines=page.filter(i=>i.x<reserva.x-20&&i.y<=amount.y+8&&i.y>bottom&&i.y<desc.y-5).sort((a,b)=>b.y-a.y).map(i=>i.str).filter(s=>!/^Fecha de valor/i.test(s));
   const [name='',type='',...rest]=lines,kind=kindOf(type),iban=rest.join(' ').match(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]{10,30})/)?.[1];
   const concept=rest.filter(s=>!/^IBAN:/.test(s)&&!/^Enviada desde N26$/i.test(s)&&!/^\+?\d{9,}$/.test(s.replace(/\s/g,''))&&!/^sin concepto$/i.test(s)).join(' ');
   raw.push({date:parseDate(date.str),amountCents:parseAmount(amount.str),kind,description:([name,concept].filter(Boolean).join(' · ')||type||'Movimiento N26').slice(0,200),...(kind!=='card'&&name?{counterpartyName:name}:{}),...(iban?{counterpartyIban:iban}:{}),...(kind==='card'&&type.includes('•')?{bankCategory:type.split('•')[1].trim()}:{})});
  });
 }
 if(!raw.length)throw Error('No he encontrado movimientos en este PDF de N26.');
 return {format:'n26',bankName:'N26',...(ownIban?{ownIban}:{}),...(opening?{opening}:{}),rows:withIds(`n26${ownIban?'-'+ownIban.slice(-4):''}`,raw)};
}
```

- [ ] **Step 4:** PASS → Commit `Añade lector PDF de N26`.

### Task 8: CSV genérico y detección de formato

**Files:** Create `src/import/genericCsv.ts`, `src/import/detect.ts`; Test `src/import/genericCsv.test.ts`

- [ ] **Step 1: Test**

```ts
import {it,expect} from 'vitest';
import {guessMapping,parseGenericCsv} from './genericCsv';
it('guesses columns and reads any bank csv',()=>{const rows=[['Fecha','Concepto','Importe'],['01/09/2026','Supermercado','-12,30'],['02/09/2026','Nómina','1.200,00']];const m=guessMapping(rows[0]);expect(m).toEqual({date:0,description:1,amount:2});const st=parseGenericCsv(rows,m,'Mi banco');expect(st.rows.map(r=>r.amountCents)).toEqual([-1230,120000]);expect(st.rows[0].externalId).toMatch(/^csv-mi-banco:/);expect(()=>parseGenericCsv(rows,{...m,amount:-1},'X')).toThrow();});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: `genericCsv.ts`** (`normalizeName` se define en Task 9; para no depender, se usa una función local)

```ts
import {type ParsedStatement,type ImportRow,parseAmount,parseDate,withIds} from './common';
export type CsvMapping={date:number;description:number;amount:number};
const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const find=(h:string[],re:RegExp)=>h.findIndex(c=>re.test(norm(c)));
export const guessMapping=(header:string[]):CsvMapping=>({date:find(header,/fecha|date/),description:find(header,/concepto|descripcion|description|comercio|detalle|name/),amount:find(header,/importe|amount|cantidad|valor/)});
export function parseGenericCsv(rows:string[][],m:CsvMapping,bankName:string):ParsedStatement{
 if([m.date,m.amount,m.description].some(i=>i<0))throw Error('Elige las columnas de fecha, importe y concepto.');
 const raw:Omit<ImportRow,'externalId'>[]=[];
 rows.slice(1).forEach((r,i)=>{try{const amountCents=parseAmount(r[m.amount]??'');if(amountCents)raw.push({date:parseDate(r[m.date]??''),amountCents,kind:'other',description:((r[m.description]??'').trim()||'Movimiento importado').slice(0,200)});}catch(e){throw Error(`Fila ${i+2}: ${(e as Error).message}`);}});
 if(!raw.length)throw Error('No hay movimientos en este CSV.');
 return {format:'csv',bankName,rows:withIds(`csv-${norm(bankName).replace(/ /g,'-')||'banco'}`,raw)};
}
```

- [ ] **Step 4: `detect.ts`**

```ts
import {type ParsedStatement} from './common';
import {parseCsv} from './csv';
import {isTradeRepublic,parseTradeRepublic} from './traderepublic';
import {readPdf,type PdfPage} from './pdfText';
import {isN26,parseN26} from './n26';
import {isBbva,parseBbva} from './bbva';
export type Detected={kind:'statement';statement:ParsedStatement}|{kind:'csv';rows:string[][]};
export async function readStatement(file:File):Promise<Detected>{
 if(file.size>10*1024*1024)throw Error('El archivo supera 10 MB.');
 const buffer=await file.arrayBuffer();
 if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){
  let pages:PdfPage[];try{pages=await readPdf(buffer);}catch{throw Error('No he podido abrir el PDF. Comprueba que no tenga contraseña.');}
  if(isN26(pages))return {kind:'statement',statement:parseN26(pages)};
  if(isBbva(pages))return {kind:'statement',statement:parseBbva(pages)};
  throw Error('No reconozco este PDF. Por ahora leo extractos de N26 y BBVA («Últimos movimientos»). De otros bancos, importa su CSV.');
 }
 let text=new TextDecoder('utf-8').decode(buffer);if(text.includes('�'))text=new TextDecoder('windows-1252').decode(buffer);
 const rows=parseCsv(text);if(rows.length<2)throw Error('El CSV está vacío.');
 return isTradeRepublic(rows[0])?{kind:'statement',statement:parseTradeRepublic(rows)}:{kind:'csv',rows};
}
```

- [ ] **Step 5:** `npx vitest run src/import` PASS; `npx tsc -b` sin errores → Commit `Añade CSV genérico y detección de formato`.

### Task 9: Clasificación (titular, IBAN, categorías)

**Files:** Create `src/import/classify.ts`; Test `src/import/classify.test.ts`

- [ ] **Step 1: Test**

```ts
import {it,expect} from 'vitest';
import {ownerMatch,classify,EXTERNAL} from './classify';
import type {Asset} from '../assets';
import type {ImportRow} from './common';
const owner='Ana Prueba Ejemplo';
const acc=(name:string,bank:string,iban?:string):Asset=>({id:name,type:'Cuenta',bank,name,color:'#111111',notes:'',valuations:[],openingBalance:{date:'2026-09-01',valueCents:0},...(iban?{iban}:{})});
const assets=[acc('Trade Republic','Trade Republic'),acc('N26','N26','ES7215630000000000000002'),acc('BBVA','BBVA'),{...acc('Efectivo','Efectivo'),type:'Efectivo' as const}];
const ctx={account:'Trade Republic',owner,assets,categories:['Alimentación','Transporte','Restauración','Otros']};
const r=(p:Partial<ImportRow>):ImportRow=>({date:'2026-09-03',amountCents:-2000,description:'x',kind:'transfer',externalId:'tr:1',...p});
it('matches the owner ignoring case, accents and spacing, but not similar names',()=>{expect(ownerMatch('ANA  PRUEBA EJÉMPLO',owner)).toBe('yes');expect(ownerMatch('Ana Prueba Ortiz',owner)).toBe('no');expect(ownerMatch('ANA P..',owner)).toBe('maybe');expect(ownerMatch('Otra P.E.',owner)).toBe('no');expect(ownerMatch('Ana Prueba',owner)).toBe('maybe');});
it('turns own transfers into transfers and finds the other account',()=>{expect(classify(r({counterpartyName:owner,counterpartyIban:'ES7215630000000000000002'}),ctx)).toMatchObject({type:'transfer',other:'N26',own:'yes'});expect(classify(r({counterpartyName:owner,counterpartyIban:'ES6401820000000000000001',amountCents:5000}),ctx)).toMatchObject({type:'transfer',other:'BBVA'});expect(classify(r({counterpartyName:owner}),ctx).other).toBe(EXTERNAL);expect(classify(r({description:'Transferencia a Ana Prueba Ejemplo'}),ctx).type).toBe('transfer');});
it('keeps strangers and card payments as spending with a guessed category',()=>{expect(classify(r({counterpartyName:'Ana Prueba Ortiz'}),ctx)).toMatchObject({type:'expense',own:'no'});expect(classify(r({kind:'card',description:'LIDL X',mcc:'5411'}),ctx).category).toBe('Alimentación');expect(classify(r({kind:'card',description:'PLENERGY 131'}),ctx).category).toBe('Transporte');expect(classify(r({kind:'card',description:'DISNEY PLUS',bankCategory:'Multimedia'}),ctx).category).toBe('Otros');expect(classify(r({kind:'interest',amountCents:8}),ctx)).toMatchObject({type:'income',category:'Intereses'});});
it('treats trades and cash withdrawals as transfers',()=>{expect(classify(r({kind:'trade',instrument:'Fondo X',amountCents:-10000}),ctx)).toMatchObject({type:'transfer',other:'Fondo X'});expect(classify(r({kind:'cash',amountCents:-30000}),ctx)).toMatchObject({type:'transfer',other:'Efectivo'});});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: `classify.ts`**

```ts
import type {Asset} from '../assets';
import type {ImportRow} from './common';
export const EXTERNAL='Cuenta externa mía';
const CASH=['Cuenta','Efectivo','Ahorro'];
export const normalizeName=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function ownerMatch(name:string|undefined,owner:string):'yes'|'maybe'|'no'{
 if(!name||!owner.trim())return 'no';const a=normalizeName(name),b=normalizeName(owner);if(!a)return 'no';if(a===b)return 'yes';
 const at=a.split(' '),bt=b.split(' ');if(at.length<2||at.length>bt.length||at[0]!==bt[0])return 'no';
 return at.every((t,i)=>bt[i].startsWith(t))&&(at.length<bt.length||at.some((t,i)=>t!==bt[i]))?'maybe':'no';
}
const ENTITIES:Record<string,string>={'0182':'BBVA','1563':'N26','1586':'Trade Republic','0049':'Santander','2100':'CaixaBank','1465':'ING','0081':'Sabadell','0128':'Bankinter','2085':'Ibercaja','0073':'Openbank'};
export const bankFromIban=(iban?:string)=>iban&&/^ES\d{22}$/.test(iban)?ENTITIES[iban.slice(4,8)]:undefined;
const MCC:[string,number[]][]=[['Alimentación',[5411,5412,5422,5441,5451,5462,5499]],['Transporte',[4111,4121,4131,4784,4789,5172,5541,5542,7523]],['Restauración',[5812,5813,5814]],['Salud',[5122,5912,8011,8021,8062,8099]],['Suscripciones',[4899,5815,5816,5817,5818]],['Ocio',[7832,7922,7941,7991,7996,7997]],['Hogar',[4900,5200,5251,5712,5719,5722]],['Compras',[5310,5311,5331,5621,5651,5661,5691,5699,5732,5941,5942,5945,5999]]];
const WORDS:[string,RegExp][]=[['Suscripciones',/\b(netflix|spotify|disney|hbo|prime video|amazon prime|icloud|apple com|youtube)\b/],['Alimentación',/\b(mercadona|lidl|carrefour|aldi|dia|consum|eroski|alcampo|hipercor|supermercado|masymas|comida|alimentacion)\b/],['Transporte',/\b(plenergy|repsol|cepsa|galp|shell|ballenoil|petroprix|renfe|alsa|metro|uber|cabify|bolt|gasolinera|parking|peaje|transporte)\b/],['Restauración',/\b(restaurante|restaurantes|bares|bar|cafe|cafeteria|burger|mcdonalds|kfc|telepizza|glovo)\b/],['Salud',/\b(farmacia|clinica|dental|hospital|optica|salud)\b/],['Ocio',/\b(cine|cines|teatro|steam|playstation|nintendo|ocio)\b/],['Hogar',/\b(ikea|leroy|iberdrola|endesa|naturgy|comunidad|alquiler|hogar)\b/],['Compras',/\b(amazon|zara|primark|decathlon|north face|corte ingles|shein|aliexpress|compras)\b/]];
export function guessCategory(row:ImportRow){const m=Number(row.mcc);for(const [c,codes] of MCC)if(codes.includes(m))return c;const t=normalizeName(`${row.description} ${row.bankCategory??''}`);for(const [c,re] of WORDS)if(re.test(t))return c;return 'Otros';}
export type Suggestion={type:'expense'|'income'|'transfer';category:string;other:string;own:'yes'|'maybe'|'no'};
export type Context={account:string;owner:string;assets:Asset[];categories:string[]};
export function classify(row:ImportRow,ctx:Context):Suggestion{
 const cash=ctx.assets.filter(a=>CASH.includes(a.type)&&a.name!==ctx.account);
 if(row.kind==='trade')return {type:'transfer',category:'',other:ctx.assets.find(a=>a.type==='Inversión'&&a.name===row.instrument)?.name??row.instrument??'Inversión',own:'yes'};
 if(row.kind==='cash')return {type:'transfer',category:'',other:ctx.assets.find(a=>a.type==='Efectivo')?.name??'Efectivo',own:'yes'};
 const exact=row.counterpartyIban?cash.find(a=>a.iban===row.counterpartyIban)?.name:undefined;
 const byName=ownerMatch(row.counterpartyName,ctx.owner),inText=!row.counterpartyName&&normalizeName(ctx.owner).split(' ').length>1&&` ${normalizeName(row.description)} `.includes(` ${normalizeName(ctx.owner)} `);
 const own=row.kind==='card'?'no':exact||inText?'yes':byName;
 if(own==='yes'){const bank=bankFromIban(row.counterpartyIban);return {type:'transfer',category:'',other:exact??(bank?cash.find(a=>a.bank===bank)?.name:undefined)??EXTERNAL,own};}
 if(row.amountCents>0)return {type:'income',category:row.kind==='salary'?'Nómina':row.kind==='interest'?'Intereses':'Otros',other:'',own};
 const guess=guessCategory(row);return {type:'expense',category:ctx.categories.includes(guess)?guess:'Otros',other:'',own};
}
```

- [ ] **Step 4:** PASS → Commit `Clasifica movimientos importados y detecta transferencias propias`.

### Task 10: Revisión, duplicados y emparejamiento

**Files:** Create `src/import/review.ts`; Test `src/import/review.test.ts`

- [ ] **Step 1: Test** (escenario de aceptación de la usuaria)

```ts
import {it,expect} from 'vitest';
import {buildReview,applyReview} from './review';
import {emptyData,summary,type Data} from '../domain';
import {accountBalance,type Asset} from '../assets';
import type {ParsedStatement} from './common';
const acc=(name:string,iban:string,value:number):Asset=>({id:name,type:'Cuenta',bank:name,name,color:'#111111',notes:'',valuations:[],iban,openingBalance:{date:'2026-09-01',valueCents:value}});
const base:Data={...emptyData(),profile:{displayName:'',ownerName:'Ana Prueba Ejemplo'},assets:[acc('Trade Republic','ES6115860000000000000003',100000),acc('N26','ES7215630000000000000002',20000),acc('BBVA','ES6401820000000000000001',5000)]};
const trFile:ParsedStatement={format:'traderepublic',bankName:'Trade Republic',rows:[{date:'2026-09-10',amountCents:-2000,kind:'transfer',description:'Ana Prueba Ejemplo',counterpartyName:'Ana Prueba Ejemplo',counterpartyIban:'ES7215630000000000000002',externalId:'tr:t1'},{date:'2026-09-11',amountCents:-949,kind:'card',description:'LIDL',mcc:'5411',externalId:'tr:c1'}]};
const n26File:ParsedStatement={format:'n26',bankName:'N26',rows:[{date:'2026-09-11',amountCents:2000,kind:'transfer',description:'Ana Prueba Ejemplo',counterpartyName:'ANA PRUEBA EJEMPLO',counterpartyIban:'ES6115860000000000000003',externalId:'n26:x:1'}]};
const bal=(d:Data,name:string)=>accountBalance(d.assets!.find(a=>a.name===name)!,d.transactions);
it('moves 20 € from Trade Republic to N26 without spending or income',()=>{const rows=buildReview(trFile,'Trade Republic',base);expect(rows.map(r=>r.status)).toEqual(['own','new']);const {data}=applyReview(rows,base,'Trade Republic');expect(bal(data,'Trade Republic')).toBe(100000-2000-949);expect(bal(data,'N26')).toBe(22000);const s=summary(data.transactions,'2026-09');expect(s.expense).toBe(949);expect(s.income).toBe(0);});
it('does not duplicate on reimport and pairs the other statement',()=>{const first=applyReview(buildReview(trFile,'Trade Republic',base),base,'Trade Republic').data;expect(buildReview(trFile,'Trade Republic',first).every(r=>r.status==='duplicate'&&!r.include)).toBe(true);const rows=buildReview(n26File,'N26',first);expect(rows[0].status).toBe('paired');const second=applyReview(rows,first,'N26');expect(second.created).toBe(0);expect(second.paired).toBe(1);expect(bal(second.data,'N26')).toBe(22000);expect(buildReview(n26File,'N26',second.data)[0].status).toBe('duplicate');});
it('repairs a transfer that went to the external placeholder',()=>{const bbva:ParsedStatement={format:'bbva',bankName:'BBVA',rows:[{date:'2026-09-10',amountCents:-3000,kind:'transfer',description:'PARA Ana Prueba Ejemplo',counterpartyName:'Ana Prueba Ejemplo',externalId:'bbva:a:1'}]};const first=applyReview(buildReview(bbva,'BBVA',base),base,'BBVA').data;expect(first.transactions[0].toAccount).toBe('Cuenta externa mía');const tr:ParsedStatement={format:'traderepublic',bankName:'Trade Republic',rows:[{date:'2026-09-11',amountCents:3000,kind:'transfer',description:'x',counterpartyName:'ANA PRUEBA EJEMPLO',counterpartyIban:'ES6401820000000000000001',externalId:'tr:in1'}]};const second=applyReview(buildReview(tr,'Trade Republic',first),first,'Trade Republic');expect(second.created).toBe(0);expect(second.data.transactions[0]).toMatchObject({bank:'BBVA',toAccount:'Trade Republic',pairedExternalId:'tr:in1'});expect(bal(second.data,'BBVA')).toBe(2000);expect(bal(second.data,'Trade Republic')).toBe(103000);});
```

- [ ] **Step 2:** FAIL.
- [ ] **Step 3: `review.ts`**

```ts
import {type Data,type Transaction,TRANSFER} from '../domain';
import {type ParsedStatement,type ImportRow} from './common';
import {classify,EXTERNAL} from './classify';
export type Status='new'|'duplicate'|'own'|'maybe'|'paired';
export type ReviewRow={row:ImportRow;include:boolean;status:Status;type:Transaction['type'];category:string;other:string;merchant:string};
const prefix=(id?:string)=>id?.split(':')[0]??'';
export const ends=(r:ReviewRow,account:string)=>r.row.amountCents<0?{from:account,to:r.other}:{from:r.other,to:account};
export function findPair(list:Transaction[],c:{amountCents:number;from:string;to:string;date:string;externalId:string},used:Set<string>){return list.find(t=>t.type==='transfer'&&!used.has(t.id)&&!t.pairedExternalId&&prefix(t.externalId)!==prefix(c.externalId)&&t.amountCents===c.amountCents&&Math.abs(Date.parse(t.date)-Date.parse(c.date))<=3*864e5&&((t.bank===c.from&&(t.toAccount===c.to||t.toAccount===EXTERNAL))||(t.toAccount===c.to&&t.bank===EXTERNAL)));}
export function buildReview(st:ParsedStatement,account:string,data:Data):ReviewRow[]{
 const known=new Set(data.transactions.flatMap(t=>[t.externalId,t.pairedExternalId].filter((v):v is string=>!!v))),used=new Set<string>();
 return st.rows.map(row=>{
  const s=classify(row,{account,owner:data.profile.ownerName,assets:data.assets??[],categories:data.categories.map(c=>c.name)});
  const r:ReviewRow={row,include:true,status:'new',type:s.type,category:s.category||'Otros',other:s.other,merchant:row.description.slice(0,200)||'Movimiento importado'};
  if(known.has(row.externalId))return {...r,include:false,status:'duplicate'};
  if(s.type==='transfer'){const p=findPair(data.transactions,{...ends(r,account),amountCents:Math.abs(row.amountCents),date:row.date,externalId:row.externalId},used);if(p)used.add(p.id);return {...r,status:p?'paired':'own'};}
  return {...r,status:s.own==='maybe'?'maybe':'new'};
 });
}
export function applyReview(rows:ReviewRow[],data:Data,account:string){
 const used=new Set<string>(),created:Transaction[]=[];let transactions=[...data.transactions],paired=0;
 for(const r of rows){
  if(!r.include||r.status==='duplicate')continue;
  const amountCents=Math.abs(r.row.amountCents),{from,to}=ends(r,account);
  if(r.type==='transfer'){
   if(!r.other||from===to)throw Error(`Elige la otra cuenta de «${r.merchant}».`);
   const p=findPair(data.transactions,{amountCents,from,to,date:r.row.date,externalId:r.row.externalId},used);
   if(p){used.add(p.id);transactions=transactions.map(t=>t.id===p.id?{...t,bank:from,toAccount:to,pairedExternalId:r.row.externalId}:t);paired++;continue;}
  }
  created.push({id:crypto.randomUUID(),type:r.type,amountCents,merchant:r.merchant,bank:r.type==='transfer'?from:account,...(r.type==='transfer'?{toAccount:to}:{}),category:r.type==='transfer'?TRANSFER:r.category,date:r.row.date,source:'import',externalId:r.row.externalId});
 }
 const names=created.flatMap(t=>[t.bank,t.toAccount??'']).filter(Boolean);
 return {data:{...data,transactions:[...created,...transactions],accounts:Array.from(new Set([...data.accounts,...names]))},created:created.length,paired};
}
```

- [ ] **Step 4:** PASS → Commit `Detecta duplicados y empareja transferencias entre extractos`.

### Task 11: Integración en movimientos, informes, modal y patrimonio

**Files:** Modify `src/components.tsx`, `src/Reports.tsx`, `src/TransactionModal.tsx`, `src/Patrimonio.tsx`

- [ ] **Step 1: `components.tsx`**
  - Import: añadir `ArrowLeftRight`.
  - `Donut` recibe `palette?:Record<string,string>`; en `slices` usar `groups.map(([name,value],i)=>{…return \`${palette?.[name]??colors[i%colors.length]} …\`})`.
  - `MovementList`: `const transfer=t.type==='transfer'`; icono `transfer?<ArrowLeftRight size={20}/>:…`; subtítulo `{transfer?\`${t.bank} → ${t.toAccount}\`:\`${t.category} · ${t.bank}\`} · fecha`, añadir `{t.source==='import'?' · Importado':''}`; importe sin signo para transferencias (`transfer?'':t.type==='income'?'+':'−'`); botón editar solo `onEdit&&!transfer`.
- [ ] **Step 2: `Reports.tsx`**: prop `palette?:Record<string,string>`; pasar `palette` a ambos `Donut`; en el desglose `background:palette?.[name]??colors[i%colors.length]`.
- [ ] **Step 3: `TransactionModal.tsx`**: props `transactions=[]` y `categoryNames=categories` (tipos `transactions?:Transaction[];categoryNames?:string[]`); lista de gasto `type==='expense'?categoryNames:[…]`; saldo de tarjeta `a.openingBalance||a.valuations.length?money(accountBalance(a,transactions)):'Saldo sin registrar'` (importar `accountBalance`, clase `unset` con la misma condición).
- [ ] **Step 4: `Patrimonio.tsx`**
  - Import `accountBalance,cashTypes`; `const value=(a:Asset)=>accountBalance(a,transactions);` y sustituir `assetValue(a)` por `value(a)` en `total`, `accounts`, `invested`, sumas de grupo y valor de tarjeta.
  - `portfolioHistory(assets,transactions)`; texto inferior: «Las cuentas con saldo inicial se actualizan con tus movimientos; el resto, con tus valoraciones.»
  - `AssetEditor`: `const isCash=cashTypes.includes(type)`; estados iniciales `value` = `asset?.openingBalance?.valueCents ?? assetValue(asset)` y `date` = `asset?.openingBalance?.date??today()`; nuevo estado `iban` (`asset?.iban??''`).
  - Etiquetas: `isCash?'Saldo inicial (€)':'Valor actual (€)'`, `isCash?'Fecha del saldo inicial':'Fecha de valoración'`; si `isCash`, pista «Saldo antes de los movimientos de ese día. Tus gastos, ingresos y transferencias desde esa fecha lo actualizan solos.» y campo `<label>IBAN (opcional)<input value={iban} maxLength={40} onChange={e=>setIban(e.target.value)} placeholder="ES00 0000 …"/></label>`.
  - `submit`:

```ts
const valueCents=parseAssetValue(value),cleanIban=iban.replace(/\s/g,'').toUpperCase();if(cleanIban&&!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(cleanIban))throw Error('Revisa el IBAN.');
const valuations=isCash?(asset?.valuations||[]):[...(asset?.valuations||[]).filter(v=>v.date!==date),{date,valueCents}].sort((a,b)=>a.date.localeCompare(b.date));
onSave({id:asset?.id||crypto.randomUUID(),type,bank:bank.trim(),name:name.trim(),color,notes:notes.trim(),valuations,...(isCash?{openingBalance:{date,valueCents}}:{}),...(cleanIban?{iban:cleanIban}:{})});
```

- [ ] **Step 5:** `npx tsc -b && npx vitest run` → PASS → Commit `Muestra transferencias y saldos calculados en la interfaz`.

### Task 12: Ajustes, categorías, importación y cabecera

**Files:** Rewrite `src/Settings.tsx`; Create `src/settings.css`, `src/Categories.tsx`, `src/ImportFlow.tsx`, `src/import.css`; Modify `src/App.tsx`; Test `src/App.test.tsx`

- [ ] **Step 1: Tests que fallan** — añadir en `App.test.tsx`:

```tsx
 it('shows the brand header only on the home screen and a redesigned settings page',()=>{
  render(<App/>);expect(screen.getByRole('button',{name:'misGastos inicio'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));
  expect(screen.queryByRole('button',{name:'misGastos inicio'})).toBeNull();
  expect(screen.getByRole('button',{name:/Importar movimientos/})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Titular de las cuentas/}));
  fireEvent.change(screen.getByLabelText('Titular de las cuentas'),{target:{value:'Ana Prueba Ejemplo'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar titular'}));
  expect(screen.getByText('Ana Prueba Ejemplo')).toBeTruthy();
 });
 it('adds and removes categories moving movements to Otros',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));
  fireEvent.click(screen.getByRole('button',{name:/Categorías/}));
  fireEvent.change(screen.getByLabelText('Nueva categoría'),{target:{value:'Mascotas'}});
  fireEvent.click(screen.getByRole('button',{name:'Añadir categoría'}));
  expect(screen.getByText('Mascotas')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Borrar Mascotas'}));
  expect(screen.queryByText('Mascotas')).toBeNull();
 });
```

- [ ] **Step 2:** `npx vitest run src/App.test.tsx` → FAIL.
- [ ] **Step 3: `Settings.tsx`** (reescrito completo)

```tsx
import {useRef,useState} from 'react';
import {Camera,Pencil,Check,ChevronRight,Banknote,Landmark,LayoutGrid,Zap,UploadCloud,UserRound,Info,Download,Upload,Trash2,type LucideIcon} from 'lucide-react';
import {type Data,validateBackup,download,emptyData} from './domain';
import './settings.css';
type Props={data:Data;onChange:(d:Data,restore?:boolean)=>void;onShortcut:()=>void;onPatrimonio:()=>void;onCategories:()=>void;onImport:()=>void};
function Row({icon:Icon,label,value,onClick,accent}:{icon:LucideIcon;label:string;value?:string;onClick?:()=>void;accent?:boolean}){const body=<><span className={`set-icon${accent?' accent':''}`}><Icon size={22}/></span><span className="set-label">{label}</span>{value&&<span className="set-value">{value}</span>}{onClick&&<ChevronRight className="set-chevron" size={20}/>}</>;return onClick?<button className="set-row" onClick={onClick}>{body}</button>:<div className="set-row">{body}</div>;}
function resizeImage(file:File):Promise<string>{return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement('canvas'),s=Math.min(img.width,img.height);c.width=c.height=256;c.getContext('2d')!.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,256,256);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.85));};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('No se ha podido leer la imagen.'));};img.src=url;});}
export default function Settings({data,onChange,onShortcut,onPatrimonio,onCategories,onImport}:Props){
 const [editing,setEditing]=useState<''|'name'|'owner'>(''),[draft,setDraft]=useState(''),[error,setError]=useState(''),restore=useRef<HTMLInputElement>(null);
 const profile=data.profile,initials=(profile.displayName||'mis Gastos').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
 const saveProfile=(p:Partial<Data['profile']>)=>onChange({...data,profile:{...profile,...p}});
 const start=(field:'name'|'owner')=>{setDraft(field==='name'?profile.displayName:profile.ownerName);setEditing(field);setError('');};
 const commit=(e:React.FormEvent)=>{e.preventDefault();const v=draft.trim().replace(/\s+/g,' ');saveProfile(editing==='name'?{displayName:v.slice(0,100)}:{ownerName:v.slice(0,200)});setEditing('');};
 return <div className="settings">
  <section className="set-profile"><div className="set-avatar">{profile.avatar?<img src={profile.avatar} alt="Tu foto de perfil"/>:<span>{initials}</span>}<label className="set-camera" aria-label="Cambiar foto de perfil"><Camera size={18}/><input type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{saveProfile({avatar:await resizeImage(f)});}catch(err){setError((err as Error).message);}}}/></label></div>
   {editing==='name'?<form className="set-inline" onSubmit={commit}><input autoFocus aria-label="Tu nombre" value={draft} maxLength={100} onChange={e=>setDraft(e.target.value)}/><button className="icon-button" aria-label="Guardar nombre"><Check size={18}/></button></form>:<h1 className="set-name">{profile.displayName||'Tu nombre'}<button className="icon-button compact" aria-label="Editar nombre" onClick={()=>start('name')}><Pencil size={16}/></button></h1>}
   <p>Gestiona misGastos a tu manera</p></section>
  {error&&<p className="error" role="alert">{error}</p>}
  <section className="set-card"><Row icon={Banknote} label="Moneda" value="Euro (EUR)"/><Row icon={Landmark} label="Patrimonio y cuentas" onClick={onPatrimonio}/><Row icon={LayoutGrid} label="Categorías" value={`${data.categories.length} activas`} onClick={onCategories}/></section>
  <section className="set-card"><h2>Atajos</h2><Row icon={Zap} accent label="Atajo Apple Pay" value="Importe · comercio · banco" onClick={onShortcut}/></section>
  <section className="set-card"><h2>Automatizaciones <span className="set-badge">NUEVO</span></h2><Row icon={UploadCloud} accent label="Importar movimientos" value="CSV o PDF" onClick={onImport}/></section>
  <section className="set-card">
   {editing==='owner'?<form className="set-inline set-owner" onSubmit={commit}><label>Titular de las cuentas<input autoFocus value={draft} maxLength={200} onChange={e=>setDraft(e.target.value)} placeholder="Nombre y apellidos como en el banco"/></label><button className="icon-button" aria-label="Guardar titular"><Check size={18}/></button></form>:<Row icon={UserRound} label="Titular de las cuentas" value={profile.ownerName||'Sin indicar'} onClick={()=>start('owner')}/>}
   <Row icon={Download} label="Exportar copia de seguridad" onClick={()=>download('misGastos-copia.json',data)}/>
   <Row icon={Upload} label="Restaurar copia JSON" onClick={()=>restore.current?.click()}/>
   <input ref={restore} hidden type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>10*1024*1024)throw Error('La copia supera 10 MB.');const restored=validateBackup(await file.text());if(confirm(`¿Sustituir los datos locales por ${restored.transactions.length} movimientos de esta copia?`)){onChange(restored,true);setError('');}}catch(err){setError((err as Error).message);}}}/>
   <Row icon={Trash2} label="Borrar datos locales" onClick={()=>{if(confirm('¿Borrar todos los datos de este navegador? Exporta antes una copia. El receptor de Atajos no se borra.'))onChange(emptyData(),true);}}/>
   <Row icon={Info} label="App info" value="v0.2.0 · local"/>
  </section>
  <p className="hint set-note">Tus datos se guardan en este dispositivo. El token del atajo no se exporta.</p>
 </div>;
}
```

- [ ] **Step 4: `settings.css`**

```css
.settings{max-width:640px;margin:0 auto;padding-top:28px}
.set-profile{text-align:center;margin-bottom:26px}.set-profile p{margin:4px 0 0}
.set-avatar{position:relative;width:112px;height:112px;margin:0 auto 14px;border-radius:50%;background:white;border:1px solid var(--border);display:grid;place-items:center;box-shadow:0 10px 30px #7c3aed14}
.set-avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover}.set-avatar span{font-size:34px;font-weight:700;color:var(--purple)}
.set-camera{position:absolute;right:-2px;bottom:4px;margin:0;width:36px;height:36px;border-radius:50%;background:var(--purple);color:white;display:grid;place-items:center;border:3px solid white;cursor:pointer}.set-camera input{display:none}
.set-name{display:inline-flex;align-items:center;gap:8px;font-size:30px;margin:0}
.set-inline{display:flex;gap:8px;align-items:flex-end;justify-content:center}.set-inline input{max-width:280px}.set-owner{padding:14px 18px}.set-owner label{flex:1;margin:0}
.set-card{background:white;border:1px solid var(--border);border-radius:22px;margin-bottom:18px;overflow:hidden}
.set-card h2{font-size:18px;margin:18px 20px 4px;display:flex;justify-content:space-between;align-items:center}
.set-badge{background:var(--purple);color:white;font-size:12px;letter-spacing:1px;padding:5px 12px;border-radius:999px}
.set-row{display:flex;align-items:center;gap:14px;width:100%;padding:14px 18px;text-align:left;min-height:68px}
.set-row+.set-row,.set-card>div+div .set-row{border-top:1px solid var(--border)}
button.set-row:hover{background:#faf8ff}
.set-icon{flex-shrink:0;width:46px;height:46px;border-radius:50%;background:#f3f2f7;color:#555766;display:grid;place-items:center}.set-icon.accent{background:#f2ecfd;color:var(--purple)}
.set-label{flex:1;font-size:17px;color:#20212b}.set-value{color:var(--muted);font-size:14px;text-align:right}.set-chevron{color:#b8b7c3}
.set-note{text-align:center}
.set-page-head{display:flex;align-items:center;gap:12px;margin-bottom:20px}.set-page-head h1{margin:0;font-size:26px;flex:1;text-align:center;padding-right:44px}
.set-add{display:flex;gap:10px}.set-add .primary{min-width:56px;border-radius:14px;display:grid;place-items:center}
.set-colors{display:flex;flex-wrap:wrap;gap:10px;padding:0 18px 16px 78px}.set-colors button{width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 1px var(--border)}.set-colors button[aria-pressed=true]{box-shadow:0 0 0 2px #20212b}
.danger{color:#c62828}
@media(max-width:760px){.settings{padding-top:12px}.set-label{font-size:16px}.set-value{font-size:13px;max-width:45%}}
```

- [ ] **Step 5: `Categories.tsx`**

```tsx
import {useState} from 'react';
import {ArrowLeft,Plus,Trash2,Tag} from 'lucide-react';
import {type Data,colors,TRANSFER} from './domain';
import './settings.css';
const palette=[...colors,'#ef4444','#f97316','#14b8a6','#0f172a'];
export default function Categories({data,onChange,onBack}:{data:Data;onChange:(d:Data)=>void;onBack:()=>void}){
 const [name,setName]=useState(''),[picking,setPicking]=useState(''),[error,setError]=useState('');
 function add(e:React.FormEvent){e.preventDefault();const v=name.trim().replace(/\s+/g,' ');if(!v)return;if(v.length>40)return setError('Máximo 40 caracteres.');if(v.toLowerCase()===TRANSFER.toLowerCase()||data.categories.some(c=>c.name.toLowerCase()===v.toLowerCase()))return setError('Esa categoría ya existe.');onChange({...data,categories:[...data.categories,{name:v,color:palette[data.categories.length%palette.length]}]});setName('');setError('');}
 function remove(n:string){const used=data.transactions.filter(t=>t.category===n).length;if(!confirm(used?`¿Borrar «${n}»? Sus ${used} movimientos pasarán a «Otros».`:`¿Borrar «${n}»?`))return;const rest=data.categories.filter(c=>c.name!==n);onChange({...data,categories:rest.some(c=>c.name==='Otros')?rest:[...rest,{name:'Otros',color:'#9ca3af'}],transactions:data.transactions.map(t=>t.category===n?{...t,category:'Otros'}:t)});}
 return <div className="settings"><header className="set-page-head"><button className="icon-button" aria-label="Volver" onClick={onBack}><ArrowLeft/></button><h1>Categorías</h1></header>
  <form className="set-add" onSubmit={add}><input aria-label="Nueva categoría" placeholder="Nueva categoría" value={name} maxLength={40} onChange={e=>setName(e.target.value)}/><button className="primary" aria-label="Añadir categoría" disabled={!name.trim()}><Plus/></button></form>
  <p className="hint">Toca el icono de una categoría para cambiar su color.</p>{error&&<p className="error" role="alert">{error}</p>}
  <section className="set-card">{data.categories.map(c=><div key={c.name}><div className="set-row"><button className="set-icon" style={{background:c.color+'22',color:c.color}} aria-label={`Cambiar color de ${c.name}`} onClick={()=>setPicking(picking===c.name?'':c.name)}><Tag size={20}/></button><span className="set-label">{c.name}</span>{c.name!=='Otros'&&<button className="icon-button compact danger" aria-label={`Borrar ${c.name}`} onClick={()=>remove(c.name)}><Trash2 size={18}/></button>}</div>{picking===c.name&&<div className="set-colors">{palette.map(p=><button key={p} aria-label={`Color ${p}`} aria-pressed={p===c.color} style={{background:p}} onClick={()=>{onChange({...data,categories:data.categories.map(x=>x.name===c.name?{...x,color:p}:x)});setPicking('');}}/>)}</div>}</div>)}</section></div>;
}
```

- [ ] **Step 6: `ImportFlow.tsx`**

```tsx
import {useState} from 'react';
import {ArrowLeft,Upload,Check} from 'lucide-react';
import {type Data,money,validDate,today} from './domain';
import {type Asset,banks,parseAssetValue,cashTypes} from './assets';
import {readStatement} from './import/detect';
import type {ParsedStatement} from './import/common';
import {guessMapping,parseGenericCsv,type CsvMapping} from './import/genericCsv';
import {buildReview,applyReview,type ReviewRow} from './import/review';
import {EXTERNAL} from './import/classify';
import './settings.css';
import './import.css';
const STATUS:Record<ReviewRow['status'],string>={new:'Nuevo',duplicate:'Ya importado',own:'Transferencia propia',maybe:'¿Transferencia propia?',paired:'Ya registrada en la otra cuenta'};
type Step='owner'|'file'|'map'|'account'|'review'|'done';
export default function ImportFlow({data,onSave,onBack}:{data:Data;onSave:(d:Data)=>void;onBack:()=>void}){
 const [step,setStep]=useState<Step>(data.profile.ownerName?'file':'owner'),[owner,setOwner]=useState(data.profile.ownerName),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [csv,setCsv]=useState<string[][]>([]),[mapping,setMapping]=useState<CsvMapping>({date:-1,description:-1,amount:-1}),[csvBank,setCsvBank]=useState('');
 const [statement,setStatement]=useState<ParsedStatement|null>(null),[account,setAccount]=useState(''),[opening,setOpening]=useState({date:'',value:''}),[draft,setDraft]=useState<Data>(data),[rows,setRows]=useState<ReviewRow[]>([]),[result,setResult]=useState('');
 const assets=data.assets??[],cash=assets.filter(a=>cashTypes.includes(a.type)),names=Array.from(new Set([...cash.map(a=>a.name),...data.accounts]));
 const fail=(e:unknown)=>setError((e as Error).message);
 function chooseStatement(st:ParsedStatement){setStatement(st);const match=cash.find(a=>st.ownIban&&a.iban===st.ownIban)??cash.find(a=>a.bank===st.bankName||a.name===st.bankName);setAccount(match?.name??'__new');setOpening({date:st.opening?.date??[...st.rows].sort((a,b)=>a.date.localeCompare(b.date))[0]?.date??today(),value:st.opening?String(st.opening.valueCents/100).replace('.',','):''});setStep('account');}
 async function pick(file?:File){if(!file)return;setBusy(true);setError('');try{const d=await readStatement(file);if(d.kind==='statement')chooseStatement(d.statement);else{setCsv(d.rows);setMapping(guessMapping(d.rows[0]));setCsvBank(file.name.replace(/\.[^.]+$/,''));setStep('map');}}catch(e){fail(e);}finally{setBusy(false);}}
 const current=assets.find(a=>a.name===account),needsOpening=account==='__new'||(!!current&&!current.openingBalance);
 function toReview(){try{if(!statement)return;let next=data,name=account;
  if(account==='__new'||(current&&!current.openingBalance&&opening.value.trim())){if(!validDate(opening.date))throw Error('Elige la fecha del saldo inicial.');const valueCents=parseAssetValue(opening.value||'0');
   if(account==='__new'){name=names.includes(statement.bankName)?`${statement.bankName} ${cash.length+1}`:statement.bankName;const asset:Asset={id:crypto.randomUUID(),type:'Cuenta',bank:statement.bankName,name,color:banks.find(b=>b.name===statement.bankName)?.color??'#5b21b6',notes:'',valuations:[],openingBalance:{date:opening.date,valueCents},...(statement.ownIban?{iban:statement.ownIban}:{})};next={...data,assets:[...assets,asset],accounts:Array.from(new Set([...data.accounts,name]))};}
   else next={...data,assets:assets.map(a=>a.id===current!.id?{...a,openingBalance:{date:opening.date,valueCents},...(statement.ownIban&&!a.iban?{iban:statement.ownIban}:{})}:a)};}
  if(!name)throw Error('Elige la cuenta del extracto.');setAccount(name);setDraft(next);setRows(buildReview(statement,name,next));setError('');setStep('review');}catch(e){fail(e);}}
 function update(i:number,p:Partial<ReviewRow>){setRows(rows.map((r,k)=>k===i?{...r,...p}:r));}
 function finish(){try{const out=applyReview(rows,draft,account);onSave(out.data);setResult(`${out.created} movimientos importados${out.paired?` · ${out.paired} transferencias emparejadas`:''}.`);setStep('done');}catch(e){fail(e);}}
 const chosen=rows.filter(r=>r.include&&r.status!=='duplicate'),total=(t:ReviewRow['type'])=>chosen.filter(r=>r.type===t).reduce((n,r)=>n+Math.abs(r.row.amountCents),0);
 const others=Array.from(new Set([...names,...assets.filter(a=>a.type==='Inversión').map(a=>a.name),EXTERNAL])).filter(n=>n!==account);
 return <div className="settings import-flow"><header className="set-page-head"><button className="icon-button" aria-label="Volver" onClick={onBack}><ArrowLeft/></button><h1>Importar movimientos</h1></header>
  {error&&<p className="error" role="alert">{error}</p>}
  {step==='owner'&&<section className="set-card import-pad"><h2>¿A nombre de quién están tus cuentas?</h2><p>Si una transferencia va de una cuenta tuya a otra, no contará como gasto ni como ingreso: solo moverá el saldo.</p><form onSubmit={e=>{e.preventDefault();const v=owner.trim().replace(/\s+/g,' ');if(v.split(' ').length<2)return setError('Escribe nombre y apellidos como aparecen en el banco.');setDraft({...data,profile:{...data.profile,ownerName:v}});onSave({...data,profile:{...data.profile,ownerName:v}});setError('');setStep('file');}}><label>Titular de las cuentas<input value={owner} maxLength={200} onChange={e=>setOwner(e.target.value)} placeholder="Nombre y apellidos"/></label><button className="primary wide">Continuar</button></form></section>}
  {step==='file'&&<section className="set-card import-pad"><h2>Elige tu extracto</h2><p>CSV de cualquier banco (Trade Republic se reconoce solo) o PDF de N26 y BBVA. El archivo se lee en este dispositivo y no se envía a ningún sitio.</p><label className="file-button primary"><Upload size={18}/> {busy?'Leyendo…':'Seleccionar archivo'}<input type="file" accept=".csv,.pdf,text/csv,application/pdf" disabled={busy} onChange={e=>{pick(e.target.files?.[0]);e.target.value='';}}/></label></section>}
  {step==='map'&&<section className="set-card import-pad"><h2>¿Qué es cada columna?</h2>{(['date','description','amount'] as const).map(k=><label key={k}>{k==='date'?'Fecha':k==='description'?'Concepto':'Importe (negativo = gasto)'}<select value={mapping[k]} onChange={e=>setMapping({...mapping,[k]:Number(e.target.value)})}><option value={-1}>Elige una columna</option>{csv[0].map((h,i)=><option key={i} value={i}>{h||`Columna ${i+1}`} · {csv[1]?.[i]??''}</option>)}</select></label>)}<label>Nombre del banco<input value={csvBank} maxLength={100} onChange={e=>setCsvBank(e.target.value)}/></label><button className="primary wide" onClick={()=>{try{chooseStatement(parseGenericCsv(csv,mapping,csvBank.trim()||'Mi banco'));setError('');}catch(e){fail(e);}}}>Continuar</button></section>}
  {step==='account'&&statement&&<section className="set-card import-pad"><h2>{statement.bankName} · {statement.rows.length} movimientos</h2><label>¿De qué cuenta es este extracto?<select value={account} onChange={e=>setAccount(e.target.value)}>{names.map(n=><option key={n} value={n}>{n}</option>)}<option value="__new">Crear cuenta «{statement.bankName}»</option></select></label>{needsOpening&&<><p className="hint">{account==='__new'?'Indica el saldo que tenía la cuenta':'Esta cuenta aún no tiene saldo inicial. Si lo indicas, se actualizará sola'} {statement.opening?'(lo hemos leído del extracto)':''}. Es el saldo antes de los movimientos de ese día.</p><div className="import-two"><label>Saldo inicial (€)<input inputMode="decimal" value={opening.value} onChange={e=>setOpening({...opening,value:e.target.value})} placeholder="0,00"/></label><label>Fecha<input type="date" value={opening.date} onChange={e=>setOpening({...opening,date:e.target.value})}/></label></div></>}<button className="primary wide" onClick={toReview}>Revisar movimientos</button></section>}
  {step==='review'&&<><section className="set-card import-pad import-summary"><div><small>GASTOS</small><strong>{money(total('expense'))}</strong></div><div><small>INGRESOS</small><strong className="income">{money(total('income'))}</strong></div><div><small>TRANSFERENCIAS</small><strong>{chosen.filter(r=>r.type==='transfer').length}</strong></div></section>
   <ul className="import-list">{rows.map((r,i)=>{const out=r.row.amountCents<0;return <li key={r.row.externalId} className={`import-row${r.include?'':' off'}`}><input type="checkbox" aria-label={`Incluir ${r.merchant}`} checked={r.include} disabled={r.status==='duplicate'} onChange={e=>update(i,{include:e.target.checked})}/><div className="import-main"><strong>{r.merchant}</strong><small>{new Date(r.row.date+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · <span className={`import-chip ${r.status}`}>{STATUS[r.status]}</span></small>{r.status!=='duplicate'&&r.status!=='paired'&&<div className="import-controls"><select aria-label={`Tipo de ${r.merchant}`} value={r.type} onChange={e=>{const type=e.target.value as ReviewRow['type'];update(i,{type,other:type==='transfer'?r.other||EXTERNAL:r.other});}}><option value={out?'expense':'income'}>{out?'Gasto':'Ingreso'}</option><option value="transfer">Transferencia entre mis cuentas</option></select>{r.type==='transfer'?<select aria-label={`Otra cuenta de ${r.merchant}`} value={r.other} onChange={e=>update(i,{other:e.target.value})}>{Array.from(new Set([...others,r.other])).map(n=><option key={n} value={n}>{out?'→ ':'← '}{n}</option>)}</select>:<select aria-label={`Categoría de ${r.merchant}`} value={r.category} onChange={e=>update(i,{category:e.target.value})}>{Array.from(new Set([...(out?data.categories.map(c=>c.name):['Nómina','Intereses','Venta','Otros']),r.category])).map(c=><option key={c}>{c}</option>)}</select>}</div>}</div><strong className={r.type==='income'?'income':''}>{r.type==='transfer'?'':out?'−':'+'}{money(Math.abs(r.row.amountCents))}</strong></li>;})}</ul>
   <button className="primary wide import-go" disabled={!chosen.length} onClick={finish}>Importar {chosen.length} movimientos</button></>}
  {step==='done'&&<section className="set-card import-pad import-done"><span className="set-icon accent"><Check/></span><h2>Listo</h2><p>{result}</p><button className="primary wide" onClick={onBack}>Volver a Ajustes</button></section>}
 </div>;
}
```

- [ ] **Step 7: `import.css`**

```css
.import-pad{padding:6px 20px 20px}.import-pad h2{margin:18px 0 8px}.import-pad .file-button{display:inline-flex;justify-content:center;gap:8px;padding:14px 18px;border-radius:14px;width:100%}.import-pad .file-button input{display:none}
.wide{width:100%;min-height:52px;border-radius:14px;font-weight:600}
.import-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.import-two label{margin:8px 0}
.import-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:16px 20px}.import-summary strong{display:block;font-size:18px}
.import-list{list-style:none;margin:0 0 16px;padding:0;background:white;border:1px solid var(--border);border-radius:22px;overflow:hidden}
.import-row{display:grid;grid-template-columns:24px 1fr auto;gap:12px;align-items:start;padding:14px 16px;border-top:1px solid var(--border)}.import-row:first-child{border-top:0}.import-row.off{opacity:.5}
.import-row input[type=checkbox]{min-height:22px;width:22px;margin-top:2px;accent-color:var(--purple)}
.import-main{min-width:0;display:flex;flex-direction:column;gap:4px}.import-main strong{overflow-wrap:anywhere}
.import-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.import-controls select{min-height:40px;padding:6px 10px;font-size:13px;width:auto;max-width:100%}
.import-chip{padding:2px 8px;border-radius:999px;background:#f3f2f7;font-weight:600}.import-chip.own,.import-chip.paired{background:#f2ecfd;color:var(--purple)}.import-chip.maybe{background:#fff4d6;color:#8a5a00}.import-chip.duplicate{background:#eee;color:#777}
.import-go{position:sticky;bottom:96px}.import-done{text-align:center}.import-done .set-icon{margin:20px auto 0}
@media(max-width:760px){.import-two{grid-template-columns:1fr}.import-summary strong{font-size:15px}}
```

- [ ] **Step 8: `App.tsx`**
  - Imports: `import Categories from './Categories';` `import ImportFlow from './ImportFlow';`
  - Cabecera: envolver `<header className="app-header">…</header>` en `{tab==='Gastos'&&(page===''||page==='all')&&…}`.
  - `const palette=Object.fromEntries(data.categories.map(c=>[c.name,c.color]));` y pasar `palette={palette}` al `Donut` de inicio y a `<Reports …/>`.
  - Antes de `page==='budget'?` añadir: `page==='import'?<ImportFlow data={data} onSave={d=>save(d)} onBack={()=>setPage('')}/>:page==='categories'?<Categories data={data} onChange={d=>change(d)} onBack={()=>setPage('')}/>:`
  - `<Settings … onCategories={()=>setPage('categories')} onImport={()=>setPage('import')}/>`
  - `<TransactionModal … assets={data.assets} transactions={data.transactions} categoryNames={data.categories.map(c=>c.name)} …/>`
- [ ] **Step 9:** `npx tsc -b && npx vitest run` → PASS → Commit `Rediseña Ajustes, añade categorías e importación y deja la cabecera solo en inicio`.

### Task 13: Verificación final

- [ ] **Step 1:** `npm run build` (en `apps/web`) → compilación correcta; comprobar que `dist/assets` contiene el worker de pdfjs.
- [ ] **Step 2:** Navegador (`npm run dev` en la raíz): Ajustes (móvil 390×844 y escritorio), cabecera solo en inicio, categorías, titular.
- [ ] **Step 3:** Con los archivos **reales** de la usuaria (solo local, sin copiarlos al repo): crear cuentas TR/N26/BBVA con saldo inicial, importar CSV TR, PDF N26 y PDF BBVA; comprobar número de filas leídas, transferencias propias, emparejamientos y que reimportar marca «Ya importado». Anotar discrepancias.
- [ ] **Step 4:** Actualizar `docs/progress.md` con resultados reales y commit `Documenta verificación de importación`.
