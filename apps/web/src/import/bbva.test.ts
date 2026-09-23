import {it,expect} from 'vitest';
import {isBbva,parseBbva} from './bbva';
const w=(x:number,y:number,str:string)=>({x,y,str});
const page=[w(40,731,'Últimos'),w(129,731,'movimientos'),w(45,701,'Fecha'),w(145,701,'Concepto'),w(440,701,'Importe'),w(504,701,'Saldo'),
 w(45,681,'20/04/2026'),w(145,681,'TRANSFERENCIA'),w(234,681,'REALIZADA'),w(454,683,'-10,00 €'),w(522,683,'1,74 €'),w(45,671,'Fecha'),w(68,671,'valor'),w(88,671,'18/04/2026'),w(145,671,'PARA'),w(168,671,'Ana'),w(195,671,'Prueba'),w(230,671,'Ejemplo'),
 w(45,652,'02/04/2026'),w(145,652,'ABONO'),w(180,652,'DE'),w(200,652,'NÓMINA'),w(452,654,'660,16 €'),w(517,654,'11,74 €'),w(45,642,'Fecha'),w(68,642,'valor'),w(88,642,'02/04/2026'),w(145,642,'EMPRESA'),w(190,642,'DEMO'),
 w(45,623,'01/04/2026'),w(145,623,'RETIRADA'),w(190,623,'DE'),w(205,623,'EFECTIVO'),w(440,625,'-1000,00 €'),w(515,625,'-648,42 €'),w(45,613,'Fecha'),w(68,613,'valor'),w(88,613,'01/04/2026'),w(145,613,'CAJERO'),
 w(218,24,'Registro'),w(349,24,'Mercantil')];
it('reads bbva rows, own transfer counterparty and opening balance',()=>{expect(isBbva([page])).toBe(true);const st=parseBbva([page]);expect(st.rows.map(r=>[r.date,r.amountCents,r.kind])).toEqual([['2026-04-20',-1000,'transfer'],['2026-04-02',66016,'salary'],['2026-04-01',-100000,'cash']]);expect(st.rows[0]).toMatchObject({counterpartyName:'Ana Prueba Ejemplo',description:'TRANSFERENCIA REALIZADA · PARA Ana Prueba Ejemplo'});expect(st.opening).toEqual({date:'2026-04-01',valueCents:35158});expect(st.rows[0].externalId).toMatch(/^bbva:/);});
