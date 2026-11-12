import React from 'react';
import {createRoot} from 'react-dom/client';
import Root from './cloud/Root';
import '@fontsource-variable/instrument-sans';
import './tokens.css';
import './styles.css';
import './hierarchy.css';
import {applyTheme} from './theme';
try{applyTheme(localStorage.getItem('misgastos-theme'));}catch{applyTheme('violeta');}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
// iOS Safari ignores user-scalable=no; blocking its gesture events keeps pinch zoom off.
for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,e=>e.preventDefault(),{passive:false});
if(import.meta.env.PROD&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
