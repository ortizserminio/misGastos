import {describe,it,expect} from 'vitest';
import {FUELS,parseStations,sortStations,distanceKm,priceTier,PROVINCE_CENTERS,nearestProvince} from './fuel';

const data={ListaEESSPrecio:[
 {IDEESS:'1','Rótulo':'REPSOL',Dirección:'Calle uno',Localidad:'MADRID',Latitud:'40,4168','Longitud (WGS84)':'-3,7038','Precio Gasolina 95 E5':'1,399'},
 {IDEESS:'2','Rótulo':'CEPSA',Dirección:'Calle dos',Localidad:'BARCELONA',Latitud:'41,3874','Longitud (WGS84)':'2,1686','Precio Gasolina 95 E5':'1,410'},
 {IDEESS:'3','Rótulo':'SIN PRECIO',Dirección:'Calle tres',Localidad:'MADRID',Latitud:'40,5','Longitud (WGS84)':'-3,7','Precio Gasolina 95 E5':''},
 {IDEESS:'4','Rótulo':'SIN COORDENADAS',Dirección:'Calle cuatro',Localidad:'MADRID',Latitud:'x','Longitud (WGS84)':'-3,7','Precio Gasolina 95 E5':'1,200'},
 {IDEESS:'5','Rótulo':'EN CERO',Dirección:'Calle cinco',Localidad:'VALDEMORO',Latitud:'0,000000','Longitud (WGS84)':'0,000000','Precio Gasolina 95 E5':'1,100'},
]};
describe('fuel',()=>{
 const stations=parseStations(data,FUELS[0].field);
 it('parses decimal commas and readable names, excluding unavailable or invalid stations',()=>{expect(stations).toHaveLength(2);expect(stations[0]).toMatchObject({name:'Repsol',town:'Madrid',price:1.399,lat:40.4168});});
 it('sorts by price',()=>{expect(sortStations([...stations].reverse(),'price').map(s=>s.id)).toEqual(['1','2']);});
 it('sorts by distance',()=>{expect(sortStations(stations,'near',{lat:41.4,lon:2.17}).map(s=>s.id)).toEqual(['2','1']);});
 it('measures Madrid to Barcelona',()=>{expect(distanceKm(stations[0],stations[1])).toBeGreaterThan(495);expect(distanceKm(stations[0],stations[1])).toBeLessThan(515);});
 it('finds the nearest province capital',()=>{
  expect(Object.keys(PROVINCE_CENTERS)).toHaveLength(52);
  expect(nearestProvince({lat:37.60,lon:-0.98})).toBe('30');
  expect(nearestProvince({lat:40.31,lon:-3.73})).toBe('28');
  expect(nearestProvince({lat:28.10,lon:-15.41})).toBe('35');
  expect(nearestProvince({lat:43.26,lon:-2.93})).toBe('48');
 });
 it('assigns prices to sorted thirds regardless of input order',()=>{const prices=[6,1,4,2,5,3];expect(prices.map(p=>priceTier(p,prices))).toEqual([2,0,1,0,2,1]);});
 it('handles empty and tied price lists',()=>{expect(priceTier(1,[])).toBe(0);expect(priceTier(1,[1,1,1])).toBe(0);});
});
