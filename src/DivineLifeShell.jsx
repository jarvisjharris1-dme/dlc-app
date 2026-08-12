import { useState } from 'react';
import ConnectTeamApp from './App.jsx';
import GuestReceptionApp from './GuestReceptionApp.jsx';
import './DivineLifeShell.css';

export default function DivineLifeShell(){
  const [area,setArea]=useState('entry');

  if(area==='connect') return <div><button className="dlc-home-float" onClick={()=>setArea('entry')}>← Divine Life Connect</button><ConnectTeamApp/></div>;
  if(area==='guest') return <GuestReceptionApp onHome={()=>setArea('entry')}/>;

  return (
    <main className="dlc-portal">
      <div className="dlc-hero-layer" />
      <section className="dlc-portal-inner">
        <header className="dlc-portal-hero">
          <img className="dlc-portal-logo" src="/dlclogo.png" alt="Divine Life Church" />
          <div className="dlc-portal-title">
            <span>DIVINE LIFE</span>
            <strong>CONNECT</strong>
          </div>
          <div className="dlc-gold-rule"><span>◇</span></div>
          <p>Welcome to the Divine Life Connect Team Portal.<br/>Select your ministry area to get started.</p>
        </header>

        <section className="dlc-ministry-grid">
          <article className="dlc-ministry-card connect-card">
            <div className="dlc-card-photo connect-photo">
              <div className="dlc-card-icon">◉</div>
            </div>
            <div className="dlc-card-body">
              <h2>CONNECT TEAM</h2>
              <em>From connection to community.</em>
              <p>Manage the journey of new members as they move through class attendance, assignments, and connection into the Divine Life family.</p>
              <div className="dlc-card-features">
                <div><strong>NEW</strong><span>Members</span></div>
                <div><strong>LIVE</strong><span>Progress</span></div>
                <div><strong>SYNC</strong><span>Records</span></div>
              </div>
              <button className="dlc-card-button connect-btn" onClick={()=>setArea('connect')}>ENTER CONNECT TEAM <span>→</span></button>
            </div>
          </article>

          <article className="dlc-ministry-card guest-card">
            <div className="dlc-card-photo guest-photo">
              <div className="dlc-card-icon">♡</div>
            </div>
            <div className="dlc-card-body">
              <h2>GUEST RECEPTION</h2>
              <em>Every guest matters.</em>
              <p>Capture guest information, manage follow-up, track return visits, and keep the reception experience organized and ready.</p>
              <div className="dlc-card-features">
                <div><strong>1ST</strong><span>Guests</span></div>
                <div><strong>2ND</strong><span>Returns</span></div>
                <div><strong>READY</strong><span>Inventory</span></div>
              </div>
              <button className="dlc-card-button guest-btn" onClick={()=>setArea('guest')}>ENTER GUEST RECEPTION <span>→</span></button>
            </div>
          </article>
        </section>

        <div className="dlc-motto">Loving and Serving is what we do!</div>
      </section>

      <footer className="dlc-portal-footer">
        <img src="/dlclogo.png" alt="Divine Life Church" />
        <div><strong>Divine Life Church · Memphis, Tennessee</strong><span>Internal Ministry Operations</span></div>
      </footer>
    </main>
  );
}
