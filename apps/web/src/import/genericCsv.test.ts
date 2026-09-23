import {it,expect} from 'vitest';
import {guessMapping,parseGenericCsv} from './genericCsv';
it('guesses columns and reads any bank csv',()=>{const rows=[['Fecha','Concepto','Importe'],['01/09/2026','Supermercado','-12,30'],['02/09/2026','Nómina','1.200,00']];const m=guessMapping(rows[0]);expect(m).toEqual({date:0,description:1,amount:2});const st=parseGenericCsv(rows,m,'Mi banco');expect(st.rows.map(r=>r.amountCents)).toEqual([-1230,120000]);expect(st.rows[0].externalId).toMatch(/^csv-mi-banco:/);expect(()=>parseGenericCsv(rows,{...m,amount:-1},'X')).toThrow();});
