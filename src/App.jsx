import { useState, useEffect } from "react";
import "./App.css";

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DEFAULT_ASSIGNEES = ['Pastor Smith','Deacon Jones','Minister Lee','Sis. Williams','Bro. Davis'];
const DEFAULT_MEMBERS = [
  {id:1,firstName:'Marcus',lastName:'Thompson',enrollDate:'2026-04-10',classes:[true,true,false,false],photoTaken:true,appComplete:false,luncheonAttended:true,assignedTo:'Deacon Jones',notes:'',initials:'PS'},
  {id:2,firstName:'DeShawn',lastName:'Williams',enrollDate:'2026-04-10',classes:[true,true,true,true],photoTaken:true,appComplete:true,luncheonAttended:true,assignedTo:'Pastor Smith',notes:'Completed on time',initials:'PS'},
  {id:3,firstName:'James',lastName:'Carter',enrollDate:'2026-05-01',classes:[true,false,false,false],photoTaken:false,appComplete:false,luncheonAttended:false,assignedTo:'Minister Lee',notes:'',initials:''},
  {id:4,firstName:'Robert',lastName:'Ellis',enrollDate:'2026-03-15',classes:[true,true,true,false],photoTaken:true,appComplete:false,luncheonAttended:false,assignedTo:'',notes:'Missing ID',initials:'JM'},
];

function load(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function getMonthYear(d) { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return MONTHS[x.getMonth()] + ' ' + x.getFullYear(); }
function initials(name) { return (name || '').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase(); }
function completionStatus(m) { const a = m.classes.filter(Boolean).length; if (m.appComplete && a === 4 && m.luncheonAttended) return 'done'; if (a > 0 || m.photoTaken || m.luncheonAttended) return 'prog'; return 'new'; }
function completionLabel(m) { const s = completionStatus(m); if (s === 'done') return 'Complete'; const a = m.classes.filter(Boolean).length; return s === 'prog' ? `${a}/4 classes` : 'New'; }
function todayStr() { return new Date().toISOString().split('T')[0]; }
const emptyMember = () => ({ firstName:'', lastName:'', enrollDate: todayStr(), classes:[false,false,false,false], photoTaken:false, appComplete:false, luncheonAttended:false, assignedTo:'', notes:'', initials:'' });

export default function App() {
  const [members, setMembers] = useState(() => load('dlc_members', DEFAULT_MEMBERS));
  const [assignees, setAssignees] = useState(() => load('dlc_assignees', DEFAULT_ASSIGNEES));
  const [nextId, setNextId] = useState(() => Math.max(...load('dlc_members', DEFAULT_MEMBERS).map(m => m.id), 0) + 1);
  const [fYear, setFYear] = useState('2026');
  const [fMonth, setFMonth] = useState('');
  const [fSearch, setFSearch] = useState('');
  const [fAssignee, setFAssignee] = useState('');
  const [modal, setModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyMember());
  const [newAssignee, setNewAssignee] = useState('');
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

  useEffect(() => { save('dlc_members', members); }, [members]);
  useEffect(() => { save('dlc_assignees', assignees); }, [assignees]);

  const filtered = members.filter(m => {
    const d = new Date(m.enrollDate + 'T00:00:00');
    const fy = fYear ? d.getFullYear().toString() === fYear : true;
    const fm = fMonth !== '' ? d.getMonth() === parseInt(fMonth) : true;
    const fs = fSearch ? (m.firstName + ' ' + m.lastName).toLowerCase().includes(fSearch.toLowerCase()) : true;
    const fa = fAssignee ? m.assignedTo === fAssignee : true;
    return fy && fm && fs && fa;
  });

  const total = filtered.length;
  const complete = filtered.filter(m => completionStatus(m) === 'done').length;
  const inProg = filtered.filter(m => completionStatus(m) === 'prog').length;
  const lunch = filtered.filter(m => m.luncheonAttended).length;

  function updateMember(id, changes) { setMembers(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m)); }
  function toggleClass(id, ci) { setMembers(prev => prev.map(m => { if (m.id !== id) return m; const classes = [...m.classes]; classes[ci] = !classes[ci]; return { ...m, classes }; })); }
  function deleteMember(id) { if (!confirm('Remove this member from the roster?')) return; setMembers(prev => prev.filter(m => m.id !== id)); }

  function openAdd() { setEditId(null); setForm(emptyMember()); setModal('member'); }
  function openEdit(id) { const m = members.find(x => x.id === id); setEditId(id); setForm({ ...m, classes: [...m.classes] }); setModal('member'); }
  function saveMember() {
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    if (editId) { setMembers(prev => prev.map(m => m.id === editId ? { ...m, ...form } : m)); }
    else { setMembers(prev => [...prev, { id: nextId, ...form }]); setNextId(n => n + 1); }
    setModal(null);
  }
  function closeModal() { setModal(null); setIStep(1); setCsvHeaders([]); setCsvRows([]); setIPreview([]); setIResult(null); setShStep(1); setShData([]); setShResult(null); setShLoading(false); setNewAssignee(''); }
  function addAssignee() { const n = newAssignee.trim(); if (!n || assignees.includes(n)) return; setAssignees(prev => [...prev, n]); setNewAssignee(''); }
  function removeAssignee(i) {
    const name = assignees[i];
    if (members.some(m => m.assignedTo === name)) { if (!confirm(`${name} is assigned to members. Remove anyway?`)) return; setMembers(prev => prev.map(m => m.assignedTo === name ? { ...m, assignedTo: '' } : m)); }
    setAssignees(prev => prev.filter((_, idx) => idx !== i));
  }

  function exportCSV() {
    const rows = [['First Name','Last Name','Enrollment Date','Class 1','Class 2','Class 3','Class 4','Classes Attended','Photo Taken','Application Complete','Luncheon Attended','Assigned To','Notes','Teacher Initials','Status']];
    filtered.forEach(m => { rows.push([m.firstName, m.lastName, m.enrollDate, ...m.classes.map(c => c ? 'Y' : 'N'), m.classes.filter(Boolean).length, m.photoTaken?'Y':'N', m.appComplete?'Y':'N', m.luncheonAttended?'Y':'N', m.assignedTo||'', m.notes||'', m.initials||'', completionLabel(m)]); });
    const csv = rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = `DLC_Attendance_${fYear}${fMonth!==''?'_'+MONTHS[parseInt(fMonth)]:''}.csv`; a.click();
  }

  function handleCSVFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const lines = e.target.result.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim());
      const rows = lines.slice(1).map(line => { const vals = line.split(',').map(v => v.replace(/^"|"$/g,'').trim()); const obj = {}; headers.forEach((h,i) => { obj[h] = vals[i]||''; }); return obj; }).filter(r => Object.values(r).some(v => v));
      setCsvHeaders(headers); setCsvRows(rows);
      setCsvMap({ fn: headers.find(h=>/first/i.test(h))||headers[0]||'', ln: headers.find(h=>/last/i.test(h))||headers[1]||'', ed: headers.find(h=>/date|enroll/i.test(h))||'' });
      setIStep(2);
    };
    reader.readAsText(file);
  }
  function buildPreview() { const prev = csvRows.slice(0,5).map(row => { const fn=(row[csvMap.fn]||'').trim(),ln=(row[csvMap.ln]||'').trim(); const dup=members.some(m=>m.firstName.toLowerCase()===fn.toLowerCase()&&m.lastName.toLowerCase()===ln.toLowerCase()); return {fn,ln,ed:(row[csvMap.ed]||'').trim()||todayStr(),dup}; }); setIPreview(prev); setIStep(3); }
  function doImport() { let added=0,skipped=0; const newM=[]; let id=nextId; csvRows.forEach(row=>{ const fn=(row[csvMap.fn]||'').trim(),ln=(row[csvMap.ln]||'').trim(); if(!fn||!ln){skipped++;return;} if(members.some(m=>m.firstName.toLowerCase()===fn.toLowerCase()&&m.lastName.toLowerCase()===ln.toLowerCase())){skipped++;return;} newM.push({id:id++,firstName:fn,lastName:ln,enrollDate:(row[csvMap.ed]||'').trim()||todayStr(),classes:[false,false,false,false],photoTaken:false,appComplete:false,luncheonAttended:false,assignedTo:'',notes:'',initials:''}); added++; }); setMembers(prev=>[...prev,...newM]); setNextId(id); setIResult({added,skipped}); setIStep(4); }
  function doShelbyFetch() { setShLoading(true); setTimeout(()=>{ setShLoading(false); if(!shCfg.ep.trim()){setShResult({err:'Please enter your Shelby Next API endpoint URL.'});setShStep(3);return;} setShData([{fn:'Anthony',ln:'Robinson',ed:'2026-05-02',dup:false},{fn:'Calvin',ln:'Moore',ed:'2026-05-02',dup:false},{fn:'Marcus',ln:'Thompson',ed:'2026-04-10',dup:true}]); setShStep(2); },1400); }
  function doShelbyImport() { let added=0,skipped=0; const newM=[]; let id=nextId; shData.forEach(r=>{ if(r.dup||!r.fn||!r.ln){skipped++;return;} newM.push({id:id++,firstName:r.fn,lastName:r.ln,enrollDate:r.ed||todayStr(),classes:[false,false,false,false],photoTaken:false,appComplete:false,luncheonAttended:false,assignedTo:'',notes:'',initials:''}); added++; }); setMembers(prev=>[...prev,...newM]); setNextId(id); setShResult({added,skipped}); setShStep(3); }
  function loadSample() { const headers=['First Name','Last Name','Enrollment Date']; const rows=[{'First Name':'Tyrone','Last Name':'Jackson','Enrollment Date':'2026-05-01'},{'First Name':'Darnell','Last Name':'Simmons','Enrollment Date':'2026-05-01'},{'First Name':'Marcus','Last Name':'Thompson','Enrollment Date':'2026-04-10'},{'First Name':'Kevin','Last Name':'Davis','Enrollment Date':'2026-05-08'}]; setCsvHeaders(headers); setCsvRows(rows); setCsvMap({fn:'First Name',ln:'Last Name',ed:'Enrollment Date'}); setIStep(2); }

  const years = ['2024','2025','2026'];

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="logo-wrap">
            <img src="/dlclogo.png" alt="Divine Life Church" className="header-logo" />
          </div>
          <div className="header-text">
            <h1>Divine Life Connect</h1>
            <p>New Member Class Attendance Registry</p>
            <span className="badge">Shelby Next Ready</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => setModal('assignees')}>👥 Manage assignees</button>
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
          {MONTHS.map((m,i) => <option key={i} value={i}>{m}</option>)}
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
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member name</th><th>Enrolled</th>
              <th className="center">C1</th><th className="center">C2</th><th className="center">C3</th><th className="center">C4</th>
              <th className="center">Photo</th><th className="center">App</th><th className="center">Luncheon</th>
              <th>Assigned to</th><th>Notes</th><th className="center">Initials</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={14} className="empty">No members found for this filter</td></tr>
            ) : filtered.map(m => {
              const s = completionStatus(m);
              return (
                <tr key={m.id}>
                  <td className="name-cell">{m.firstName} {m.lastName}</td>
                  <td><span className="month-badge">{getMonthYear(m.enrollDate)}</span></td>
                  {m.classes.map((c,i) => (
                    <td key={i} className="center">
                      <button className={`dot ${c ? 'dot-on' : 'dot-off'}`} onClick={() => toggleClass(m.id, i)} title={`Class ${i+1}: ${c ? 'attended' : 'not attended'}`}>{i+1}</button>
                    </td>
                  ))}
                  <td className="center"><input type="checkbox" checked={m.photoTaken} onChange={() => updateMember(m.id, {photoTaken: !m.photoTaken})} title="Photo taken" /></td>
                  <td className="center"><input type="checkbox" checked={m.appComplete} onChange={() => updateMember(m.id, {appComplete: !m.appComplete})} title="Application complete" /></td>
                  <td className="center"><input type="checkbox" checked={m.luncheonAttended} onChange={() => updateMember(m.id, {luncheonAttended: !m.luncheonAttended})} title="New member luncheon" /></td>
                  <td>
                    <select className="inline-select" value={m.assignedTo} onChange={e => updateMember(m.id, {assignedTo: e.target.value})}>
                      <option value="">Unassigned</option>
                      {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td><input className="inline-input" type="text" value={m.notes||''} placeholder="Notes..." onChange={e => updateMember(m.id, {notes: e.target.value})} /></td>
                  <td className="center"><input className="initials-input" type="text" maxLength={4} value={m.initials||''} placeholder="Init." onChange={e => updateMember(m.id, {initials: e.target.value})} /></td>
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
              <div className="form-row"><label>First name *</label><input autoFocus type="text" value={form.firstName} onChange={e => setForm(f=>({...f,firstName:e.target.value}))} /></div>
              <div className="form-row"><label>Last name *</label><input type="text" value={form.lastName} onChange={e => setForm(f=>({...f,lastName:e.target.value}))} /></div>
            </div>
            <div className="form-grid-2">
              <div className="form-row"><label>Enrollment date</label><input type="date" value={form.enrollDate} onChange={e => setForm(f=>({...f,enrollDate:e.target.value}))} /></div>
              <div className="form-row"><label>Assigned to</label>
                <select value={form.assignedTo} onChange={e => setForm(f=>({...f,assignedTo:e.target.value}))}>
                  <option value="">— Unassigned —</option>
                  {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row"><label>Classes attended</label>
              <div className="dot-row">{form.classes.map((c,i) => (<button key={i} className={`dot dot-lg ${c?'dot-on':'dot-off'}`} onClick={() => setForm(f=>{const classes=[...f.classes];classes[i]=!classes[i];return{...f,classes};})} >C{i+1}</button>))}</div>
            </div>
            <div className="section-divider">Completion checklist</div>
            <div className="form-grid-3">
              <label className="check-label"><input type="checkbox" checked={form.photoTaken} onChange={e=>setForm(f=>({...f,photoTaken:e.target.checked}))} /> Photo taken</label>
              <label className="check-label"><input type="checkbox" checked={form.appComplete} onChange={e=>setForm(f=>({...f,appComplete:e.target.checked}))} /> App complete</label>
              <label className="check-label"><input type="checkbox" checked={form.luncheonAttended} onChange={e=>setForm(f=>({...f,luncheonAttended:e.target.checked}))} /> Luncheon attended</label>
            </div>
            <div className="form-row"><label>Teacher initials</label><input type="text" maxLength={4} value={form.initials||''} onChange={e=>setForm(f=>({...f,initials:e.target.value}))} style={{width:80,textAlign:'center'}} /></div>
            <div className="form-row"><label>Notes</label><textarea rows={2} value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={saveMember}>✓ {editId ? 'Save changes' : 'Add member'}</button>
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
              {assignees.map((a,i) => (
                <div key={a} className="assignee-row">
                  <span className="assignee-avatar">{initials(a)}</span>
                  <span className="assignee-name">{a}</span>
                  <button className="btn btn-sm btn-danger" onClick={() => removeAssignee(i)}>Remove</button>
                </div>
              ))}
            </div>
            <div className="add-assignee-row">
              <input autoFocus type="text" placeholder="Add name (e.g. Elder Brown)" value={newAssignee} onChange={e=>setNewAssignee(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addAssignee()} />
              <button className="btn btn-primary" onClick={addAssignee}>+ Add</button>
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
              <button className={`tab ${iTab==='csv'?'active':''}`} onClick={()=>{setITab('csv');setIStep(1);}}>📄 CSV upload</button>
              <button className={`tab ${iTab==='shelby'?'active':''}`} onClick={()=>{setITab('shelby');setShStep(1);}}>🔌 Shelby Next direct connect</button>
            </div>

            {iTab === 'csv' && (<>
              {iStep === 1 && (<>
                <div className="steps-row">{['Upload','Map','Preview','Done'].map((l,i)=><span key={l} className={`step ${i===0?'step-active':'step-inactive'}`}><span className="step-num">{i+1}</span>{l}</span>)}</div>
                <div className="drop-zone" onClick={()=>document.getElementById('csvfi').click()} onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add('dragover');}} onDragLeave={e=>e.currentTarget.classList.remove('dragover')} onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove('dragover');if(e.dataTransfer.files[0])handleCSVFile(e.dataTransfer.files[0]);}}>
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
                <div className="field-map">{[['fn','First name *'],['ln','Last name *'],['ed','Enrollment date']].map(([key,label])=>(<div key={key} className="field-row"><span className="field-label">{label}</span><span className="arrow">→</span><select value={csvMap[key]} onChange={e=>setCsvMap(m=>({...m,[key]:e.target.value}))}>{csvHeaders.map(h=><option key={h} value={h}>{h}</option>)}</select></div>))}</div>
                <div className="modal-footer modal-footer-split"><button className="btn" onClick={()=>setIStep(1)}>← Back</button><button className="btn btn-primary" onClick={buildPreview}>Preview →</button></div>
              </>)}
              {iStep === 3 && (<>
                <div className="steps-row">{['Upload','Map','Preview','Done'].map((l,i)=><span key={l} className={`step ${i===2?'step-active':i<2?'step-done':'step-inactive'}`}><span className="step-num">{i<2?'✓':i+1}</span>{l}</span>)}</div>
                <p className="modal-sub">Preview of first {iPreview.length} rows — duplicates flagged.</p>
                <table className="preview-table"><thead><tr><th>First</th><th>Last</th><th>Date</th><th>Status</th></tr></thead><tbody>{iPreview.map((r,i)=>(<tr key={i} className={r.dup?'dup-row':''}><td>{r.fn||'—'}</td><td>{r.ln||'—'}</td><td>{r.ed}</td><td className={r.dup?'dup-text':'new-text'}>{r.dup?'Duplicate — skip':'New'}</td></tr>))}</tbody></table>
                <div className="modal-footer modal-footer-split"><button className="btn" onClick={()=>setIStep(2)}>← Back</button><button className="btn btn-success" onClick={doImport}>Import {csvRows.length} members</button></div>
              </>)}
              {iStep === 4 && (<>
                <div className="import-result import-ok"><div className="ir-icon">✓</div><strong>{iResult.added} member{iResult.added!==1?'s':''} imported successfully</strong>{iResult.skipped>0&&<p>{iResult.skipped} skipped (duplicates or blank names)</p>}</div>
                <div className="modal-footer"><button className="btn btn-primary" onClick={closeModal}>Done — view roster</button></div>
              </>)}
            </>)}

            {iTab === 'shelby' && (<>
              {shStep === 1 && (<>
                <div className="steps-row">{['Connect','Review','Done'].map((l,i)=><span key={l} className={`step ${i===0?'step-active':'step-inactive'}`}><span className="step-num">{i+1}</span>{l}</span>)}</div>
                <p className="modal-sub">Enter your Shelby Next API credentials — found under <strong>Admin → Integrations → API Access</strong>.</p>
                {[['ep','API endpoint URL *','https://api.shelbynext.com/v1','text'],['key','API key *','sk-••••••••••••','password'],['org','Organization ID','org_12345','text'],['grp','Group / class filter','New Members...','text']].map(([k,label,ph,type])=>(<div key={k} className="shelby-field"><label>{label}</label><input type={type} placeholder={ph} value={shCfg[k]} onChange={e=>setShCfg(c=>({...c,[k]:e.target.value}))} /></div>))}
                <div className="security-note">🔒 Credentials are used only for this session and never stored to a server.</div>
                <div className="modal-footer"><button className="btn" onClick={closeModal}>Cancel</button><button className="btn btn-primary" onClick={doShelbyFetch} disabled={shLoading}>{shLoading?'Fetching...':'🔌 Connect & fetch members'}</button></div>
              </>)}
              {shStep === 2 && (<>
                <div className="steps-row">{['Connect','Review','Done'].map((l,i)=><span key={l} className={`step ${i===1?'step-active':i<1?'step-done':'step-inactive'}`}><span className="step-num">{i<1?'✓':i+1}</span>{l}</span>)}</div>
                <p className="modal-sub"><strong>{shData.length} members</strong> retrieved from Shelby Next.</p>
                <table className="preview-table"><thead><tr><th>First</th><th>Last</th><th>Date</th><th>Status</th></tr></thead><tbody>{shData.map((r,i)=>(<tr key={i} className={r.dup?'dup-row':''}><td>{r.fn}</td><td>{r.ln}</td><td>{r.ed}</td><td className={r.dup?'dup-text':'new-text'}>{r.dup?'Already in roster':'New'}</td></tr>))}</tbody></table>
                <div className="modal-footer modal-footer-split"><button className="btn" onClick={()=>setShStep(1)}>← Back</button><button className="btn btn-success" onClick={doShelbyImport}>Import {shData.filter(r=>!r.dup).length} new members</button></div>
              </>)}
              {shStep === 3 && (<>
                {shResult?.err ? (
                  <div className="import-result import-err"><div className="ir-icon">✕</div><strong>Connection failed</strong><p>{shResult.err}</p></div>
                ) : (
                  <div className="import-result import-ok"><div className="ir-icon">✓</div><strong>{shResult.added} member{shResult.added!==1?'s':''} imported from Shelby Next</strong>{shResult.skipped>0&&<p>{shResult.skipped} already in roster — skipped</p>}</div>
                )}
                <div className="modal-footer"><button className="btn btn-primary" onClick={closeModal}>Done — view roster</button></div>
              </>)}
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
