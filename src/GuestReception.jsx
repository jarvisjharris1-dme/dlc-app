import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';

const today = () => new Date().toISOString().slice(0, 10);
const blankGuest = () => ({
  first_name: '', last_name: '', email: '', phone: '', visit_date: today(), service: '',
  first_time_guest: true, invited_by: '', prayer_request: '', notes: '', decision: 'guest', source: 'manual'
});

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function GuestReception({ onOpenConnect }) {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankGuest());
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  async function loadGuests() {
    setLoading(true);
    const { data, error } = await supabase.from('guest_reception').select('*').order('visit_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) setError('Guest Reception is not connected yet. Run the new Supabase migration, then refresh.');
    else { setGuests(data || []); setError(''); }
    setLoading(false);
  }

  useEffect(() => { loadGuests(); }, []);

  const filtered = useMemo(() => guests.filter(g => {
    const name = `${g.first_name || ''} ${g.last_name || ''}`.toLowerCase();
    return (!search || name.includes(search.toLowerCase()) || (g.phone || '').includes(search) || (g.email || '').toLowerCase().includes(search.toLowerCase()))
      && (!dateFilter || g.visit_date === dateFilter)
      && (!decisionFilter || g.decision === decisionFilter);
  }), [guests, search, dateFilter, decisionFilter]);

  const stats = {
    total: filtered.length,
    firstTime: filtered.filter(g => g.first_time_guest).length,
    decisions: filtered.filter(g => g.decision && g.decision !== 'guest').length,
    ready: filtered.filter(g => g.connect_ready && !g.transferred_to_connect).length,
  };

  async function saveGuest() {
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    const decisionMade = form.decision !== 'guest';
    const payload = {
      ...form,
      first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      email: form.email.trim() || null, phone: form.phone.trim() || null,
      decision_date: decisionMade ? form.visit_date : null,
      connect_ready: form.decision === 'join_church',
    };
    const { error } = await supabase.from('guest_reception').insert(payload);
    setSaving(false);
    if (error) return setError(`Could not save guest: ${error.message}`);
    setForm(blankGuest()); setShowForm(false); loadGuests();
  }

  async function markConnectReady(guest) {
    const { error } = await supabase.from('guest_reception').update({ decision: 'join_church', decision_date: today(), connect_ready: true }).eq('id', guest.id);
    if (error) setError('Could not update guest decision.'); else loadGuests();
  }

  async function transferToConnect(guest) {
    const memberPayload = {
      first_name: guest.first_name,
      last_name: guest.last_name,
      enroll_date: guest.decision_date || guest.visit_date || today(),
      class_1: false, class_2: false, class_3: false, class_4: false,
      photo_taken: false, app_complete: false, luncheon_attended: false,
      assigned_to: '', notes: guest.notes || '', initials: '', pastor_assigned: '', certificate_date: null, connect_group: ''
    };
    const { data, error } = await supabase.from('members').insert(memberPayload).select('id').single();
    if (error) return setError(`Could not move guest to Connect: ${error.message}`);
    await supabase.from('guest_reception').update({ transferred_to_connect: true, transferred_member_id: data.id }).eq('id', guest.id);
    await loadGuests();
  }

  function exportCSV() {
    const rows = [['First Name','Last Name','Email','Phone','Visit Date','Service','First Time Guest','Invited By','Decision','Prayer Request','Notes','Source','Connect Ready','Transferred to Connect']];
    filtered.forEach(g => rows.push([g.first_name,g.last_name,g.email,g.phone,g.visit_date,g.service,g.first_time_guest ? 'Y':'N',g.invited_by,g.decision,g.prayer_request,g.notes,g.source,g.connect_ready ? 'Y':'N',g.transferred_to_connect ? 'Y':'N']));
    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `DLC_Guest_Reception_${today()}.csv`;
    a.click();
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const parseLine = (line) => {
      const out=[]; let cur=''; let q=false;
      for(let i=0;i<line.length;i++) { const ch=line[i]; if(ch==='"'){ if(q && line[i+1]==='"'){cur+='"';i++;} else q=!q; } else if(ch===',' && !q){out.push(cur.trim());cur='';} else cur+=ch; }
      out.push(cur.trim()); return out;
    };
    const headers=parseLine(lines[0]).map(h=>h.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));
    return lines.slice(1).map(line => { const vals=parseLine(line); const obj={}; headers.forEach((h,i)=>obj[h]=vals[i]||''); return obj; });
  }

  async function importCSV(file) {
    if (!file) return;
    setImporting(true);
    try {
      const rows = parseCSV(await file.text());
      const payload = rows.filter(r => r.first_name && r.last_name).map(r => ({
        first_name:r.first_name, last_name:r.last_name, email:r.email||null, phone:r.phone||null,
        visit_date:r.visit_date || r.date || today(), service:r.service||null,
        first_time_guest: !['no','n','false','0'].includes(String(r.first_time_guest||'yes').toLowerCase()),
        invited_by:r.invited_by||null, prayer_request:r.prayer_request||null, notes:r.notes||null,
        decision:r.decision || 'guest', source:'csv', connect_ready:(r.decision||'')==='join_church'
      }));
      if (payload.length) {
        const { error } = await supabase.from('guest_reception').insert(payload);
        if (error) throw error;
      }
      await loadGuests();
    } catch (e) { setError(`CSV import failed: ${e.message}`); }
    setImporting(false);
  }

  return (
    <section className="guest-workspace">
      <div className="module-header">
        <div>
          <p className="eyebrow">Sunday-to-Monday workflow</p>
          <h1>Guest Reception</h1>
          <p>Capture guests quickly, enter paper cards later, record decisions, and move only new members into Connect.</p>
        </div>
        <div className="module-actions">
          <label className="shell-btn secondary">{importing ? 'Importing…' : '⬆ Import CSV'}<input hidden type="file" accept=".csv,text/csv" onChange={e => importCSV(e.target.files?.[0])} /></label>
          <button className="shell-btn secondary" onClick={exportCSV}>⬇ Export CSV</button>
          <button className="shell-btn primary" onClick={() => setShowForm(true)}>+ Add Guest</button>
        </div>
      </div>

      {error && <div className="shell-alert">{error}</div>}

      <div className="module-stats">
        <div><span>Total Guests</span><strong>{stats.total}</strong></div>
        <div><span>First-Time Guests</span><strong>{stats.firstTime}</strong></div>
        <div><span>Decisions</span><strong>{stats.decisions}</strong></div>
        <div><span>Ready for Connect</span><strong>{stats.ready}</strong></div>
      </div>

      <div className="guest-filters">
        <input placeholder="Search guest, phone or email…" value={search} onChange={e=>setSearch(e.target.value)} />
        <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} />
        <select value={decisionFilter} onChange={e=>setDecisionFilter(e.target.value)}>
          <option value="">All decisions</option><option value="guest">Guest only</option><option value="salvation">Salvation</option><option value="rededication">Rededication</option><option value="join_church">Join Church</option><option value="other">Other</option>
        </select>
        {(search||dateFilter||decisionFilter) && <button className="text-btn" onClick={()=>{setSearch('');setDateFilter('');setDecisionFilter('')}}>Clear</button>}
      </div>

      <div className="guest-table-wrap">
        {loading ? <div className="empty-state">Loading guest records…</div> : filtered.length === 0 ? <div className="empty-state">No guest records yet. Add a guest or import the cards from Sunday.</div> : (
          <table className="guest-table"><thead><tr><th>Guest</th><th>Visit</th><th>Contact</th><th>Decision</th><th>Source</th><th>Connect</th></tr></thead>
          <tbody>{filtered.map(g => <tr key={g.id}>
            <td><strong>{g.first_name} {g.last_name}</strong><small>{g.first_time_guest ? 'First-time guest' : 'Returning guest'}</small></td>
            <td>{g.visit_date}<small>{g.service || 'Service not specified'}</small></td>
            <td>{g.phone || '—'}<small>{g.email || ''}</small></td>
            <td><span className={`decision-chip ${g.decision}`}>{(g.decision || 'guest').replace('_',' ')}</span></td>
            <td><span className="source-chip">{g.source || 'manual'}</span></td>
            <td>{g.transferred_to_connect ? <span className="done-label">✓ In Connect</span> : g.connect_ready ? <button className="shell-btn small primary" onClick={()=>transferToConnect(g)}>Move to Connect</button> : <button className="shell-btn small secondary" onClick={()=>markConnectReady(g)}>Joined Church</button>}</td>
          </tr>)}</tbody></table>
        )}
      </div>

      {stats.ready > 0 && <div className="connect-callout"><div><strong>{stats.ready} guest{stats.ready===1?' is':'s are'} ready for Connect.</strong><span>Only people who have decided to join move into the new-member journey.</span></div><button className="shell-btn secondary" onClick={onOpenConnect}>Open Connect</button></div>}

      {showForm && <div className="shell-modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}><div className="shell-modal">
        <div className="shell-modal-head"><div><p className="eyebrow">Fast staff entry</p><h2>Add Guest</h2></div><button onClick={()=>setShowForm(false)}>✕</button></div>
        <div className="form-two"><label>First Name *<input autoFocus value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/></label><label>Last Name *<input value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></label></div>
        <div className="form-two"><label>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label></div>
        <div className="form-two"><label>Visit Date<input type="date" value={form.visit_date} onChange={e=>setForm({...form,visit_date:e.target.value})}/></label><label>Service<input placeholder="e.g. 10:30 AM" value={form.service} onChange={e=>setForm({...form,service:e.target.value})}/></label></div>
        <div className="form-two"><label>Decision<select value={form.decision} onChange={e=>setForm({...form,decision:e.target.value})}><option value="guest">No decision / Guest</option><option value="salvation">Salvation</option><option value="rededication">Rededication</option><option value="join_church">Join Church</option><option value="other">Other</option></select></label><label>Invited By<input value={form.invited_by} onChange={e=>setForm({...form,invited_by:e.target.value})}/></label></div>
        <label className="check-row"><input type="checkbox" checked={form.first_time_guest} onChange={e=>setForm({...form,first_time_guest:e.target.checked})}/> First-time guest</label>
        <label>Prayer Request<textarea rows="2" value={form.prayer_request} onChange={e=>setForm({...form,prayer_request:e.target.value})}/></label>
        <label>Staff Notes<textarea rows="2" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
        <div className="shell-modal-actions"><button className="shell-btn secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="shell-btn primary" disabled={saving} onClick={saveGuest}>{saving?'Saving…':'Save Guest'}</button></div>
      </div></div>}
    </section>
  );
}
