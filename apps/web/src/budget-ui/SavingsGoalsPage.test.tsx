// @vitest-environment jsdom
import React,{useState} from 'react';
import {it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
afterEach(cleanup);
import SavingsGoalsPage from './SavingsGoalsPage';
import {emptyData,type Data} from '../domain';

it('adds a goal and shows the 60 month quota without moving bank money',()=>{
 const start=emptyData();let saved=start;
 function Harness(){const [data,setData]=useState<Data>(start);return <SavingsGoalsPage data={data} month="2026-01" onSave={next=>{saved=next;setData(next);}} onBack={()=>{}}/>;}
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Añadir objetivo'}));
 fireEvent.change(screen.getByLabelText('Nombre del objetivo'),{target:{value:'Viaje'}});
 fireEvent.change(screen.getByLabelText('Meta'),{target:{value:'120'}});
 fireEvent.change(screen.getByLabelText('Saldo actual'),{target:{value:'0'}});
 fireEvent.change(screen.getByLabelText('Fecha objetivo'),{target:{value:'2030-12-01'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar objetivo'}));
 expect(screen.getAllByText(/2,00.*mes/).length).toBeGreaterThan(0);
 expect(saved.transactions).toHaveLength(0);
 expect(saved.planning.months['2026-01'].goalSavingsSnapshotCents).toBe(200);
 fireEvent.click(screen.getByRole('button',{name:'Editar Viaje'}));
 fireEvent.change(screen.getByLabelText('Saldo actual'),{target:{value:'20'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar objetivo'}));
 expect(saved.planning.goals[0].currentCents).toBe(2000);
 fireEvent.click(screen.getByRole('button',{name:'Eliminar Viaje'}));
 expect(saved.planning.goals).toHaveLength(0);
});


it('rejects an overlong goal name before saving planning',()=>{
 const start=emptyData();let saved=start;
 function Harness(){const [data,setData]=useState<Data>(start);return <SavingsGoalsPage data={data} month="2026-01" onSave={next=>{saved=next;setData(next);}} onBack={()=>{}}/>;}
 render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Añadir objetivo'}));
 fireEvent.change(screen.getByLabelText('Nombre del objetivo'),{target:{value:'X'.repeat(201)}});
 fireEvent.change(screen.getByLabelText('Meta'),{target:{value:'100'}});
 fireEvent.change(screen.getByLabelText('Fecha objetivo'),{target:{value:'2026-12-01'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar objetivo'}));
 expect(screen.getByRole('alert')).toBeTruthy();
 expect(saved.planning.goals).toHaveLength(0);
});
