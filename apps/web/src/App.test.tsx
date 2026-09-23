// @vitest-environment jsdom
import React from 'react';
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import App from './App';
import {emptyData,today} from './domain';

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
 it('generates a personal shortcut token and merges shortcut expenses once',async()=>{
  const shortcutItem={id:'ev1',type:'expense' as const,amountCents:250,merchant:'Café del atajo',bank:'N26',category:'Otros',date:today(),source:'shortcut' as const,externalId:'ev1'};
  const cloud={email:'ana@ejemplo.com',initial:emptyData(),save:vi.fn(),logout:vi.fn(),createToken:vi.fn(async()=>'token-personal-123456789012345'),hasToken:vi.fn(async()=>false),fetchShortcut:vi.fn(async()=>[shortcutItem])};
  render(<App cloud={cloud}/>);
  expect(await screen.findByText('Café del atajo')).toBeTruthy();
  expect(cloud.save).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Ajustes'}));
  expect(screen.getByText('ana@ejemplo.com')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Atajo Apple Pay/}));
  expect(await screen.findByText('Sin configurar')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Enviar prueba'}).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:/Generar mi token/}));
  expect(await screen.findByDisplayValue('token-personal-123456789012345')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:/Traer gastos del atajo/}));
  expect(await screen.findByText('No hay gastos nuevos del atajo.')).toBeTruthy();
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button',{name:'Ajustes'}));
  fireEvent.click(screen.getByRole('button',{name:'Cerrar sesión'}));
  expect(cloud.logout).toHaveBeenCalled();
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
