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
 it('shows the brand header only on the home screen and a redesigned settings page',()=>{
  render(<App/>);expect(screen.getByRole('button',{name:'misGastos inicio'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));
  expect(screen.queryByRole('button',{name:'misGastos inicio'})).toBeNull();
  expect(screen.getByRole('button',{name:/Importar movimientos/})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Titular de las cuentas/}));
  fireEvent.change(screen.getByLabelText('Titular de las cuentas'),{target:{value:'Ana Prueba Ejemplo'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar titular'}));
  expect(screen.getByText('Ana Prueba Ejemplo')).toBeTruthy();
 });
 it('adds and removes categories moving movements to Otros',()=>{
  render(<App/>);fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));
  fireEvent.click(screen.getByRole('button',{name:/Categorías/}));
  fireEvent.change(screen.getByLabelText('Nueva categoría'),{target:{value:'Mascotas'}});
  fireEvent.click(screen.getByRole('button',{name:'Añadir categoría'}));
  expect(screen.getByText('Mascotas')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Borrar Mascotas'}));
  expect(screen.queryByText('Mascotas')).toBeNull();
 });
});
