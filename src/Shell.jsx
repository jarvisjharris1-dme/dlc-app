import { useEffect, useState } from 'react';
import App from './App.jsx';
import GuestReception from './GuestReception.jsx';
import ConnectInventory from './ConnectInventory.jsx';
import './Shell.css';

export default function Shell() {
  const [area, setArea] = useState('guest');
  const [connectView, setConnectView] = useState('members');

  // Compatibility bridge while the existing Connect screen is being split into components.
  // Keeps staff-facing terminology correct without changing the existing Supabase schema.
  useEffect(() => {
    if (area !== 'connect' || connectView !== 'members') return;
    const applyLabels = () => {
      document.querySelectorAll('button').forEach((el) => {
        if (el.textContent.trim() === '✝ Pastors') el.textContent = '✝ Pastors & Elders';
      });
      document.querySelectorAll('h2').forEach((el) => {
        if (el.textContent.trim() === '✝ Manage Pastors') el.textContent = '✝ Manage Pastors & Elders';
      });
      document.querySelectorAll('label').forEach((el) => {
        if (el.textContent.trim() === 'Pastor assigned') el.childNodes[0].textContent = 'Pastor & elder assigned';
      });
      document.querySelectorAll('th').forEach((el) => {
        if (el.textContent.trim() === 'Pastor') el.textContent = 'Pastor & Elder';
      });
      document.querySelectorAll('.modal-sub').forEach((el) => {
        if (el.textContent.includes('Pastor Assigned')) {
          el.textContent = 'These names populate the "Pastor & Elder Assigned" dropdown on each member record.';
        }
      });
      document.querySelectorAll('input[placeholder]').forEach((el) => {
        if (el.placeholder.includes('Add pastor name')) el.placeholder = 'Add pastor or elder name';
      });
    };
    applyLabels();
    const observer = new MutationObserver(applyLabels);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [area, connectView]);

  return (
    <div className="dlc-shell">
      <nav className="workspace-nav" aria-label="DLC internal app areas">
        <button className={area === 'guest' ? 'workspace-tab active' : 'workspace-tab'} onClick={() => setArea('guest')}>
          <span className="workspace-icon">👋</span>
          <span><strong>Guest Reception</strong><small>Guests, cards, decisions & follow-up</small></span>
        </button>
        <button className={area === 'connect' ? 'workspace-tab active' : 'workspace-tab'} onClick={() => setArea('connect')}>
          <span className="workspace-icon">🤝</span>
          <span><strong>Connect</strong><small>New member journey & ministry operations</small></span>
        </button>
      </nav>

      {area === 'guest' ? (
        <GuestReception onOpenConnect={() => { setArea('connect'); setConnectView('members'); }} />
      ) : (
        <>
          <div className="connect-subnav">
            <button className={connectView === 'members' ? 'active' : ''} onClick={() => setConnectView('members')}>Member Journey</button>
            <button className={connectView === 'inventory' ? 'active' : ''} onClick={() => setConnectView('inventory')}>Inventory</button>
          </div>
          {connectView === 'members' ? <App /> : <ConnectInventory />}
        </>
      )}
    </div>
  );
}
