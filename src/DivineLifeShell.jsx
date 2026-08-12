import { useState } from 'react';
import ConnectTeamApp from './App.jsx';
import GuestReceptionApp from './GuestReceptionApp.jsx';
import './DivineLifeShell.css';

export default function DivineLifeShell(){
  const [area,setArea]=useState('entry');
  if(area==='connect') return <div><button className="dlc-home-float" onClick={()=>setArea('entry')}>← Divine Life Connect</button><ConnectTeamApp/></div>;
  if(area==='guest') return <GuestReceptionApp onHome={()=>setArea('entry')}/>;
  return <main className="dlc-entry"><section className="dlc-entry-card"><div className="dlc-entry-brand"><img src="/dlclogo.png" alt="Divine Life Church"/><p>DIVINE LIFE CHURCH</p><h1>DIVINE LIFE CONNECT</h1><span>Internal Ministry Operations</span></div><div className="dlc-team-grid"><button className="dlc-team-card guest" onClick={()=>setArea('guest')}><small>GUEST EXPERIENCE</small><h2>Guest Reception Team</h2><p>Capture guest information, manage follow-up, track visits, and keep reception supplies ready.</p><strong>Enter Guest Reception Team →</strong></button><button className="dlc-team-card connect" onClick={()=>setArea('connect')}><small>MEMBERSHIP EXPERIENCE</small><h2>Connect Team</h2><p>Continue into the existing new-member attendance and connection experience.</p><strong>Enter Connect Team →</strong></button></div><footer>Loving and Serving is what we do!</footer></section></main>;
}
