import {expect,it} from 'vitest';
import {assetValue,portfolioHistory,parseAssetValue,validateAssets,type Asset} from './assets';
import {validateBackup,emptyData} from './domain';
const asset:Asset={id:'a',type:'Cuenta',bank:'N26',name:'N26',color:'#174B47',notes:'',valuations:[{date:'2026-09-20',valueCents:10000},{date:'2026-09-22',valueCents:12500}]};
it('preserves dated valuations and carries forward each asset at its recorded dates',()=>{expect(assetValue(asset)).toBe(12500);expect(portfolioHistory([asset,{...asset,id:'b',valuations:[{date:'2026-09-21',valueCents:5000}]}])).toEqual([{date:'2026-09-20',valueCents:10000},{date:'2026-09-21',valueCents:15000},{date:'2026-09-22',valueCents:17500}]);});
it('supports zero and negative balances with exact cents',()=>{expect(parseAssetValue('0')).toBe(0);expect(parseAssetValue('-10,05')).toBe(-1005);expect(()=>parseAssetValue('1.000,01')).toThrow();});
it('migrates old backups and preserves new assets',()=>{expect(validateBackup(JSON.stringify({version:1,transactions:[],accounts:['Efectivo'],budgets:{}})).assets).toEqual([]);const data={...emptyData(),assets:[asset]};expect(validateBackup(JSON.stringify(data))).toEqual(data);});
it('rejects malformed and duplicate valuation data',()=>{expect(()=>validateAssets([{...asset,valuations:[{date:'2026-02-30',valueCents:2}]}])).toThrow();expect(()=>validateAssets([asset,asset])).toThrow();expect(()=>validateAssets([{...asset,color:'red'}])).toThrow();});
