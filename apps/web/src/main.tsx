import React from 'react';
import {createRoot} from 'react-dom/client';
import Root from './cloud/Root';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
// iOS Safari ignores user-scalable=no; blocking its gesture events keeps pinch zoom off.
for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,e=>e.preventDefault(),{passive:false});
if(import.meta.env.PROD&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
