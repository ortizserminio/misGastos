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
