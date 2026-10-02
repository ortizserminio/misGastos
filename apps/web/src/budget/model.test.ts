import {describe,it,expect} from 'vitest';
import {emptyData,validateBackup,parseMoney} from '../domain';
import {planForMonth,saveMonthPlan,monthlyRecurring,goalQuota,budgetSummary,validatePlanning,renameCategoryLimit,historicalPlannedSavingsCents,snapshotSavingsMonth} from './model';

const expense={id:'tx-1',type:'expense' as const,amountCents:2500,merchant:'Demo',bank:'Efectivo',category:'Ocio',date:'2026-10-10',source:'manual' as const};

describe('planning migration',()=>{
  it('preserves transactions and legacy monthly budgets from v1 and v2 backups',()=>{
    for(const version of [1,2]){
      const legacy={...emptyData(),version,planning:undefined,transactions:[expense],budgets:{'2026-09':12345,'2026-10':20000}};
      const restored=validateBackup(JSON.stringify(legacy));
      expect(restored.version).toBe(3);
      expect(restored.transactions).toEqual([expense]);
      expect(restored.budgets).toEqual(legacy.budgets);
      expect(restored.planning.months['2026-09'].plannedSpendCents).toBe(12345);
      expect(restored.planning.months['2026-10'].plannedSpendCents).toBe(20000);
    }
  });
  it('rejects invalid planning amounts and dates on restore',()=>{
    const d=emptyData();
    for(const bad of [-1,1.5,Number.NaN]){
      expect(()=>validatePlanning({...d.planning,months:{'2026-10':{...planForMonth(d,'2026-10'),plannedSpendCents:bad}}})).toThrow();
    }
    expect(()=>validatePlanning({...d.planning,goals:[{id:'goal',name:'Demo',targetCents:12000,currentCents:0,targetDate:'2026-02-30'}]})).toThrow();
  });
  it('rejects empty, negative and extra decimal money input',()=>{
    for(const bad of ['', '-1', '1,001'])expect(()=>parseMoney(bad)).toThrow();
  });
});

describe('pure budget calculations',()=>{
  it('monthlyizes an annual 49.99 expense exactly, with display rounding only',()=>{
    const recurring=[{id:'rec',name:'Annual demo',amountCents:4999,cadence:'yearly' as const,nextDate:'2026-10-01',category:'Ocio',kind:'expense' as const,status:'active' as const}];
    expect(monthlyRecurring(recurring)).toBeCloseTo(4999/12,10);
    const d=emptyData();d.planning.recurrents=recurring;
    const s=budgetSummary(d,'2026-10');
    expect(s.fixedExpenseMonthlyCents).toBeCloseTo(4999/12,10);
    expect(Math.round(s.fixedExpenseMonthlyCents)).toBe(417);
    expect(d.transactions).toEqual([]);
  });
  it('clones the latest previous month virtually and persists only on edit',()=>{
    const d=emptyData();
    const saved=saveMonthPlan(d,'2026-09',{plannedSpendCents:9000,categoryLimits:{Ocio:3000}});
    const october=planForMonth(saved,'2026-10');
    expect(october.plannedSpendCents).toBe(9000);
    expect(saved.planning.months['2026-10']).toBeUndefined();
    const edited=saveMonthPlan(saved,'2026-10',{incomeTotalCents:10000});
    expect(edited.planning.months['2026-10']).toMatchObject({plannedSpendCents:9000,incomeTotalCents:10000});
    const septemberAgain=saveMonthPlan(edited,'2026-09',{plannedSpendCents:30000});
    expect(planForMonth(septemberAgain,'2026-10').plannedSpendCents).toBe(9000);
    expect(saved.transactions).toEqual([]);
  });
  it('keeps deleted category limits visible and moves them on explicit rename',()=>{
    const d=saveMonthPlan(emptyData(),'2026-10',{categoryLimits:{Ocio:1500}});
    const renamed=renameCategoryLimit(d,'Ocio','Tiempo libre');
    expect(planForMonth(renamed,'2026-10').categoryLimits).toEqual({'Tiempo libre':1500});
    expect(planForMonth(d,'2026-10').categoryLimits).toEqual({Ocio:1500});
    d.categories=d.categories.filter(c=>c.name!=='Ocio');
    expect(budgetSummary(d,'2026-10').categories).toContainEqual(expect.objectContaining({category:'Ocio',limitCents:1500,orphaned:true}));
  });
  it('preserves prototype-like category names in planning backup',()=>{
    const d=saveMonthPlan(emptyData(),'2026-10',{categoryLimits:JSON.parse('{"__proto__":1200,"constructor":500}')});
    const restored=validateBackup(JSON.stringify(d));
    expect(Object.entries(restored.planning.months['2026-10'].categoryLimits)).toEqual([['__proto__',1200],['constructor',500]]);
  });
  it('treats constructor spending without a limit as zero-limit spending',()=>{
    const d=emptyData();d.transactions=[{...expense,category:'constructor'}];
    expect(budgetSummary(d,'2026-10').categories).toContainEqual(expect.objectContaining({category:'constructor',limitCents:0,actualCents:2500,remainingCents:-2500}));
  });
  it('keeps a limit when a category rename uses the same name',()=>{
    const d=saveMonthPlan(emptyData(),'2026-10',{categoryLimits:{Ocio:1500}});
    expect(planForMonth(renameCategoryLimit(d,'Ocio','Ocio'),'2026-10').categoryLimits).toEqual({Ocio:1500});
  });
  it('carries only recurring income items into a newly inherited month',()=>{
    const d=saveMonthPlan(emptyData(),'2026-09',{incomeTotalCents:9000,incomeItems:[{id:'one',name:'Sueldo',amountCents:7000,recurring:true},{id:'two',name:'Venta puntual',amountCents:2000,recurring:false}]});
    expect(planForMonth(d,'2026-10').incomeItems.map(item=>item.id)).toEqual(['one']);
    expect(d.planning.months['2026-10']).toBeUndefined();
    expect(saveMonthPlan(d,'2026-10',{plannedSpendCents:1000}).planning.months['2026-10'].incomeItems.map(item=>item.id)).toEqual(['one']);
    expect(planForMonth(d,'2026-09').incomeItems.map(item=>item.id)).toEqual(['one','two']);
  });
  it('computes 120 euros over 60 months as two euros per month',()=>{
    const goal={id:'g',name:'Demo',targetCents:12000,currentCents:0,targetDate:'2031-09-01'};
    expect(goalQuota(goal,'2026-10')).toBe(200);
    expect(goalQuota({...goal,currentCents:12000},'2026-10')).toBe(0);
  });
  it('keeps a saved month goal quota in history after the goal is completed',()=>{
    const d=emptyData();d.planning.goals=[{id:'g',name:'Demo',targetCents:12000,currentCents:0,targetDate:'2031-09-01'}];
    const saved=saveMonthPlan(d,'2026-10',{unassignedSavingsCents:300});
    expect(historicalPlannedSavingsCents(saved,'2026-10')).toBe(500);
    const completed={...saved,planning:{...saved.planning,goals:[{...saved.planning.goals[0],currentCents:12000}]}};
    expect(budgetSummary(completed,'2026-10').goalQuotaCents).toBe(0);
    expect(historicalPlannedSavingsCents(completed,'2026-10')).toBe(500);
  });
  it('marks legacy months without a savings snapshot as unavailable',()=>{
    const legacy={...emptyData(),planning:{...emptyData().planning,months:{'2026-10':{...planForMonth(emptyData(),'2026-10'),plannedSpendCents:1000}}}} as any;
    delete legacy.planning.months['2026-10'].goalSavingsSnapshotCents;
    const restored=validateBackup(JSON.stringify(legacy));
    expect(historicalPlannedSavingsCents(restored,'2026-10')).toBeNull();
    expect(()=>validatePlanning({...restored.planning,months:{'2026-10':{...restored.planning.months['2026-10'],goalSavingsSnapshotCents:-1}}})).toThrow();
  });
  it('can explicitly refresh the current month snapshot after goals change',()=>{
    const saved=saveMonthPlan(emptyData(),'2026-10',{});
    const withGoal={...saved,planning:{...saved.planning,goals:[{id:'g',name:'Demo',targetCents:12000,currentCents:0,targetDate:'2031-09-01'}]}};
    expect(historicalPlannedSavingsCents(withGoal,'2026-10')).toBe(0);
    expect(historicalPlannedSavingsCents(snapshotSavingsMonth(withGoal,'2026-10'),'2026-10')).toBe(200);
  });
  it('does not rewrite saved goal history when actual savings are annotated later',()=>{
    const d=emptyData();d.planning.goals=[{id:'g',name:'Demo',targetCents:12000,currentCents:0,targetDate:'2031-09-01'}];
    const october=saveMonthPlan(d,'2026-10',{unassignedSavingsCents:300});
    const completed={...october,planning:{...october.planning,goals:[{...october.planning.goals[0],currentCents:12000}]}};
    const annotated=saveMonthPlan(completed,'2026-10',{actualSavingsCents:400});
    expect(annotated.planning.months['2026-10'].goalSavingsSnapshotCents).toBe(200);
    expect(historicalPlannedSavingsCents(annotated,'2026-10')).toBe(500);
    expect(annotated.planning.months['2026-10'].actualSavingsCents).toBe(400);
    expect(historicalPlannedSavingsCents(snapshotSavingsMonth(annotated,'2026-10'),'2026-10')).toBe(300);
  });
  it('rounds a fractional goal quota only when persisting the monthly snapshot',()=>{
    const d=emptyData();d.planning.goals=[{id:'fractional',name:'Demo',targetCents:10000,currentCents:0,targetDate:'2031-09-01'}];
    expect(goalQuota(d.planning.goals[0],'2026-10')).toBeCloseTo(10000/60,10);
    const saved=snapshotSavingsMonth(d,'2026-10');
    expect(saved.planning.months['2026-10'].goalSavingsSnapshotCents).toBe(167);
    expect(historicalPlannedSavingsCents(saved,'2026-10')).toBe(167);
    expect(budgetSummary(saved,'2026-10').goalQuotaCents).toBeCloseTo(10000/60,10);
    expect(validateBackup(JSON.stringify(saved)).planning.months['2026-10'].goalSavingsSnapshotCents).toBe(167);
  });
  it('uses only transactions for actuals and leaves signed plan deficit visible',()=>{
    const d=saveMonthPlan(emptyData(),'2026-10',{incomeTotalCents:1000,plannedSpendCents:3000});d.transactions=[expense];
    const s=budgetSummary(d,'2026-10');
    expect(s.actualSpendCents).toBe(2500);
    expect(s.planBalanceCents).toBe(-2000);
    expect(s.actualIncomeCents).toBe(0);
    expect(d.transactions).toEqual([expense]);
  });
});
