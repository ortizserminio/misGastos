import {Wallet} from 'lucide-react';
// Full-screen launch screen shown while the session and the user's data load. index.html renders the same markup before JS starts.
export default function Splash(){return <div className="splash" role="status" aria-label="Cargando misGastos"><span className="splash-logo"><Wallet size={56} strokeWidth={2}/></span><strong className="splash-name">mis<span>Gastos</span></strong><small className="splash-tagline">Un espacio para tus números</small></div>;}
