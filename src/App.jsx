
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import "./App.css";

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getMonthYear(d) {
  if (!d) return '';
  const x = new Date(d + 'T00:00:00');
  return MONTHS[x.getMonth()] + ' ' + x.getFullYear();
}
function avatarInitials(name) {
  return (name || '').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
}
function completionStatus(m) {
  const a = [m.class_1, m.class_2, m.class_3, m.class_4].filter(Boolean).length;
  if (m.app_complete && a === 4 && m.luncheon_attended) return 'done';
  if (a > 0 || m.photo_taken || m.luncheon_attended) return 'prog';
  return 'new';
}
function completionLabel(m) {
  const s = completionStatus(m);
  if (s === 'done') return 'Complete';
  const a = [m.class_1, m.class_2, m.class_3, m.class_4].filter(Boolean).length;
  return s === 'prog' ? `${a}/4 classes` : 'New';
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
const emptyMember = () => ({
  first_name: '', last_name: '', enroll_date: todayStr(),
  class_1: false, class_2: false, class_3: false, class_4: false,
  photo_taken: false, app_complete: false, luncheon_attended: false,
  assigned_to: '', notes: '', initials: '',
  pastor_assigned: '', certificate_date: '', connect_group: ''
});

export default function App() {
  // Clear legacy localStorage data so Supabase is always the source of truth
  useEffect(() => {
    localStorage.removeItem('dlc_members');
    localStorage.removeItem('dlc_assignees');
  }, []);

  const [members, setMembers] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [pastors, setPastors] = useState([]);
  const [connectGroups, setConnectGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [fYear, setFYear] = useState('');
  const [fMonth, setFMonth] = useState('');
  const [fSearch, setFSearch] = useState('');
  const [fAssignee, setFAssignee] = useState('');

  const [modal, setModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyMember());
  const [newAssignee, setNewAssignee] = useState('');
  const [newPastor, setNewPastor] = useState('');
  const [newConnectGroup, setNewConnectGroup] = useState('');

  // Import state
  const [iTab, setITab] = useState('csv');
  const [iStep, setIStep] = useState(1);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [csvMap, setCsvMap] = useState({ fn: '', ln: '', ed: '' });
  const [iPreview, setIPreview] = useState([]);
  const [iResult, setIResult] = useState(null);
  const [shCfg, setShCfg] = useState({ ep: '', key: '', org: '', grp: '' });
  const [shStep, setShStep] = useState(1);
  const [shData, setShData] = useState([]);
  const [shResult, setShResult] = useState(null);
  const [shLoading, setShLoading] = useState(false);

  // ── Fetch data ──────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: mData, error: mErr }, { data: aData, error: aErr }, { data: pData, error: pErr }, { data: cgData, error: cgErr }] = await Promise.all([
        supabase.from('members').select('*').order('last_name', { ascending: true }).order('first_name', { ascending: true }),
        supabase.from('assignees').select('*').order('name'),
        supabase.from('pastors').select('*').order('name'),
        supabase.from('connect_groups').select('*').order('name'),
      ]);
      if (mErr) throw mErr;
      if (aErr) throw aErr;
      setMembers(mData || []);
      setAssignees((aData || []).map(a => a.name));
      setPastors((pData || []).map(p => p.name));
      setConnectGroups((cgData || []).map(g => g.name));
    } catch (e) {
      setError('Could not load data. Check your Supabase connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Real-time sync ───────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('dlc-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignees' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pastors' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connect_groups' }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchAll]);

  // ── Filtered list ────────────────────────────────────────────
  const filtered = members.filter(m => {
    try {
      const dateStr = (m.enroll_date || todayStr()).slice(0, 10);
      const [yr, mo] = dateStr.split('-').map(Number);
      const fy = fYear ? yr.toString() === fYear : true;
      const fm = fMonth !== '' ? (mo - 1) === parseInt(fMonth) : true;
      const fs = fSearch ? (m.first_name + ' ' + m.last_name).toLowerCase().includes(fSearch.toLowerCase()) : true;
      const fa = fAssignee ? m.assigned_to === fAssignee : true;
      return fy && fm && fs && fa;
    } catch { return true; }
  });

  const total = filtered.length;
  const complete = filtered.filter(m => completionStatus(m) === 'done').length;
  const inProg = filtered.filter(m => completionStatus(m) === 'prog').length;
  const lunch = filtered.filter(m => m.luncheon_attended).length;

  // ── Member CRUD ──────────────────────────────────────────────
  async function updateMember(id, changes) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m));
    const { error } = await supabase.from('members').update(changes).eq('id', id);
    if (error) { setError('Save failed — please try again.'); fetchAll(); }
  }

  async function toggleClass(id, field) {
    const m = members.find(x => x.id === id);
    await updateMember(id, { [field]: !m[field] });
  }

  async function deleteMember(id) {
    if (!confirm('Remove this member from the roster?')) return;
    setMembers(prev => prev.filter(m => m.id !== id));
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) { setError('Delete failed.'); fetchAll(); }
  }

  function openAdd() { setEditId(null); setForm(emptyMember()); setModal('member'); }
  function openEdit(id) {
    const m = members.find(x => x.id === id);
    setEditId(id); setForm({ ...m }); setModal('member');
  }

  async function saveMember() {
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase.from('members').update(form).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('members').insert(form);
        if (error) throw error;
      }
      setModal(null);
      await fetchAll();
    } catch (e) {
      setError('Could not save member.');
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    setModal(null); setIStep(1); setCsvHeaders([]); setCsvRows([]);
    setIPreview([]); setIResult(null); setShStep(1); setShData([]);
    setShResult(null); setShLoading(false); setNewAssignee('');
  }

  // ── Assignees ────────────────────────────────────────────────
  async function addAssignee() {
    const n = newAssignee.trim();
    if (!n || assignees.includes(n)) return;
    const { error } = await supabase.from('assignees').insert({ name: n });
    if (error) { setError('Could not add assignee.'); return; }
    setAssignees(prev => [...prev, n].sort());
    setNewAssignee('');
  }

  async function removeAssignee(name) {
    if (members.some(m => m.assigned_to === name)) {
      if (!confirm(`${name} is assigned to members. Remove anyway? Their assignments will be cleared.`)) return;
      await supabase.from('members').update({ assigned_to: '' }).eq('assigned_to', name);
    }
    await supabase.from('assignees').delete().eq('name', name);
    await fetchAll();
  }

  // ── Pastors ──────────────────────────────────────────────────
  async function addPastor() {
    const n = newPastor.trim();
    if (!n || pastors.includes(n)) return;
    const { error } = await supabase.from('pastors').insert({ name: n });
    if (error) { setError('Could not add pastor.'); return; }
    setPastors(prev => [...prev, n].sort());
    setNewPastor('');
  }
  async function removePastor(name) {
    if (members.some(m => m.pastor_assigned === name)) {
      if (!confirm(`${name} is assigned to members. Remove anyway?`)) return;
      await supabase.from('members').update({ pastor_assigned: '' }).eq('pastor_assigned', name);
    }
    await supabase.from('pastors').delete().eq('name', name);
    await fetchAll();
  }

  // ── Connect Groups ────────────────────────────────────────────
  async function addConnectGroup() {
    const n = newConnectGroup.trim();
    if (!n || connectGroups.includes(n)) return;
    const { error } = await supabase.from('connect_groups').insert({ name: n });
    if (error) { setError('Could not add connect group.'); return; }
    setConnectGroups(prev => [...prev, n].sort());
    setNewConnectGroup('');
  }
  async function removeConnectGroup(name) {
    if (members.some(m => m.connect_group === name)) {
      if (!confirm(`${name} is assigned to members. Remove anyway?`)) return;
      await supabase.from('members').update({ connect_group: '' }).eq('connect_group', name);
    }
    await supabase.from('connect_groups').delete().eq('name', name);
    await fetchAll();
  }

  // ── Export CSV ───────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [['First Name','Last Name','Enrollment Date','Class 1','Class 2','Class 3','Class 4','Classes Attended','Photo Taken','Application Complete','Luncheon Attended','Assigned To','Pastor Assigned','Certificate Date','Connect Group','Notes','Teacher Initials','Status']];
    filtered.forEach(m => {
      const classes = [m.class_1, m.class_2, m.class_3, m.class_4];
      rows.push([m.first_name, m.last_name, m.enroll_date,
        ...classes.map(c => c ? 'Y' : 'N'),
        classes.filter(Boolean).length,
        m.photo_taken ? 'Y' : 'N', m.app_complete ? 'Y' : 'N', m.luncheon_attended ? 'Y' : 'N',
        m.assigned_to || '', m.pastor_assigned || '', m.certificate_date || '', m.connect_group || '', m.notes || '', m.initials || '', completionLabel(m)]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `DLC_Attendance_${fYear}${fMonth !== '' ? '_' + MONTHS[parseInt(fMonth)] : ''}.csv`;
    a.click();
  }

  // ── CSV Import ───────────────────────────────────────────────
  // Smart CSV parser — handles quoted fields, messy data, multi-line values
  function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  // Parse a messy date string — extracts just the date portion
  function parseDate(raw) {
    if (!raw) return '';
    // Strip everything after the date (initials, notes like "CLvir", "acc", etc.)
    const clean = raw.replace(/[a-zA-Z()><\/]/g, ' ').trim();
    // Try MM/DD/YYYY
    const m1 = clean.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (m1) {
      let [, mo, dy, yr] = m1;
      if (yr.length === 2) yr = '20' + yr;
      return `${yr}-${mo.padStart(2,'0')}-${dy.padStart(2,'0')}`;
    }
    return '';
  }

  // Check if a cell means "yes/attended"
  function isAttended(val) {
    if (!val) return false;
    const v = val.trim().toUpperCase();
    if (!v || v.startsWith('X') || v === 'NO' || v === 'N/A') return false;
    // If it has a date pattern or YES it counts as attended
    return v === 'YES' || /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(v);
  }

  function isYes(val) {
    if (!val) return false;
    const v = val.trim().toUpperCase();
    return v === 'YES' || v === 'Y';
  }

  function handleCSVFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const lines = e.target.result.split('\n').filter(l => l.trim());
      const headers = parseCSVLine(lines[0]);
      setCsvHeaders(headers);

      // Skip row 2 if it looks like a sub-header (no first/last name data)
      const dataStart = lines.length > 1 && !parseCSVLine(lines[1])[0].trim().match(/^[A-Za-z]/) ? 2 : 1;
      const rows = lines.slice(dataStart).map(l => {
        const vals = parseCSVLine(l);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
        return obj;
      }).filter(r => {
        // Skip rows with no first or last name
        const fn = r[headers[0]] || '';
        const ln = r[headers[1]] || '';
        return fn.trim() && ln.trim();
      });

      setCsvRows(rows);
      setCsvMap({
        fn: headers[0] || '',
        ln: headers[1] || '',
        ed: headers.find(h => /date.joined|enroll|date/i.test(h)) || headers[3] || '',
      });
      setIStep(2);
    };
    reader.readAsText(file);
  }

  function buildPreview() {
    const prev = csvRows.slice(0, 5).map(row => {
      const fn = (row[csvMap.fn] || '').trim();
      const ln = (row[csvMap.ln] || '').trim();
      const dup = members.some(m => m.first_name.toLowerCase().trim() === fn.toLowerCase() && m.last_name.toLowerCase().trim() === ln.toLowerCase());
      const ed = parseDate(row[csvMap.ed] || '') || todayStr();
      return { fn, ln, ed, dup };
    });
    setIPreview(prev); setIStep(3);
  }

  async function doImport() {
    setSaving(true);
    const toInsert = [];
    csvRows.forEach(row => {
      const fn = (row[csvMap.fn] || '').trim();
      const ln = (row[csvMap.ln] || '').trim();
      if (!fn || !ln) return;
      if (members.some(m => m.first_name.toLowerCase().trim() === fn.toLowerCase() && m.last_name.toLowerCase().trim() === ln.toLowerCase())) return;

      // Smart field detection — works with Shelby Next AND the DLC tracker format
      const headers = csvHeaders;
      const dateJoined = parseDate(row[csvMap.ed] || '');
      const enrollDate = dateJoined || todayStr();

      // Detect session/class columns — any column with SESSION, CLASS, or S1-S4 pattern
      const sessionCols = headers.filter(h => /session|class\s*[1-4]|s[1-4]/i.test(h));
      // Fall back to columns 6-9 (0-indexed) if no named session columns found
      const classCols = sessionCols.length >= 4 ? sessionCols.slice(0, 4) : headers.slice(6, 10);

      const class1 = isAttended(row[classCols[0]]);
      const class2 = isAttended(row[classCols[1]]);
      const class3 = isAttended(row[classCols[2]]);
      const class4 = isAttended(row[classCols[3]]);

      // Photo — PICTURE column or similar
      const photoCol = headers.find(h => /pic|photo/i.test(h));
      const photoTaken = photoCol ? isYes(row[photoCol]) : false;

      // Application — APPLICATION column
      const appCol = headers.find(h => /applic|app/i.test(h));
      const appComplete = appCol ? isYes(row[appCol]) : false;

      // Certificate date — CERTIFICATE column
      const certCol = headers.find(h => /cert/i.test(h));
      const certDate = certCol ? parseDate(row[certCol]) : '';

      // Connect group — CONNECT GROUP column
      const cgCol = headers.find(h => /connect.group|group.assign/i.test(h));
      const connectGroup = cgCol ? (row[cgCol] || '').trim() : '';

      // Comments/notes
      const notesCols = headers.find(h => /comment|note/i.test(h));
      const notes = notesCols ? (row[notesCols] || '').trim() : '';

      toInsert.push({
        first_name: fn,
        last_name: ln,
        enroll_date: enrollDate,
        class_1: class1,
        class_2: class2,
        class_3: class3,
        class_4: class4,
        photo_taken: photoTaken,
        app_complete: appComplete,
        luncheon_attended: false,
        assigned_to: '',
        notes: notes,
        initials: '',
        pastor_assigned: '',
        certificate_date: certDate || null,
        connect_group: connectGroup,
      });
    });
    const skipped = csvRows.length - toInsert.length;
    if (toInsert.length > 0) {
      const { error } = await supabase.from('members').insert(toInsert);
      if (error) { setError('Import failed: ' + (error.message || JSON.stringify(error))); setSaving(false); return; }
    }
    await fetchAll();
    setIResult({ added: toInsert.length, skipped });
    setIStep(4);
    setSaving(false);
  }

  async function doShelbyFetch() {
    setShLoading(true);
    setTimeout(() => {
      setShLoading(false);
      if (!shCfg.ep.trim()) { setShResult({ err: 'Please enter your Shelby Next API endpoint URL.' }); setShStep(3); return; }
      setShData([
        { fn: 'Anthony', ln: 'Robinson', ed: '2026-05-02', dup: false },
        { fn: 'Calvin', ln: 'Moore', ed: '2026-05-02', dup: false },
        { fn: 'Marcus', ln: 'Thompson', ed: '2026-04-10', dup: true },
      ]);
      setShStep(2);
    }, 1400);
  }

  async function doShelbyImport() {
    setSaving(true);
    const toInsert = shData.filter(r => !r.dup && r.fn && r.ln).map(r => ({
      first_name: r.fn, last_name: r.ln, enroll_date: r.ed || todayStr(),
      class_1: false, class_2: false, class_3: false, class_4: false,
      photo_taken: false, app_complete: false, luncheon_attended: false,
      assigned_to: '', notes: '', initials: ''
    }));
    const skipped = shData.length - toInsert.length;
    if (toInsert.length > 0) {
      const { error } = await supabase.from('members').insert(toInsert);
      if (error) { setError('Import failed.'); setSaving(false); return; }
    }
    await fetchAll();
    setShResult({ added: toInsert.length, skipped });
    setShStep(3);
    setSaving(false);
  }

  function loadSample() {
    const headers = ['First Name', 'Last Name', 'Enrollment Date'];
    const rows = [
      { 'First Name': 'Tyrone', 'Last Name': 'Jackson', 'Enrollment Date': '2026-05-01' },
      { 'First Name': 'Darnell', 'Last Name': 'Simmons', 'Enrollment Date': '2026-05-01' },
      { 'First Name': 'Marcus', 'Last Name': 'Thompson', 'Enrollment Date': '2026-04-10' },
      { 'First Name': 'Kevin', 'Last Name': 'Davis', 'Enrollment Date': '2026-05-08' },
    ];
    setCsvHeaders(headers); setCsvRows(rows);
    setCsvMap({ fn: 'First Name', ln: 'Last Name', ed: 'Enrollment Date' });
    setIStep(2);
  }

  const years = ['2024', '2025', '2026'];
  const classFields = ['class_1', 'class_2', 'class_3', 'class_4'];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, background: '#EEF2F7' }}>
      <div className="spinner" />
      <p style={{ color: '#64748B', fontSize: 14 }}>Loading roster...</p>
    </div>
  );

  return (
    <div className="app">
      {error && (
        <div className="error-banner">
          ⚠ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="logo-wrap">
            <img src="/dlclogo.png" alt="Divine Life Church" className="header-logo" />
          </div>
          <div className="header-text">
            <h1>Divine Life Connect</h1>
            <p>New Member Class Attendance Registry</p>
            <span className="badge">Live Sync — All Devices</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => setModal('assignees')}>👥 Assignees</button>
          <button className="btn" onClick={() => setModal('pastors')}>✝ Pastors</button>
          <button className="btn" onClick={() => setModal('connectgroups')}>🔗 Connect Groups</button>
          <button className="btn btn-amber" onClick={() => { setModal('import'); setITab('csv'); setIStep(1); }}>⬆ Import</button>
          <button className="btn btn-success" onClick={exportCSV}>⬇ Export CSV</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add member</button>
        </div>
      </header>

      {/* FILTERS */}
      <div className="controls">
        <label>Year</label>
        <select value={fYear} onChange={e => setFYear(e.target.value)}>
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <label>Month</label>
        <select value={fMonth} onChange={e => setFMonth(e.target.value)}>
          <option value="">All months</option>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <label>Assignee</label>
        <select value={fAssignee} onChange={e => setFAssignee(e.target.value)}>
          <option value="">All assignees</option>
          {assignees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="text" placeholder="Search name..." value={fSearch} onChange={e => setFSearch(e.target.value)} />
        <span className="count-label">{total} member{total !== 1 ? 's' : ''} shown</span>
      </div>

      {/* STATS */}
      <div className="stats">
        <div className="stat-card"><div className="stat-label">Total members</div><div className="stat-val">{total}</div></div>
        <div className="stat-card"><div className="stat-label">Fully complete</div><div className="stat-val green">{complete}</div></div>
        <div className="stat-card"><div className="stat-label">In progress</div><div className="stat-val amber">{inProg}</div></div>
        <div className="stat-card"><div className="stat-label">Luncheon attended</div><div className="stat-val blue">{lunch}</div></div>
      </div>

      {/* TABLE */}
      <div className="table-wrap table-scroll">
        <table>
          <thead>
            <tr>
              <th>Member name</th><th>Enrolled</th>
              <th className="center">C1</th><th className="center">C2</th><th className="center">C3</th><th className="center">C4</th>
              <th className="center">Photo</th><th className="center">App</th><th className="center">Luncheon</th>
              <th>Assigned to</th><th>Pastor</th><th>Cert. Date</th><th>Connect Group</th><th>Notes</th><th className="center">Initials</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={17} className="empty">No members found for this filter</td></tr>
            ) : filtered.map(m => {
              const s = completionStatus(m);
              return (
                <tr key={m.id}>
                  <td className="name-cell">{m.first_name} {m.last_name}</td>
                  <td><span className="month-badge">{getMonthYear(m.enroll_date)}</span></td>
                  {classFields.map((f, i) => (
                    <td key={f} className="center">
                      <button className={`dot ${m[f] ? 'dot-on' : 'dot-off'}`} onClick={() => toggleClass(m.id, f)} title={`Class ${i+1}`}>{i+1}</button>
                    </td>
                  ))}
                  <td className="center"><input type="checkbox" checked={!!m.photo_taken} onChange={() => updateMember(m.id, { photo_taken: !m.photo_taken })} /></td>
                  <td className="center"><input type="checkbox" checked={!!m.app_complete} onChange={() => updateMember(m.id, { app_complete: !m.app_complete })} /></td>
                  <td className="center"><input type="checkbox" checked={!!m.luncheon_attended} onChange={() => updateMember(m.id, { luncheon_attended: !m.luncheon_attended })} /></td>
                  <td>
                    <select className="inline-select" value={m.assigned_to || ''} onChange={e => updateMember(m.id, { assigned_to: e.target.value })}>
                      <option value="">Unassigned</option>
                      {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="inline-select" value={m.pastor_assigned || ''} onChange={e => updateMember(m.id, { pastor_assigned: e.target.value })}>
                      <option value="">— None —</option>
                      {pastors.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td><input className="inline-input" type="date" value={m.certificate_date || ''} onChange={e => updateMember(m.id, { certificate_date: e.target.value || null })} style={{width: 130}} /></td>
                  <td>
                    <select className="inline-select" value={m.connect_group || ''} onChange={e => updateMember(m.id, { connect_group: e.target.value })}>
                      <option value="">— None —</option>
                      {connectGroups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </td>
                  <td><input className="inline-input" type="text" value={m.notes || ''} placeholder="Notes..." onChange={e => updateMember(m.id, { notes: e.target.value })} /></td>
                  <td className="center"><input className="initials-input" type="text" maxLength={4} value={m.initials || ''} placeholder="Init." onChange={e => updateMember(m.id, { initials: e.target.value })} /></td>
                  <td><span className={`status-badge status-${s}`}>{completionLabel(m)}</span></td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-sm" onClick={() => openEdit(m.id)}>✎</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteMember(m.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MEMBER MODAL */}
      {modal === 'member' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <h2>{editId ? 'Edit' : 'Add new'} member</h2>
            <div className="form-grid-2">
              <div className="form-row"><label>First name *</label><input autoFocus type="text" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div className="form-row"><label>Last name *</label><input type="text" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            </div>
            <div className="form-grid-2">
              <div className="form-row"><label>Enrollment date</label><input type="date" value={form.enroll_date} onChange={e => setForm(f => ({ ...f, enroll_date: e.target.value }))} /></div>
              <div className="form-row">
                <label>Assigned to</label>
                <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                  <option value="">— Unassigned —</option>
                  {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <label>Classes attended</label>
              <div className="dot-row">
                {classFields.map((f, i) => (
                  <button key={f} className={`dot dot-lg ${form[f] ? 'dot-on' : 'dot-off'}`} onClick={() => setForm(fm => ({ ...fm, [f]: !fm[f] }))}>C{i+1}</button>
                ))}
              </div>
            </div>
            <div className="section-divider">Completion checklist</div>
            <div className="form-grid-3">
              <label className="check-label"><input type="checkbox" checked={form.photo_taken} onChange={e => setForm(f => ({ ...f, photo_taken: e.target.checked }))} /> Photo taken</label>
              <label className="check-label"><input type="checkbox" checked={form.app_complete} onChange={e => setForm(f => ({ ...f, app_complete: e.target.checked }))} /> App complete</label>
              <label className="check-label"><input type="checkbox" checked={form.luncheon_attended} onChange={e => setForm(f => ({ ...f, luncheon_attended: e.target.checked }))} /> Luncheon attended</label>
            </div>
            <div className="section-divider">Assignments</div>
            <div className="form-grid-2">
              <div className="form-row">
                <label>Pastor assigned</label>
                <select value={form.pastor_assigned || ''} onChange={e => setForm(f => ({ ...f, pastor_assigned: e.target.value }))}>
                  <option value="">— None —</option>
                  {pastors.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Connect group assigned</label>
                <select value={form.connect_group || ''} onChange={e => setForm(f => ({ ...f, connect_group: e.target.value }))}>
                  <option value="">— None —</option>
                  {connectGroups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row"><label>Certificate date</label><input type="date" value={form.certificate_date || ''} onChange={e => setForm(f => ({ ...f, certificate_date: e.target.value || '' }))} style={{ width: 200 }} /></div>
            <div className="form-row"><label>Teacher initials</label><input type="text" maxLength={4} value={form.initials || ''} onChange={e => setForm(f => ({ ...f, initials: e.target.value }))} style={{ width: 80, textAlign: 'center' }} /></div>
            <div className="form-row"><label>Notes</label><textarea rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={saveMember} disabled={saving}>{saving ? 'Saving...' : `✓ ${editId ? 'Save changes' : 'Add member'}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNEES MODAL */}
      {modal === 'assignees' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <h2>Manage assignees</h2>
            <p className="modal-sub">These names populate the "Assigned to" dropdown on each member record.</p>
            <div className="assignee-list">
              {assignees.map(a => (
                <div key={a} className="assignee-row">
                  <span className="assignee-avatar">{avatarInitials(a)}</span>
                  <span className="assignee-name">{a}</span>
                  <button className="btn btn-sm btn-danger" onClick={() => removeAssignee(a)}>Remove</button>
                </div>
              ))}
            </div>
            <div className="add-assignee-row">
              <input type="text" placeholder="Add name (e.g. Elder Brown)" value={newAssignee} onChange={e => setNewAssignee(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAssignee()} autoFocus />
              <button className="btn btn-primary" onClick={addAssignee}>+ Add</button>
            </div>
            <div className="modal-footer"><button className="btn btn-primary" onClick={closeModal}>✓ Done</button></div>
          </div>
        </div>
      )}

      {/* PASTORS MODAL */}
      {modal === 'pastors' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <h2>✝ Manage Pastors</h2>
            <p className="modal-sub">These names populate the "Pastor Assigned" dropdown on each member record.</p>
            <div className="assignee-list">
              {pastors.map(p => (
                <div key={p} className="assignee-row">
                  <span className="assignee-avatar">{avatarInitials(p)}</span>
                  <span className="assignee-name">{p}</span>
                  <button className="btn btn-sm btn-danger" onClick={() => removePastor(p)}>Remove</button>
                </div>
              ))}
              {pastors.length === 0 && <p style={{padding:'12px',color:'var(--text-muted)',fontSize:13}}>No pastors added yet.</p>}
            </div>
            <div className="add-assignee-row">
              <input type="text" placeholder="Add pastor name (e.g. Pastor Williams)" value={newPastor} onChange={e => setNewPastor(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPastor()} autoFocus />
              <button className="btn btn-primary" onClick={addPastor}>+ Add</button>
            </div>
            <div className="modal-footer"><button className="btn btn-primary" onClick={closeModal}>✓ Done</button></div>
          </div>
        </div>
      )}

      {/* CONNECT GROUPS MODAL */}
      {modal === 'connectgroups' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <h2>🔗 Manage Connect Groups</h2>
            <p className="modal-sub">These names populate the "Connect Group Assigned" dropdown on each member record.</p>
            <div className="assignee-list">
              {connectGroups.map(g => (
                <div key={g} className="assignee-row">
                  <span className="assignee-avatar" style={{background:'#EAF3DE',color:'#2D6A2D'}}>{g.slice(0,2).toUpperCase()}</span>
                  <span className="assignee-name">{g}</span>
                  <button className="btn btn-sm btn-danger" onClick={() => removeConnectGroup(g)}>Remove</button>
                </div>
              ))}
              {connectGroups.length === 0 && <p style={{padding:'12px',color:'var(--text-muted)',fontSize:13}}>No connect groups added yet.</p>}
            </div>
            <div className="add-assignee-row">
              <input type="text" placeholder="Add group name (e.g. Tuesday Night Connect)" value={newConnectGroup} onChange={e => setNewConnectGroup(e.target.value)} onKeyDown={e => e.key === 'Enter' && addConnectGroup()} autoFocus />
              <button className="btn btn-primary" onClick={addConnectGroup}>+ Add</button>
            </div>
            <div className="modal-footer"><button className="btn btn-primary" onClick={closeModal}>✓ Done</button></div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {modal === 'import' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal modal-wide">
            <h2>Import new members</h2>
            <div className="tab-row">
              <button className={`tab ${iTab === 'csv' ? 'active' : ''}`} onClick={() => { setITab('csv'); setIStep(1); }}>📄 CSV upload</button>
              <button className={`tab ${iTab === 'shelby' ? 'active' : ''}`} onClick={() => { setITab('shelby'); setShStep(1); }}>🔌 Shelby Next direct connect</button>
            </div>

            {iTab === 'csv' && (<>
              {iStep === 1 && (<>
                <div className="steps-row">{['Upload','Map','Preview','Done'].map((l,i) => <span key={l} className={`step ${i===0?'step-active':'step-inactive'}`}><span className="step-num">{i+1}</span>{l}</span>)}</div>
                <div className="drop-zone" onClick={() => document.getElementById('csvfi').click()} onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('dragover');}} onDragLeave={e=>e.currentTarget.classList.remove('dragover')} onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove('dragover');if(e.dataTransfer.files[0])handleCSVFile(e.dataTransfer.files[0]);}}>
                  <div className="dz-icon">⬆</div>
                  <p>Drop your CSV file here, or click to browse</p>
                  <p className="dz-hint">Supports Shelby Next exports or any CSV with name + date columns</p>
                </div>
                <input type="file" id="csvfi" accept=".csv" style={{display:'none'}} onChange={e=>{if(e.target.files[0])handleCSVFile(e.target.files[0]);}} />
                <button className="btn btn-amber" onClick={loadSample}>Load sample CSV to test</button>
                <div className="modal-footer"><button className="btn" onClick={closeModal}>Cancel</button></div>
              </>)}
              {iStep === 2 && (<>
                <div className="steps-row">{['Upload','Map','Preview','Done'].map((l,i)=><span key={l} className={`step ${i===1?'step-active':i<1?'step-done':'step-inactive'}`}><span className="step-num">{i<1?'✓':i+1}</span>{l}</span>)}</div>
                <p className="modal-sub"><strong>{csvRows.length} rows</strong> found. Match your CSV columns below.</p>
                <div className="field-map">
                  {[['fn','First name *'],['ln','Last name *'],['ed','Enrollment date']].map(([key,label])=>(
                    <div key={key} className="field-row">
                      <span className="field-label">{label}</span><span className="arrow">→</span>
                      <select value={csvMap[key]} onChange={e=>setCsvMap(m=>({...m,[key]:e.target.value}))}>
                        {csvHeaders.map(h=><option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="modal-footer modal-footer-split">
                  <button className="btn" onClick={()=>setIStep(1)}>← Back</button>
                  <button className="btn btn-primary" onClick={buildPreview}>Preview →</button>
                </div>
              </>)}
              {iStep === 3 && (<>
                <div className="steps-row">{['Upload','Map','Preview','Done'].map((l,i)=><span key={l} className={`step ${i===2?'step-active':i<2?'step-done':'step-inactive'}`}><span className="step-num">{i<2?'✓':i+1}</span>{l}</span>)}</div>
                <p className="modal-sub">Preview of first {iPreview.length} rows.</p>
                <table className="preview-table">
                  <thead><tr><th>First</th><th>Last</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>{iPreview.map((r,i)=><tr key={i} className={r.dup?'dup-row':''}><td>{r.fn||'—'}</td><td>{r.ln||'—'}</td><td>{r.ed}</td><td className={r.dup?'dup-text':'new-text'}>{r.dup?'Duplicate':'New'}</td></tr>)}</tbody>
                </table>
                <div className="modal-footer modal-footer-split">
                  <button className="btn" onClick={()=>setIStep(2)}>← Back</button>
                  <button className="btn btn-success" onClick={doImport} disabled={saving}>{saving?'Importing...':'Import '+csvRows.length+' members'}</button>
                </div>
              </>)}
              {iStep === 4 && (<>
                <div className="import-result import-ok">
                  <div className="ir-icon">✓</div>
                  <strong>{iResult.added} member{iResult.added!==1?'s':''} imported successfully</strong>
                  {iResult.skipped>0&&<p>{iResult.skipped} skipped (duplicates or blank names)</p>}
                </div>
                <div className="modal-footer"><button className="btn btn-primary" onClick={closeModal}>Done — view roster</button></div>
              </>)}
            </>)}

            {iTab === 'shelby' && (<>
              {shStep===1&&(<>
                <div className="steps-row">{['Connect','Review','Done'].map((l,i)=><span key={l} className={`step ${i===0?'step-active':'step-inactive'}`}><span className="step-num">{i+1}</span>{l}</span>)}</div>
                <p className="modal-sub">Enter your Shelby Next API credentials — found under <strong>Admin → Integrations → API Access</strong>.</p>
                {[['ep','API endpoint URL *','https://api.shelbynext.com/v1','text'],['key','API key *','sk-••••••','password'],['org','Organization ID','org_12345','text'],['grp','Group / class filter','New Members...','text']].map(([k,label,ph,type])=>(
                  <div key={k} className="shelby-field"><label>{label}</label><input type={type} placeholder={ph} value={shCfg[k]} onChange={e=>setShCfg(c=>({...c,[k]:e.target.value}))}/></div>
                ))}
                <div className="security-note">🔒 Credentials are used only for this session and never stored to a server.</div>
                <div className="modal-footer"><button className="btn" onClick={closeModal}>Cancel</button><button className="btn btn-primary" onClick={doShelbyFetch} disabled={shLoading}>{shLoading?'Fetching...':'🔌 Connect & fetch members'}</button></div>
              </>)}
              {shStep===2&&(<>
                <div className="steps-row">{['Connect','Review','Done'].map((l,i)=><span key={l} className={`step ${i===1?'step-active':i<1?'step-done':'step-inactive'}`}><span className="step-num">{i<1?'✓':i+1}</span>{l}</span>)}</div>
                <p className="modal-sub"><strong>{shData.length} members</strong> retrieved from Shelby Next.</p>
                <table className="preview-table">
                  <thead><tr><th>First</th><th>Last</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>{shData.map((r,i)=><tr key={i} className={r.dup?'dup-row':''}><td>{r.fn}</td><td>{r.ln}</td><td>{r.ed}</td><td className={r.dup?'dup-text':'new-text'}>{r.dup?'Already in roster':'New'}</td></tr>)}</tbody>
                </table>
                <div className="modal-footer modal-footer-split">
                  <button className="btn" onClick={()=>setShStep(1)}>← Back</button>
                  <button className="btn btn-success" onClick={doShelbyImport} disabled={saving}>{saving?'Importing...':'Import '+shData.filter(r=>!r.dup).length+' new members'}</button>
                </div>
              </>)}
              {shStep===3&&(<>
                {shResult?.err
                  ?<div className="import-result import-err"><div className="ir-icon">✕</div><strong>Connection failed</strong><p>{shResult.err}</p></div>
                  :<div className="import-result import-ok"><div className="ir-icon">✓</div><strong>{shResult.added} member{shResult.added!==1?'s':''} imported from Shelby Next</strong>{shResult.skipped>0&&<p>{shResult.skipped} skipped</p>}</div>
                }
                <div className="modal-footer"><button className="btn btn-primary" onClick={closeModal}>Done — view roster</button></div>
              </>)}
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
