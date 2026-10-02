// @vitest-environment jsdom
import React,{useState} from 'react';
import {it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
afterEach(cleanup);
import RecurringDebtsPage from './RecurringDebtsPage';
import {emptyData,type Data} from '../domain';

it('adds an annual recurring expense, pauses it and leaves real movements untouched',()=>{
 const start=emptyData();let saved=start;
 function Harness(){const [data,setData]=useState<Data>(start);return <RecurringDebtsPage data={data} onSave={next=>{saved=next;setData(next);}} onBack={()=>{}}/>;}
 render(<Harness/>);
 fireEvent.click(screen.getByRole('button',{name:'Añadir recurrente'}));
 fireEvent.change(screen.getByLabelText('Nombre del recurrente'),{target:{value:'Seguro'}});
 fireEvent.change(screen.getByLabelText('Importe del recurrente'),{target:{value:'49,99'}});
 fireEvent.change(screen.getByLabelText('Frecuencia'),{target:{value:'yearly'}});
 fireEvent.change(screen.getByLabelText('Próxima fecha'),{target:{value:'2026-11-01'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar recurrente'}));
 expect(screen.getByText(/4,17.*mes/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Pausar Seguro'}));
 expect(saved.planning.recurrents[0].status).toBe('paused');
 expect(saved.transactions).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Reanudar Seguro'}));
 fireEvent.click(screen.getByRole('button',{name:'Cancelar Seguro'}));
 expect(saved.planning.recurrents[0].status).toBe('cancelled');
});

it('records a debt payment without creating a transaction',()=>{
 const start=emptyData();let saved=start;
 function Harness(){const [data,setData]=useState<Data>(start);return <RecurringDebtsPage data={data} onSave={next=>{saved=next;setData(next);}} onBack={()=>{}}/>;}
 render(<Harness/>);fireEvent.click(screen.getByRole('tab',{name:'Deudas'}));
 fireEvent.click(screen.getByRole('button',{name:'Añadir deuda'}));
 fireEvent.change(screen.getByLabelText('Persona o entidad'),{target:{value:'Ana'}});
 fireEvent.change(screen.getByLabelText('Importe original'),{target:{value:'100'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar deuda'}));
 fireEvent.click(screen.getByRole('button',{name:'Registrar pago de Ana'}));
 fireEvent.change(screen.getByLabelText('Importe del pago'),{target:{value:'25'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar pago'}));
 expect(screen.getByText(/75,00/)).toBeTruthy();
 expect(saved.planning.debts[0].paidCents).toBe(2500);
 expect(saved.planning.debts[0].dueDate).toBeUndefined();
 expect(saved.transactions).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Registrar pago de Ana'}));
 fireEvent.change(screen.getByLabelText('Importe del pago'),{target:{value:'75'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar pago'}));
 expect(saved.planning.debts[0].paidCents).toBe(10000);
 fireEvent.change(screen.getByLabelText('Filtrar deudas'),{target:{value:'settled'}});
 expect(screen.getByText('Ana')).toBeTruthy();
});


it('rejects an overlong recurring name before saving planning',()=>{
 const start=emptyData();let saved=start;
 function Harness(){const [data,setData]=useState<Data>(start);return <RecurringDebtsPage data={data} onSave={next=>{saved=next;setData(next);}} onBack={()=>{}}/>;}
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Añadir recurrente'}));
 fireEvent.change(screen.getByLabelText('Nombre del recurrente'),{target:{value:'X'.repeat(201)}});
 fireEvent.change(screen.getByLabelText('Importe del recurrente'),{target:{value:'10'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar recurrente'}));
 expect(screen.getByRole('alert')).toBeTruthy();
 expect(saved.planning.recurrents).toHaveLength(0);
});


it('rejects an overlong debt counterparty before saving planning',()=>{
 const start=emptyData();let saved=start;
 function Harness(){const [data,setData]=useState<Data>(start);return <RecurringDebtsPage data={data} onSave={next=>{saved=next;setData(next);}} onBack={()=>{}}/>;}
 render(<Harness/>);fireEvent.click(screen.getByRole('tab',{name:'Deudas'}));fireEvent.click(screen.getByRole('button',{name:'Añadir deuda'}));
 fireEvent.change(screen.getByLabelText('Persona o entidad'),{target:{value:'X'.repeat(201)}});
 fireEvent.change(screen.getByLabelText('Importe original'),{target:{value:'100'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar deuda'}));
 expect(screen.getByRole('alert')).toBeTruthy();
 expect(saved.planning.debts).toHaveLength(0);
});
