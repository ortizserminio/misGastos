import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Navigation} from 'lucide-react';
import {FUELS,parseStations,sortStations,distanceKm,type Point,type Station} from './fuel';
import './settings.css';
import './gasolineras.css';

const BASE='https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/';
const KEY='mg-gasolineras';
type Province={IDPovincia:string;Provincia:string};
type Prefs={province:string;fuel:number;mode:'price'|'near'};
function saved():Prefs{try{const v=JSON.parse(localStorage.getItem(KEY)??'{}');return {province:typeof v.province==='string'?v.province:'',fuel:Number.isInteger(v.fuel)&&v.fuel>=0&&v.fuel<FUELS.length?v.fuel:0,mode:v.mode==='near'?'near':'price'};}catch{return {province:'',fuel:0,mode:'price'};}}
const euro=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
const price=(n:number)=>n.toFixed(3).replace('.',',');
const maps=(s:Station)=>`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`;
export default function Gasolineras({onBack}:{onBack:()=>void}){
 const [initial]=useState(saved),[province,setProvince]=useState(initial.province),[fuel,setFuel]=useState(initial.fuel),[mode,setMode]=useState<'price'|'near'>(initial.mode);
 const [provinces,setProvinces]=useState<Province[]>([]),[raw,setRaw]=useState<unknown>(null),[date,setDate]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(false),[locationError,setLocationError]=useState(false),[here,setHere]=useState<Point>(),[retry,setRetry]=useState(0);
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify({province,fuel,mode}));}catch{}},[province,fuel,mode]);
 useEffect(()=>{const controller=new AbortController();fetch(BASE+'Listados/Provincias/',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(v=>{if(!Array.isArray(v))throw Error();setProvinces(v);}).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>controller.abort();},[retry]);
 useEffect(()=>{if(!province){setRaw(null);setDate('');return;}const controller=new AbortController();setLoading(true);setError(false);setRaw(null);fetch(BASE+`EstacionesTerrestres/FiltroProvincia/${encodeURIComponent(province)}`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(v=>{if(!Array.isArray(v?.ListaEESSPrecio))throw Error();setRaw(v);setDate(String(v.Fecha??''));setLoading(false);}).catch(e=>{if(e.name!=='AbortError'){setError(true);setLoading(false);}});return()=>controller.abort();},[province,retry]);
 function chooseMode(next:'price'|'near'){if(next==='price'){setMode(next);setLocationError(false);return;}if(here){setMode('near');setLocationError(false);return;}if(!navigator.geolocation){setMode('price');setLocationError(true);return;}navigator.geolocation.getCurrentPosition(p=>{setHere({lat:p.coords.latitude,lon:p.coords.longitude});setMode('near');setLocationError(false);},()=>{setMode('price');setLocationError(true);});}
 useEffect(()=>{if(mode==='near'&&!here)chooseMode('near');},[]);
 const stations=useMemo(()=>sortStations(parseStations(raw,FUELS[fuel].field),mode,here),[raw,fuel,mode,here]);
 const first=stations[0],cheapest=stations.length?Math.min(...stations.map(s=>s.price)):0;
 const distance=(s:Station)=>here?` · ${distanceKm(s,here).toFixed(1).replace('.',',')} km`:'';
 const provinceName=provinces.find(p=>p.IDPovincia===province)?.Provincia.toLocaleLowerCase('es-ES').replace(/(^|\s)\p{L}/gu,s=>s.toLocaleUpperCase('es-ES'))??'esta provincia';
 return <div className="settings gasolineras"><header className="set-page-head"><button className="icon-button" aria-label="Volver" onClick={onBack}><ArrowLeft/></button><h1>Gasolineras</h1></header>
  <p className="hint">Precios de hoy en todas las gasolineras de tu provincia.</p>
  <div className="fuel-chips" role="group" aria-label="Combustible">{FUELS.map((f,i)=><button type="button" key={f.field} aria-pressed={fuel===i} onClick={()=>setFuel(i)}>{f.label}</button>)}</div>
  <div className="fuel-controls"><label>Provincia<select value={province} onChange={e=>setProvince(e.target.value)}><option value="">Elige tu provincia</option>{provinces.map(p=><option key={p.IDPovincia} value={p.IDPovincia}>{p.Provincia}</option>)}</select></label><div className="fuel-mode" role="group" aria-label="Ordenar"><button type="button" aria-pressed={mode==='price'} onClick={()=>chooseMode('price')}>Más baratas</button><button type="button" aria-pressed={mode==='near'} onClick={()=>chooseMode('near')}>Más cerca</button></div></div>
  {locationError&&<p className="error" role="alert">No tenemos acceso a tu ubicación. Actívala en los ajustes del móvil para ver las más cercanas.</p>}
  {error?<div className="set-card fuel-message"><p>No se han podido cargar los precios. Revisa la conexión y vuelve a intentarlo.</p><button className="primary" onClick={()=>setRetry(n=>n+1)}>Reintentar</button></div>:loading?<p className="fuel-message" role="status">Buscando los precios de hoy…</p>:!province?<p className="fuel-message">Elige tu provincia para ver los precios de hoy.</p>:raw&&!first?<p className="fuel-message">Ninguna gasolinera de {provinceName} tiene {FUELS[fuel].label} ahora mismo. Prueba con otro combustible.</p>:first&&<>
   <section className="fuel-feature"><span className="eyebrow">{mode==='near'?'La más cercana':'La más barata'}</span><div className="fuel-big-price">{price(first.price)} <small>€/L</small></div><h2>{first.name}</h2><p>{first.town}{distance(first)}</p><p>Llenar 50 L: <strong>{euro.format(first.price*50)}</strong></p><a href={maps(first)} target="_blank" rel="noopener"><Navigation size={17}/> Cómo llegar</a></section>
   {stations.length>1&&<section className="set-card fuel-options"><h2>Más opciones</h2>{stations.slice(1,21).map(s=><a className="set-row" key={s.id} href={maps(s)} target="_blank" rel="noopener" aria-label={`${s.name}, ${s.town}, ${price(s.price)} euros por litro`}><span className="set-label"><strong>{s.name}</strong><small>{s.town}{distance(s)}</small></span><span className="fuel-row-price"><strong>{price(s.price)} €</strong><small>+{price(s.price-cheapest)} €</small></span></a>)}</section>}
   <p className="hint fuel-source">Precios oficiales del Gobierno de España, actualizados a las {date.match(/\b\d{2}:\d{2}\b/)?.[0]??'--:--'}.</p>
  </>}
 </div>;
}
