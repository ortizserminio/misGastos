// @vitest-environment jsdom
import React,{useState} from 'react';
import {it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import BudgetPage from './BudgetPage';
import App from '../App';
import {emptyData,type Data} from '../domain';
afterEach(cleanup);

it('keeps a new month virtual until a valid edit and persists income, spend and category limit',()=>{
  const start=emptyData();let persisted=start;
  function Harness(){const [data,setData]=useState<Data>(persisted);return <BudgetPage data={data} month="2026-10" onMonth={()=>{}} onSave={next=>{persisted=next;setData(next);}} onBack={()=>{}} onRecurring={()=>{}} onGoals={()=>{}}/>;}
  render(<Harness/>);
  expect(Object.keys(start.planning.months)).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'Editar ingresos'}));
  fireEvent.change(screen.getByLabelText('Ingreso mensual previsto'),{target:{value:'1000,50'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar ingresos'}));
  fireEvent.click(screen.getByRole('button',{name:'Editar gasto previsto'}));
  fireEvent.change(screen.getByLabelText('Gasto mensual previsto'),{target:{value:'800'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar gasto previsto'}));
  fireEvent.click(screen.getByRole('button',{name:'Añadir límite de categoría'}));
  fireEvent.change(screen.getByLabelText('Categoría del límite'),{target:{value:'Alimentación'}});
  fireEvent.change(screen.getByLabelText('Límite mensual'),{target:{value:'250'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar límite'}));
  expect(screen.getByText(/Límite 250,00/)).toBeTruthy();
  cleanup();render(<Harness/>);
  expect(screen.getByText('Alimentación')).toBeTruthy();
});

it('shows signed overspend and deficit from actual expenses only',()=>{
  const data=emptyData();data.transactions=[{id:'x',type:'expense',amountCents:12000,merchant:'Prueba',bank:'Efectivo',category:'Ocio',date:'2026-10-01',source:'manual'}];
  data.planning.months['2026-10']={incomeTotalCents:5000,incomeItems:[],plannedSpendCents:10000,categoryLimits:{},unassignedSavingsCents:0,actualSavingsCents:0,goalSavingsSnapshotCents:null};
  render(<BudgetPage data={data} month="2026-10" onMonth={()=>{}} onSave={()=>{}} onBack={()=>{}} onRecurring={()=>{}} onGoals={()=>{}}/>);
  expect(screen.getByText(/Te has pasado.*20,00/)).toBeTruthy();
  expect(screen.getByText(/Plan deficitario.*50,00/)).toBeTruthy();
});


it('edits and removes an income item, preserving its recurrence flag',()=>{
 const start=emptyData();let saved=start;
 function Harness(){const [data,setData]=useState<Data>(start);return <BudgetPage data={data} month="2026-10" onMonth={()=>{}} onSave={next=>{saved=next;setData(next);}} onBack={()=>{}} onRecurring={()=>{}} onGoals={()=>{}}/>;}
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Editar ingresos'}));
 fireEvent.change(screen.getByLabelText('Nombre de la partida'),{target:{value:'Nómina'}});
 fireEvent.change(screen.getByLabelText('Importe de la partida'),{target:{value:'1500'}});
 fireEvent.click(screen.getByLabelText('Repetir en el plan de los próximos meses'));
 fireEvent.click(screen.getByRole('button',{name:'Añadir partida'}));
 expect(saved.planning.months['2026-10'].incomeItems[0]).toMatchObject({name:'Nómina',amountCents:150000,recurring:true});
 fireEvent.click(screen.getByRole('button',{name:'Editar ingresos'}));
 fireEvent.click(screen.getByRole('button',{name:'Editar partida Nómina'}));
 fireEvent.change(screen.getByLabelText('Importe de la partida'),{target:{value:'1600'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar partida'}));
 expect(saved.planning.months['2026-10'].incomeItems[0].amountCents).toBe(160000);
 fireEvent.click(screen.getByRole('button',{name:'Editar ingresos'}));
 fireEvent.click(screen.getByRole('button',{name:'Quitar Nómina'}));
 expect(saved.planning.months['2026-10'].incomeItems).toHaveLength(0);
});

it('rejects malformed planned spend and records actual savings separately',()=>{
 const start=emptyData();let saved=start;
 function Harness(){const [data,setData]=useState<Data>(start);return <BudgetPage data={data} month="2026-10" onMonth={()=>{}} onSave={next=>{saved=next;setData(next);}} onBack={()=>{}} onRecurring={()=>{}} onGoals={()=>{}}/>;}
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Editar gasto previsto'}));
 fireEvent.change(screen.getByLabelText('Gasto mensual previsto'),{target:{value:'12,345'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar gasto previsto'}));
 expect(screen.getByRole('alert')).toBeTruthy();expect(Object.keys(saved.planning.months)).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));
 fireEvent.click(screen.getByRole('button',{name:'Anotar ahorro real'}));
 fireEvent.change(screen.getByLabelText('Ahorro real del mes'),{target:{value:'25'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar ahorro real'}));
 expect(saved.planning.months['2026-10'].actualSavingsCents).toBe(2500);
 expect(saved.planning.months['2026-10'].unassignedSavingsCents).toBe(0);
 expect(saved.transactions).toHaveLength(0);
});


it('opens the budget from the existing Gastos home card',()=>{
 localStorage.clear();render(<App/>);
 fireEvent.click(screen.getByRole('button',{name:/Mis presupuestos/}));
 expect(screen.getByRole('heading',{name:'Presupuestos.'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Recurrentes y deudas'}));
 expect(screen.getByRole('heading',{name:'Recurrentes y deudas.'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Volver a presupuestos'}));
 fireEvent.click(screen.getByRole('button',{name:'Objetivos'}));
 expect(screen.getByRole('heading',{name:'Objetivos de ahorro.'})).toBeTruthy();
});


it('saves unassigned planned savings without a real transfer',()=>{
 const start=emptyData();let saved=start;
 function Harness(){const [data,setData]=useState<Data>(start);return <BudgetPage data={data} month="2026-10" onMonth={()=>{}} onSave={next=>{saved=next;setData(next);}} onBack={()=>{}} onRecurring={()=>{}} onGoals={()=>{}}/>;}
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Editar ahorro'}));
 fireEvent.change(screen.getByLabelText('Ahorro mensual sin objetivo'),{target:{value:'42,50'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar ahorro'}));
 expect(saved.planning.months['2026-10'].unassignedSavingsCents).toBe(4250);
 expect(saved.planning.months['2026-10'].actualSavingsCents).toBe(0);
 expect(saved.transactions).toHaveLength(0);
});




it('keeps the saved total savings plan in history when a goal later changes',()=>{
 const data=emptyData();data.planning.months['2026-01']={incomeTotalCents:0,incomeItems:[],plannedSpendCents:0,categoryLimits:{},unassignedSavingsCents:5000,actualSavingsCents:2000,goalSavingsSnapshotCents:1500};
 data.planning.goals=[{id:'g',name:'Viaje',targetCents:12000,currentCents:0,targetDate:'2026-12-01'}];
 const view=render(<BudgetPage data={data} month="2026-10" onMonth={()=>{}} onSave={()=>{}} onBack={()=>{}} onRecurring={()=>{}} onGoals={()=>{}}/>);
 expect(screen.getByText(/Previsto 65,00/)).toBeTruthy();
 view.rerender(<BudgetPage data={{...data,planning:{...data.planning,goals:[{...data.planning.goals[0],currentCents:12000}]}}} month="2026-10" onMonth={()=>{}} onSave={()=>{}} onBack={()=>{}} onRecurring={()=>{}} onGoals={()=>{}}/>);
 expect(screen.getByText(/Previsto 65,00/)).toBeTruthy();
});


it('annotating actual savings does not rewrite a past planned snapshot',()=>{
 const start=emptyData();start.planning.months['2026-01']={incomeTotalCents:0,incomeItems:[],plannedSpendCents:0,categoryLimits:{},unassignedSavingsCents:5000,actualSavingsCents:0,goalSavingsSnapshotCents:1500};
 start.planning.goals=[{id:'g',name:'Viaje',targetCents:12000,currentCents:12000,targetDate:'2026-12-01'}];
 let saved=start;
 function Harness(){const [data,setData]=useState<Data>(start);return <BudgetPage data={data} month="2026-01" onMonth={()=>{}} onSave={next=>{saved=next;setData(next);}} onBack={()=>{}} onRecurring={()=>{}} onGoals={()=>{}}/>;}
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Anotar ahorro real'}));
 fireEvent.change(screen.getByLabelText('Ahorro real del mes'),{target:{value:'25'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar ahorro real'}));
 expect(saved.planning.months['2026-01'].actualSavingsCents).toBe(2500);
 expect(saved.planning.months['2026-01'].goalSavingsSnapshotCents).toBe(1500);
});
