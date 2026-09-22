// @vitest-environment jsdom
import React from 'react';
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import App from './App';

beforeEach(()=>{cleanup();localStorage.clear();HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};vi.stubGlobal('confirm',()=>true);});
describe('personal finance workflow',()=>{
 it('saves an expense, persists it and reports its bank separately from income',()=>{
  const view=render(<App/>);
  fireEvent.click(screen.getByRole('button',{name:'Añadir movimiento'}));
  fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));
  fireEvent.click(screen.getByRole('button',{name:'Alimentación'}));
  fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));
  fireEvent.change(screen.getByLabelText('Importe en euros'),{target:{value:'12,50'}});
  fireEvent.change(screen.getByLabelText('Comercio o concepto'),{target:{value:'Compra de prueba'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar gasto'}));
  expect(screen.getByText('Compra de prueba')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Editar Compra de prueba'}));
  fireEvent.change(screen.getByLabelText('Importe en euros'),{target:{value:'15,00'}});
  fireEvent.change(screen.getByLabelText('Comercio o concepto'),{target:{value:'Compra corregida'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar gasto'}));
  expect(screen.getByText('Compra corregida')).toBeTruthy();
  view.unmount();render(<App/>);
  expect(screen.getByText('Compra corregida')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Informes'}));
  expect(screen.getByRole('heading',{name:'Desglose de gastos'})).toBeTruthy();
  expect(screen.getByText('Entradas del mes')).toBeTruthy();
 });
 it('opens shortcut settings with required variables and honest disconnected state',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));
  fireEvent.click(screen.getByRole('button',{name:/Atajo Apple Pay/}));
  expect(screen.getByText('Desconectado')).toBeTruthy();
  expect(screen.getByLabelText('Banco explícito')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Enviar prueba'}).hasAttribute('disabled')).toBe(true);
 });
});
