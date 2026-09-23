import React from 'react';
import {createRoot} from 'react-dom/client';
import Root from './cloud/Root';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
if(import.meta.env.PROD&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
