import type {Data} from '../domain';

export type IncomeItem={id:string;name:string;amountCents:number;recurring:boolean};
export type MonthPlan={incomeTotalCents:number;incomeItems:IncomeItem[];plannedSpendCents:number;categoryLimits:Record<string,number>;unassignedSavingsCents:number;actualSavingsCents:number;goalSavingsSnapshotCents?:number|null};
export type Recurring={id:string;name:string;amountCents:number;cadence:'monthly'|'quarterly'|'yearly';nextDate:string;category:string;kind:'expense'|'investment';status:'active'|'paused'|'cancelled'};
export type Debt={id:string;direction:'owedToMe'|'iOwe';counterparty:string;originalCents:number;paidCents:number;dueDate?:string;reminder:boolean};
export type SavingsGoal={id:string;name:string;targetCents:number;currentCents:number;targetDate:string};
export type BudgetData={months:Record<string,MonthPlan>;recurrents:Recurring[];debts:Debt[];goals:SavingsGoal[]};
export type BudgetCategory={category:string;limitCents:number;actualCents:number;remainingCents:number;orphaned:boolean};
export type BudgetSummary={month:string;plan:MonthPlan;plannedIncomeCents:number;actualIncomeCents:number;plannedSpendCents:number;actualSpendCents:number;fixedExpenseMonthlyCents:number;fixedInvestmentMonthlyCents:number;goalQuotaCents:number;plannedSavingsCents:number;actualSavingsCents:number;planBalanceCents:number;availableSpendCents:number;categories:BudgetCategory[]};

export const emptyMonthPlan=():MonthPlan=>({incomeTotalCents:0,incomeItems:[],plannedSpendCents:0,categoryLimits:{},unassignedSavingsCents:0,actualSavingsCents:0,goalSavingsSnapshotCents:null});
export const emptyPlanning=():BudgetData=>({months:{},recurrents:[],debts:[],goals:[]});
const monthPattern=/^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const validDate=(date:unknown):date is string=>typeof date==='string'&&datePattern.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
const label=(value:unknown)=>typeof value==='string'&&value.trim().length>0&&value.length<=200;
const cents=(value:unknown,positive=false)=>Number.isSafeInteger(value)&&Number(value)>=(positive?1:0)&&Number(value)<=99999999;
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const uniqueIds=(items:{id:string}[])=>new Set(items.map(item=>item.id)).size===items.length;
const invalid=():never=>{throw Error('Planificación no válida. Revisa fechas, importes y campos.');};

export function validatePlanning(value:unknown):BudgetData{
  if(!record(value)||!record(value.months)||!Array.isArray(value.recurrents)||!Array.isArray(value.debts)||!Array.isArray(value.goals))return invalid();
  const months:Record<string,MonthPlan>={};
  for(const [month,raw] of Object.entries(value.months)){
    if(!monthPattern.test(month)||!record(raw)||!cents(raw.incomeTotalCents)||!Array.isArray(raw.incomeItems)||!cents(raw.plannedSpendCents)||!record(raw.categoryLimits)||!cents(raw.unassignedSavingsCents)||!cents(raw.actualSavingsCents)||(raw.goalSavingsSnapshotCents!==undefined&&raw.goalSavingsSnapshotCents!==null&&!cents(raw.goalSavingsSnapshotCents)))return invalid();
    const incomeItems=raw.incomeItems as IncomeItem[];
    if(incomeItems.length>500||!incomeItems.every(item=>record(item)&&label(item.id)&&label(item.name)&&cents(item.amountCents,true)&&typeof item.recurring==='boolean')||!uniqueIds(incomeItems))return invalid();
    const categoryLimits:Record<string,number>=Object.create(null);
    for(const [name,amount] of Object.entries(raw.categoryLimits)){
      if(!label(name)||name.length>40||!cents(amount))return invalid();
      categoryLimits[name]=amount as number;
    }
    months[month]={incomeTotalCents:raw.incomeTotalCents as number,incomeItems:incomeItems.map(item=>({id:item.id,name:item.name,amountCents:item.amountCents,recurring:item.recurring})),plannedSpendCents:raw.plannedSpendCents as number,categoryLimits,unassignedSavingsCents:raw.unassignedSavingsCents as number,actualSavingsCents:raw.actualSavingsCents as number,goalSavingsSnapshotCents:raw.goalSavingsSnapshotCents===undefined?null:raw.goalSavingsSnapshotCents as number|null};
  }
  const recurrents=value.recurrents as Recurring[];
  if(recurrents.length>500||!recurrents.every(item=>record(item)&&label(item.id)&&label(item.name)&&cents(item.amountCents,true)&&['monthly','quarterly','yearly'].includes(item.cadence)&&validDate(item.nextDate)&&label(item.category)&&['expense','investment'].includes(item.kind)&&['active','paused','cancelled'].includes(item.status))||!uniqueIds(recurrents))return invalid();
  const debts=value.debts as Debt[];
  if(debts.length>500||!debts.every(item=>record(item)&&label(item.id)&&['owedToMe','iOwe'].includes(item.direction)&&label(item.counterparty)&&cents(item.originalCents,true)&&cents(item.paidCents)&&item.paidCents<=item.originalCents&&(item.dueDate===undefined||validDate(item.dueDate))&&typeof item.reminder==='boolean')||!uniqueIds(debts))return invalid();
  const goals=value.goals as SavingsGoal[];
  if(goals.length>500||!goals.every(item=>record(item)&&label(item.id)&&label(item.name)&&cents(item.targetCents,true)&&cents(item.currentCents)&&validDate(item.targetDate))||!uniqueIds(goals))return invalid();
  return {months,recurrents:recurrents.map(item=>({...item})),debts:debts.map(item=>({...item})),goals:goals.map(item=>({...item}))};
}

export function planForMonth(data:Data,month:string):MonthPlan{
  if(!monthPattern.test(month))throw Error('Mes no válido.');
  const configured=data.planning.months[month];
  const previous=Object.keys(data.planning.months).filter(key=>key<month).sort().at(-1);
  const source=configured??(previous?data.planning.months[previous]:emptyMonthPlan());
  return {...source,incomeItems:source.incomeItems.filter(item=>configured||item.recurring).map(item=>({...item})),categoryLimits:{...source.categoryLimits},actualSavingsCents:configured?.actualSavingsCents??0,goalSavingsSnapshotCents:configured?.goalSavingsSnapshotCents??null};
}
export function saveMonthPlan(data:Data,month:string,changes:Partial<MonthPlan>):Data{
  const current=planForMonth(data,month);
  const goalSavingsSnapshotCents=changes.goalSavingsSnapshotCents??current.goalSavingsSnapshotCents??Math.round(data.planning.goals.reduce((sum,goal)=>sum+goalQuota(goal,month),0));
  const next=validatePlanning({...data.planning,months:{...data.planning.months,[month]:{...current,...changes,goalSavingsSnapshotCents}}});
  return {...data,planning:next};
}
export function snapshotSavingsMonth(data:Data,month:string):Data{
  const goalSavingsSnapshotCents=Math.round(data.planning.goals.reduce((sum,goal)=>sum+goalQuota(goal,month),0));
  return saveMonthPlan(data,month,{goalSavingsSnapshotCents});
}
export function historicalPlannedSavingsCents(data:Data,month:string):number|null{
  const plan=data.planning.months[month];
  return plan?.goalSavingsSnapshotCents===null||plan?.goalSavingsSnapshotCents===undefined?null:plan.goalSavingsSnapshotCents+plan.unassignedSavingsCents;
}
export function renameCategoryLimit(data:Data,oldName:string,newName:string):Data{
  if(!label(newName)||newName.length>40)throw Error('Categoría no válida.');
  if(oldName===newName)return data;
  const months:Record<string,MonthPlan>={};
  for(const [month,plan] of Object.entries(data.planning.months)){
    const limits={...plan.categoryLimits};
    if(Object.hasOwn(limits,oldName)){
      if(Object.hasOwn(limits,newName)&&oldName!==newName)throw Error('La categoría nueva ya tiene un límite.');
      limits[newName]=limits[oldName];delete limits[oldName];
    }
    months[month]={...plan,categoryLimits:limits};
  }
  return {...data,planning:{...data.planning,months}};
}
export const debtBalance=(debt:Debt)=>Math.max(0,debt.originalCents-debt.paidCents);
export function monthlyRecurring(items:Recurring[]):number{return items.filter(item=>item.status==='active').reduce((sum,item)=>sum+item.amountCents/(item.cadence==='monthly'?1:item.cadence==='quarterly'?3:12),0);}
export function goalQuota(goal:SavingsGoal,month:string):number{
  if(!monthPattern.test(month))throw Error('Mes no válido.');
  const remaining=Math.max(0,goal.targetCents-goal.currentCents);
  if(!remaining)return 0;
  const [year,m]=month.split('-').map(Number),[targetYear,targetMonth]=goal.targetDate.slice(0,7).split('-').map(Number);
  const count=Math.max(1,(targetYear-year)*12+targetMonth-m+1);
  return remaining/count;
}
export function budgetSummary(data:Data,month:string):BudgetSummary{
  const plan=planForMonth(data,month);
  const actual=data.transactions.filter(item=>item.date.startsWith(month));
  const expenses=actual.filter(item=>item.type==='expense');
  const actualSpendCents=expenses.reduce((sum,item)=>sum+item.amountCents,0);
  const actualIncomeCents=actual.filter(item=>item.type==='income').reduce((sum,item)=>sum+item.amountCents,0);
  const fixedExpenseMonthlyCents=monthlyRecurring(data.planning.recurrents.filter(item=>item.kind==='expense'));
  const fixedInvestmentMonthlyCents=monthlyRecurring(data.planning.recurrents.filter(item=>item.kind==='investment'));
  const goalQuotaCents=data.planning.goals.reduce((sum,goal)=>sum+goalQuota(goal,month),0);
  const plannedIncomeCents=plan.incomeItems.length?plan.incomeItems.reduce((sum,item)=>sum+item.amountCents,0):plan.incomeTotalCents;
  const plannedSavingsCents=goalQuotaCents+plan.unassignedSavingsCents;
  const spent:Record<string,number>=Object.create(null);
  for(const item of expenses)spent[item.category]=(spent[item.category]??0)+item.amountCents;
  const names=new Set([...Object.keys(plan.categoryLimits),...Object.keys(spent)]);
  const known=new Set(data.categories.map(item=>item.name));
  const categories=[...names].map(category=>{const limitCents=Object.hasOwn(plan.categoryLimits,category)?plan.categoryLimits[category]:0;const actualCents=spent[category]??0;return {category,limitCents,actualCents,remainingCents:limitCents-actualCents,orphaned:!known.has(category)};});
  return {month,plan,plannedIncomeCents,actualIncomeCents,plannedSpendCents:plan.plannedSpendCents,actualSpendCents,fixedExpenseMonthlyCents,fixedInvestmentMonthlyCents,goalQuotaCents,plannedSavingsCents,actualSavingsCents:plan.actualSavingsCents,planBalanceCents:plannedIncomeCents-plan.plannedSpendCents-fixedExpenseMonthlyCents-fixedInvestmentMonthlyCents-plannedSavingsCents,availableSpendCents:plan.plannedSpendCents-actualSpendCents,categories};
}
