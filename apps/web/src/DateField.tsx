import {CalendarDays} from 'lucide-react';
import {validDate} from './domain';
import './date-field.css';
export default function DateField({label,value,onChange,max}:{label:string;value:string;onChange:(value:string)=>void;max?:string}){
 const formatted=validDate(value)?new Date(value+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'}):'Selecciona una fecha';
 return <label className="compact-date-field">{label}<span className="compact-date-control"><CalendarDays size={18} aria-hidden="true"/><span aria-hidden="true">{formatted}</span><input type="date" aria-label={label} value={value} max={max} onChange={e=>onChange(e.target.value)} required/></span></label>;
}
