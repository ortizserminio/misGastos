// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import TransactionModal from './TransactionModal';

describe('TransactionModal',()=>{
 it('keeps an edited expense as an expense when initialType is income',()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  const onSave=vi.fn();
  const initial={id:'expense-1',type:'expense' as const,amountCents:1000,merchant:'Compra',bank:'N26',category:'Otros',date:'2026-11-10',source:'manual' as const};
  render(<TransactionModal accounts={['N26']} initial={initial} initialType="income" onClose={()=>{}} onSave={onSave}/>);
  expect(screen.getByRole('button',{name:/Gasto/}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'Guardar gasto'}));
  expect(onSave.mock.calls[0][0].type).toBe('expense');
 });
});
