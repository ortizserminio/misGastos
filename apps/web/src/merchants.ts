import type {Data,Transaction} from './domain';
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
export function tidyMerchant(raw:string):{name:string;category?:string}{const t=raw.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();for(const [re,name,category] of RULES)if(re.test(t))return {name,category};return {name:raw};}
// Renames recognised merchants; only fills the category when it is still "Otros", so the user's choices are kept.
export function tidyTransaction(t:Transaction,categories:string[]):Transaction{if(t.type!=='expense')return t;const m=tidyMerchant(t.merchant);if(!m.category)return t;const category=t.category==='Otros'&&categories.includes(m.category)?m.category:t.category;return m.name===t.merchant&&category===t.category?t:{...t,merchant:m.name,category};}
export function tidyData(data:Data):Data|null{const names=data.categories.map(c=>c.name);let changed=false;const transactions=data.transactions.map(t=>{const n=tidyTransaction(t,names);if(n!==t)changed=true;return n;});return changed?{...data,transactions}:null;}
