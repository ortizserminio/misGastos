import {useEffect,useRef,useState} from 'react';
import {LocateFixed,Navigation,Search} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {distanceKm,priceTier,type Point,type Station} from './fuel';

type Props={stations:Station[];here?:Point;onLocate:(onLocated:(point:Point)=>void)=>void};
const price=(n:number)=>n.toFixed(3).replace('.',',');
const maps=(s:Station)=>`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`;

export default function FuelMap({stations,here,onLocate}:Props){
 const container=useRef<HTMLDivElement>(null),mapRef=useRef<L.Map|null>(null);
 const [selected,setSelected]=useState(stations[0]);
 const cheapest=Math.min(...stations.map(s=>s.price));
 useEffect(()=>{setSelected(stations[0]);},[stations]);
 useEffect(()=>{
  if(!container.current)return;
  const map=L.map(container.current,{zoomControl:false});mapRef.current=map;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  const style=getComputedStyle(document.documentElement);
  const color=(name:string)=>style.getPropertyValue(name).trim();
  const prices=stations.map(s=>s.price);
  const tiers=[color('--color-positive'),color('--color-warning'),color('--color-border-control')];
  const dots=L.layerGroup().addTo(map),pins=L.layerGroup().addTo(map);
  for(const s of stations){L.circleMarker([s.lat,s.lon],{radius:4,color:color('--color-surface'),weight:1.2,fillColor:tiers[priceTier(s.price,prices)],fillOpacity:1}).on('click',()=>setSelected(s)).addTo(dots);}
  const renderPins=()=>{
   pins.clearLayers();
   const visible=stations.filter(s=>map.getBounds().contains([s.lat,s.lon])).sort((a,b)=>a.price-b.price).slice(0,25);
   const painted:L.Point[]=[];
   for(const s of visible){
    const point=map.latLngToContainerPoint([s.lat,s.lon]);
    if(s.price!==cheapest&&painted.some(p=>Math.abs(p.x-point.x)<56&&Math.abs(p.y-point.y)<26))continue;
    painted.push(point);
    const best=s.price===cheapest;
    const icon=L.divIcon({className:'fuel-pin-wrap',html:`<span class="fuel-pin${best?' fuel-pin-best':''}">${price(s.price)}${best?' €':''}</span>`,iconSize:[0,0]});
    L.marker([s.lat,s.lon],{icon,zIndexOffset:best?1000:0}).on('click',()=>setSelected(s)).addTo(pins);
   }
  };
  map.on('moveend zoomend',renderPins);
  const bounds=L.latLngBounds(stations.map(s=>[s.lat,s.lon] as [number,number]));
  map.fitBounds(bounds.pad(.08),{padding:[28,28],maxZoom:13});
  renderPins();
  return()=>{map.off('moveend zoomend',renderPins);map.remove();mapRef.current=null;};
 },[stations,cheapest]);
 useEffect(()=>{if(!here||!mapRef.current)return;const map=mapRef.current;const style=getComputedStyle(document.documentElement);const marker=L.circleMarker([here.lat,here.lon],{radius:7,color:style.getPropertyValue('--color-surface').trim(),weight:2,fillColor:style.getPropertyValue('--color-primary').trim(),fillOpacity:1}).addTo(map);return()=>{marker.remove();};},[here,stations]);
 return <div className="fuel-map-card"><div className="fuel-map-canvas" ref={container}/><div className="fuel-map-tip"><Search size={15}/>Las 25 más baratas · acerca para ver más</div><button className="fuel-map-locate" type="button" aria-label="Centrar en mi ubicación" onClick={()=>onLocate(point=>mapRef.current?.setView([point.lat,point.lon],13))}><LocateFixed size={20}/></button>{selected&&<div className="fuel-map-detail"><div className="fuel-map-detail-info">{selected.price===cheapest&&<span className="fuel-map-best-label">La más barata</span>}<strong>{selected.name}</strong><small>{selected.town}{here?` · ${distanceKm(selected,here).toFixed(1).replace('.',',')} km`:''}</small></div><div className="fuel-map-detail-action"><strong>{price(selected.price)} €/L</strong><a href={maps(selected)} target="_blank" rel="noopener"><Navigation size={15}/>Cómo llegar</a></div></div>}</div>;
}
