// @vitest-environment jsdom
import React from 'react';
import {it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
import Reports from './Reports';

it('uses theme heat styling for calendar days with expenses',()=>{
 const items=[{id:'expense',type:'expense' as const,amountCents:10000,merchant:'Compra',bank:'N26',category:'Otros',date:'2026-01-05',source:'manual' as const}];
 render(<Reports items={items} month="2026-01" onMonth={()=>{}}/>);
 const day=screen.getByRole('button',{name:/^5:/});
 expect(day.getAttribute('style')).not.toMatch(/rgba\s*\(\s*124\s*,\s*58\s*,\s*237/);
 expect(day.style.getPropertyValue('--heat')).toBe('70%');
});
