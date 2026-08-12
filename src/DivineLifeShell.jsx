import { useEffect, useMemo, useState } from 'react';
import ConnectTeamShell from './ConnectTeamShell.jsx';
import GuestReceptionApp from './GuestReceptionApp.jsx';
import { supabase } from './supabase.js';
import './DivineLifeShell.css';

function memberStatus(m){
  const attended=[m.class_1,m.class_2,m.class_3,m.class_4].filter(Boolean).length;
  if(m.app_complete && attended===4 && m.luncheon_attended) return 'done';
  if(attended>0 || m.photo_taken || m.luncheon_attended) return 'prog';
  return 'new';
}

export default function DivineLifeShell(){
  const [area,setArea]=useState('entry');
  const [members,setMembers]=useState([]);
  const [guestVisits,setGuestVisits]=useState([]);
  const [guestOutreach,setGuestOutreach]=useState([]);
  const [guestInventory,setGuestInventory]=useState([]);

  useEffect(()=>{
    let live=true;
    async function loadPortal(){
      const [m,v,o,i]=await Promise.all([
        supabase.from('members').select('*'),
        supabase.from('guest_reception_visits').select('*'),
        supabase.from('guest_reception_outreach').select('*'),
        supabase.from('guest_reception_inventory').select('*')
      ]);
      if(!live)return;
      setMembers(m.data||[]);setGuestVisits(v.data||[]);setGuestOutreach(o.data||[]);setGuestInventory(i.data||[]);
    }
    loadPortal();
    return()=>{live=false};
  },[area]);

  const connectStats=useMemo(()=>({
    newMembers:members.filter(m=>memberStatus(m)==='new').length,
    inProgress:members.filter(m=>memberStatus(m)==='prog').length,
    complete:members.filter(m=>memberStatus(m)==='done').length
  }),[members]);
  const today=new Date().toISOString().slice(0,10);
  const guestStats=useMemo(()=>({
    today:guestVisits.filter(v=>v.visit_date===today).length,
    followUp:guestOutreach.filter(o=>!o.phone_outreach_date || o.outreach_result==='follow_up_needed').length,
    lowStock:guestInventory.filter(i=>i.quantity<=i.minimum_quantity).length
  }),[guestVisits,guestOutreach,guestInventory,today]);

  if(area==='connect') return <ConnectTeamShell onHome={()=>setArea('entry')}/>;
  if(area==='guest') return <GuestReceptionApp onHome={()=>setArea('entry')}/>;

  return (
    <main className="dlc-portal">
      <div className="dlc-hero-layer" />
      <section className="dlc-portal-inner">
        <header className="dlc-portal-hero">
          <img className="dlc-portal-logo" src="/dlclogo.png" alt="Divine Life Church" />
          <div className="dlc-portal-title"><span>DIVINE LIFE</span><strong>CONNECT</strong></div>
          <div className="dlc-gold-rule"><span>◇</span></div>
          <p>Welcome to the Divine Life Connect Team Portal.<br/>Select your ministry area to get started.</p>
        </header>

        <section className="dlc-ministry-grid">
          <article className="dlc-ministry-card connect-card">
            <div className="dlc-card-photo connect-photo"><div className="dlc-card-icon">◉</div></div>
            <div className="dlc-card-body">
              <h2>CONNECT TEAM</h2>
              <em>From connection to community.</em>
              <p>Manage the journey of new members as they move through class attendance, assignments, and connection into the Divine Life family.</p>
              <div className="dlc-card-features">
                <div><strong>{connectStats.newMembers}</strong><span>New Members</span></div>
                <div><strong>{connectStats.inProgress}</strong><span>In Progress</span></div>
                <div><strong>{connectStats.complete}</strong><span>Complete</span></div>
              </div>
              <button className="dlc-card-button connect-btn" onClick={()=>setArea('connect')}>ENTER CONNECT TEAM <span>→</span></button>
            </div>
          </article>

          <article className="dlc-ministry-card guest-card">
            <div className="dlc-card-photo guest-photo"><div className="dlc-card-icon">♡</div></div>
            <div className="dlc-card-body">
              <h2>GUEST RECEPTION</h2>
              <em>Every guest matters.</em>
              <p>Capture guest information, manage follow-up, track return visits, and keep the reception experience organized and ready.</p>
              <div className="dlc-card-features">
                <div><strong>{guestStats.today}</strong><span>Guests Today</span></div>
                <div><strong>{guestStats.followUp}</strong><span>Need Follow-Up</span></div>
                <div><strong>{guestStats.lowStock}</strong><span>Low Stock</span></div>
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
