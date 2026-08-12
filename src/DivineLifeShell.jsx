import { useEffect, useMemo, useState } from 'react';
import ConnectTeamApp from './App.jsx';
import GuestReceptionApp from './GuestReceptionApp.jsx';
import { supabase } from './supabase.js';
import './DivineLifeShell.css';

function completionStatus(m) {
  const attended = [m.class_1, m.class_2, m.class_3, m.class_4].filter(Boolean).length;
  if (m.app_complete && attended === 4 && m.luncheon_attended) return 'done';
  if (attended > 0 || m.photo_taken || m.luncheon_attended) return 'prog';
  return 'new';
}

export default function DivineLifeShell(){
  const [area,setArea]=useState('entry');
  const [stats,setStats]=useState({
    connectMembers:0,
    connectProgress:0,
    connectComplete:0,
    guestsToday:0,
    guestFollowUp:0,
    guestInventory:0
  });

  useEffect(()=>{
    let active=true;
    async function loadStats(){
      const today=new Date().toISOString().slice(0,10);
      const [membersRes,guestRes,visitRes,outreachRes,inventoryRes]=await Promise.all([
        supabase.from('members').select('class_1,class_2,class_3,class_4,photo_taken,app_complete,luncheon_attended'),
        supabase.from('guest_reception_guests').select('id'),
        supabase.from('guest_reception_visits').select('id',{count:'exact',head:true}).eq('visit_date',today),
        supabase.from('guest_reception_outreach').select('guest_id,phone_outreach_date,outreach_result'),
        supabase.from('guest_reception_inventory').select('id',{count:'exact',head:true})
      ]);

      if(!active) return;
      const members=membersRes.data||[];
      const guests=guestRes.data||[];
      const outreach=outreachRes.data||[];
      const completed=new Set(outreach.filter(o=>o.phone_outreach_date && o.outreach_result!=='follow_up_needed').map(o=>o.guest_id));

      setStats({
        connectMembers:members.length,
        connectProgress:members.filter(m=>completionStatus(m)==='prog').length,
        connectComplete:members.filter(m=>completionStatus(m)==='done').length,
        guestsToday:visitRes.count||0,
        guestFollowUp:guests.filter(g=>!completed.has(g.id)).length,
        guestInventory:inventoryRes.count||0
      });
    }
    loadStats();
    return()=>{active=false};
  },[]);

  const connectStats=useMemo(()=>[
    ['✚',stats.connectMembers,'New Members'],
    ['•••',stats.connectProgress,'In Progress'],
    ['✓',stats.connectComplete,'Complete']
  ],[stats]);

  const guestStats=useMemo(()=>[
    ['◉',stats.guestsToday,'Guests Today'],
    ['✓',stats.guestFollowUp,'Need Follow-Up'],
    ['◇',stats.guestInventory,'Inventory Items']
  ],[stats]);

  if(area==='connect') return <div><button className="dlc-home-float" onClick={()=>setArea('entry')}>← Divine Life Connect</button><ConnectTeamApp/></div>;
  if(area==='guest') return <GuestReceptionApp onHome={()=>setArea('entry')}/>;

  return (
    <main className="dlc-portal">
      <div className="dlc-hero-layer" />
      <div className="dlc-hero-vignette" />

      <section className="dlc-portal-inner">
        <header className="dlc-portal-hero">
          <div className="dlc-brand-lockup">
            <img className="dlc-portal-logo" src="/dlclogo.png" alt="Divine Life Church" />
            <div className="dlc-brand-words">
              <strong>DIVINE LIFE</strong>
              <span>CHURCH</span>
            </div>
          </div>

          <div className="dlc-portal-title">
            <span>DIVINE LIFE</span>
            <strong>CONNECT</strong>
          </div>

          <div className="dlc-gold-rule"><span>♡</span></div>
          <p>Welcome to the Divine Life Connect Team Portal.<br/>Select your ministry area to get started.</p>
        </header>

        <section className="dlc-ministry-grid">
          <article className="dlc-ministry-card connect-card">
            <div className="dlc-card-photo connect-photo">
              <div className="dlc-photo-overlay" />
              <div className="dlc-card-icon">♙</div>
            </div>
            <div className="dlc-card-body">
              <h2>CONNECT TEAM</h2>
              <em>From connection to community.</em>
              <p>Manage the journey of new members as they become connected to the Divine Life family.</p>
              <div className="dlc-card-features">
                {connectStats.map(([icon,value,label])=><div key={label}><span className="dlc-stat-icon">{icon}</span><strong>{value}</strong><span>{label}</span></div>)}
              </div>
              <button className="dlc-card-button connect-btn" onClick={()=>setArea('connect')}>ENTER CONNECT TEAM <span>→</span></button>
            </div>
          </article>

          <article className="dlc-ministry-card guest-card">
            <div className="dlc-card-photo guest-photo">
              <div className="dlc-photo-overlay" />
              <div className="dlc-card-icon">♡</div>
            </div>
            <div className="dlc-card-body">
              <h2>GUEST RECEPTION</h2>
              <em>Every guest matters.</em>
              <p>Capture guest information, manage the reception experience, and make sure every person who walks through the doors feels seen, welcomed, and connected.</p>
              <div className="dlc-card-features">
                {guestStats.map(([icon,value,label])=><div key={label}><span className="dlc-stat-icon">{icon}</span><strong>{value}</strong><span>{label}</span></div>)}
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
