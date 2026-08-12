import { useState } from 'react';
import ConnectTeamApp from './App.jsx';
import GuestReceptionApp from './GuestReceptionApp.jsx';
import './DivineLifeShell.css';

export default function DivineLifeShell(){
  const [area,setArea]=useState('entry');
  if(area==='connect') return <div><button className="dlc-home-float" onClick={()=>setArea('entry')}>← Divine Life Connect</button><ConnectTeamApp/></div>;
  if(area==='guest') return <GuestReceptionApp onHome={()=>setArea('entry')}/>;

  return (
    <main className="dlc-entry">
      <div className="dlc-glow dlc-glow-one" />
      <div className="dlc-glow dlc-glow-two" />
      <section className="dlc-entry-card">
        <div className="dlc-entry-brand">
          <div className="dlc-logo-halo"><img src="/dlclogo.png" alt="Divine Life Church"/></div>
          <p>DIVINE LIFE CHURCH</p>
          <h1>DIVINE LIFE <span>CONNECT</span></h1>
          <div className="dlc-rule" />
          <h3>Welcome to the ministry team portal</h3>
          <span>Choose your team below to get started.</span>
        </div>

        <div className="dlc-team-grid">
          <button className="dlc-team-card guest" onClick={()=>setArea('guest')}>
            <div className="dlc-card-top">
              <div className="dlc-card-icon">GR</div>
              <span className="dlc-status-dot">Guest Experience</span>
            </div>
            <h2>Guest Reception Team</h2>
            <p>Welcome guests, capture visit information, manage outreach, and keep reception supplies ready.</p>
            <div className="dlc-card-meta">
              <span>Guests</span><span>Follow-Up</span><span>Visits</span><span>Inventory</span>
            </div>
            <strong>Enter Guest Reception <span>→</span></strong>
          </button>

          <button className="dlc-team-card connect" onClick={()=>setArea('connect')}>
            <div className="dlc-card-top">
              <div className="dlc-card-icon">CT</div>
              <span className="dlc-status-dot">Membership Experience</span>
            </div>
            <h2>Connect Team</h2>
            <p>Support new members through classes, assignments, connection, and their next steps at Divine Life.</p>
            <div className="dlc-card-meta">
              <span>New Members</span><span>Classes</span><span>Assignments</span><span>Groups</span>
            </div>
            <strong>Enter Connect Team <span>→</span></strong>
          </button>
        </div>

        <footer>
          <span className="dlc-footer-line" />
          <strong>Loving and Serving is what we do!</strong>
          <small>Divine Life Church · Memphis, Tennessee</small>
        </footer>
      </section>
    </main>
  );
}
