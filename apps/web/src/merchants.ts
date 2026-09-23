import type {Data,MerchantRule,Transaction} from './domain';
// Bank descriptors ("MNE* 95018521Moneynet_S", "DIA ORIHUELA 1488") mapped to readable names. Order matters: specific before generic.
type Rule=[RegExp,string,string];
const RULES:Rule[]=[
 [/moneynet|^mne\s*\*/,'Máquina expendedora','Restauración'],
 [/mercadona/,'Mercadona','Alimentación'],[/\blidl\b/,'Lidl','Alimentación'],[/^dia\b|supermercados? dia\b/,'Dia','Alimentación'],[/carrefour/,'Carrefour','Alimentación'],[/\baldi\b/,'Aldi','Alimentación'],[/\bconsum\b/,'Consum','Alimentación'],[/eroski/,'Eroski','Alimentación'],[/alcampo/,'Alcampo','Alimentación'],[/hipercor/,'Hipercor','Alimentación'],[/masymas|mas y mas/,'Masymas','Alimentación'],
 [/plenergy/,'Plenergy','Transporte'],[/repsol/,'Repsol','Transporte'],[/cepsa|moeve/,'Cepsa','Transporte'],[/\bgalp\b/,'Galp','Transporte'],[/\bbp\b/,'BP','Transporte'],[/\bshell\b/,'Shell','Transporte'],[/ballenoil/,'Ballenoil','Transporte'],[/petroprix/,'Petroprix','Transporte'],
 [/renfe/,'Renfe','Transporte'],[/\balsa\b/,'Alsa','Transporte'],[/uber ?eats/,'Uber Eats','Restauración'],[/\buber\b/,'Uber','Transporte'],[/cabify/,'Cabify','Transporte'],[/\bbolt\b/,'Bolt','Transporte'],
 [/burger king|(^|\s)bk\s/,'Burger King','Restauración'],[/mc ?donald/,"McDonald's",'Restauración'],[/\bkfc\b/,'KFC','Restauración'],[/telepizza/,'Telepizza','Restauración'],[/starbucks/,'Starbucks','Restauración'],[/glovo/,'Glovo','Restauración'],[/just ?eat/,'Just Eat','Restauración'],
 [/disney/,'Disney+','Suscripciones'],[/netflix/,'Netflix','Suscripciones'],[/spotify/,'Spotify','Suscripciones'],[/youtube/,'YouTube','Suscripciones'],[/prime ?video/,'Prime Video','Suscripciones'],[/amazon ?prime/,'Amazon Prime','Suscripciones'],[/apple\.com|itunes/,'Apple','Suscripciones'],[/anthropic|claude/,'Claude','Suscripciones'],[/openai|chatgpt/,'ChatGPT','Suscripciones'],
 [/amazon|amzn/,'Amazon','Compras'],[/aliexpress/,'AliExpress','Compras'],[/shein/,'Shein','Compras'],[/\bzara\b/,'Zara','Compras'],[/primark/,'Primark','Compras'],[/decathlon/,'Decathlon','Compras'],[/north ?face/,'The North Face','Compras'],[/corte ingles/,'El Corte Inglés','Compras'],[/eurobazar/,'Eurobazar','Compras'],
 [/ikea/,'IKEA','Hogar'],[/leroy/,'Leroy Merlin','Hogar'],[/farmacia/,'Farmacia','Salud'],[/universidad miguel her|\bumh\b/,'Universidad Miguel Hernández','Otros'],
];
export const builtInMerchants=RULES.map(([re,name,category])=>({pattern:re.source,name,category}));
export const normalizeText=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
// The user's own rules ("contains" text) are checked before the built-in list.
export function tidyMerchant(raw:string,custom:MerchantRule[]=[]):{name:string;category?:string;custom?:boolean}{const t=normalizeText(raw);for(const r of custom){const m=normalizeText(r.match);if(m&&t.includes(m))return {name:r.name,category:r.category,custom:true};}for(const [re,name,category] of RULES)if(re.test(t))return {name,category};return {name:raw};}
// Renames recognised merchants. The category is filled when it is still "Otros", or when one of the user's rules renames the merchant for the first time.
export function tidyTransaction(t:Transaction,categories:string[],custom:MerchantRule[]=[]):Transaction{if(t.type!=='expense')return t;const m=tidyMerchant(t.merchant,custom);if(!m.category)return t;const renamed=m.name!==t.merchant,valid=categories.includes(m.category);const category=valid&&(t.category==='Otros'||(m.custom&&renamed))?m.category:t.category;return !renamed&&category===t.category?t:{...t,merchant:m.name,category};}
export function tidyData(data:Data):Data|null{const names=data.categories.map(c=>c.name),custom=data.merchantRules??[];let changed=false;const transactions=data.transactions.map(t=>{const n=tidyTransaction(t,names,custom);if(n!==t)changed=true;return n;});return changed?{...data,transactions}:null;}
// Expense merchants that no rule recognises yet, most frequent first.
export function unknownMerchants(data:Data,limit=8){const custom=data.merchantRules??[],count=new Map<string,number>();for(const t of data.transactions)if(t.type==='expense'&&!tidyMerchant(t.merchant,custom).category)count.set(t.merchant,(count.get(t.merchant)??0)+1);return [...count].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([merchant,times])=>({merchant,times}));}
