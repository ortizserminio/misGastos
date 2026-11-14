// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import Chat,{plain} from './Chat';

afterEach(cleanup);
const ok=(body:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status}));

describe('Chat',()=>{
 it('shows the local assistant when there is no cloud session',()=>{
  render(<Chat fallback={<p>Asistente básico</p>}/>);
  expect(screen.getByText('Asistente básico')).toBeTruthy();
 });
 it('sends the conversation with the session token and shows the answer',async()=>{
  const fetcher=vi.fn((..._args:Parameters<typeof fetch>)=>ok({reply:'Llevas **72,50 €** en gastos.',remaining:29}));
  render(<Chat getToken={async()=>'token-de-prueba'} fallback={<p>básico</p>} fetcher={fetcher as unknown as typeof fetch}/>);
  fireEvent.click(screen.getByRole('button',{name:'¿Cómo voy este mes?'}));
  expect(await screen.findByText('Llevas 72,50 € en gastos.')).toBeTruthy();
  expect(screen.getByText('Te quedan 29 preguntas hoy.')).toBeTruthy();
  const [url,init]=fetcher.mock.calls[0];
  expect(url).toBe('/api/chat');
  expect((init?.headers as Record<string,string>).Authorization).toBe('Bearer token-de-prueba');
  expect(JSON.parse(String(init?.body))).toEqual({messages:[{role:'user',content:'¿Cómo voy este mes?'}]});
 });
 it('falls back to the local assistant when the server has no AI key',async()=>{
  const fetcher=()=>ok({error:'ai_not_configured',message:'no'},503);
  render(<Chat getToken={async()=>'token'} fallback={<p>Asistente básico</p>} fetcher={fetcher as unknown as typeof fetch}/>);
  fireEvent.change(screen.getByLabelText('Tu pregunta'),{target:{value:'hola'}});
  fireEvent.click(screen.getByRole('button',{name:'Enviar pregunta'}));
  expect(await screen.findByText('Asistente básico')).toBeTruthy();
  expect(screen.getByText(/aún no está activado/)).toBeTruthy();
 });
 it('shows server errors such as the daily limit and keeps the question',async()=>{
  const fetcher=()=>ok({error:'daily_limit',message:'Has llegado al límite de 30 preguntas por hoy.'},429);
  render(<Chat getToken={async()=>'token'} fallback={<p>básico</p>} fetcher={fetcher as unknown as typeof fetch}/>);
  fireEvent.change(screen.getByLabelText('Tu pregunta'),{target:{value:'¿Y en ocio?'}});
  fireEvent.keyDown(screen.getByLabelText('Tu pregunta'),{key:'Enter'});
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toMatch(/límite de 30/));
  expect(screen.getByText('¿Y en ocio?')).toBeTruthy();
 });
 it('turns light Markdown into plain text',()=>{
  expect(plain('## Resumen\n* **Ocio**: 20 €\n- Bar: 5 €')).toBe('Resumen\n• Ocio: 20 €\n• Bar: 5 €');
 });
});
