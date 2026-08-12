import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';

const blankItem = () => ({ name:'', category:'General', sku:'', description:'', quantity_on_hand:0, reorder_level:0, unit:'each', location:'' });

export default function ConnectInventory() {
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('');
  const [showItem,setShowItem]=useState(false);
  const [showTxn,setShowTxn]=useState(null);
  const [form,setForm]=useState(blankItem());
  const [txn,setTxn]=useState({transaction_type:'issue',quantity:1,issued_to:'',notes:''});
  const [saving,setSaving]=useState(false);

  async function loadItems(){
    setLoading(true);
    const {data,error}=await supabase.from('inventory_items').select('*').eq('active',true).order('category').order('name');
    if(error) setError('Inventory is not connected yet. Run the new Supabase migration, then refresh.');
    else {setItems(data||[]);setError('');}
    setLoading(false);
  }
  useEffect(()=>{loadItems()},[]);

  const categories=[...new Set(items.map(i=>i.category).filter(Boolean))].sort();
  const filtered=useMemo(()=>items.filter(i=>(!search||`${i.name} ${i.sku||''}`.toLowerCase().includes(search.toLowerCase()))&&(!category||i.category===category)),[items,search,category]);
  const lowStock=items.filter(i=>i.quantity_on_hand<=i.reorder_level).length;
  const totalUnits=items.reduce((s,i)=>s+(i.quantity_on_hand||0),0);

  async function saveItem(){
    if(!form.name.trim())return;
    setSaving(true);
    const payload={...form,name:form.name.trim(),sku:form.sku.trim()||null,description:form.description.trim()||null,location:form.location.trim()||null,quantity_on_hand:Number(form.quantity_on_hand)||0,reorder_level:Number(form.reorder_level)||0};
    const {error}=await supabase.from('inventory_items').insert(payload);
    setSaving(false);
    if(error)return setError(`Could not add inventory item: ${error.message}`);
    setForm(blankItem());setShowItem(false);loadItems();
  }

  async function saveTransaction(){
    const qty=Math.max(1,Number(txn.quantity)||1);
    const item=showTxn;
    if(!item)return;
    let newQty=item.quantity_on_hand;
    if(txn.transaction_type==='add'||txn.transaction_type==='return') newQty+=qty;
    if(txn.transaction_type==='issue') newQty-=qty;
    if(txn.transaction_type==='adjustment') newQty=qty;
    if(newQty<0)return setError(`Not enough ${item.name} in stock.`);
    setSaving(true);
    const {error:txErr}=await supabase.from('inventory_transactions').insert({item_id:item.id,transaction_type:txn.transaction_type,quantity:qty,issued_to:txn.issued_to.trim()||null,notes:txn.notes.trim()||null});
    if(txErr){setSaving(false);return setError(`Could not save inventory transaction: ${txErr.message}`)}
    const {error:updateErr}=await supabase.from('inventory_items').update({quantity_on_hand:newQty}).eq('id',item.id);
    setSaving(false);
    if(updateErr)return setError(`Transaction saved, but quantity update failed: ${updateErr.message}`);
    setShowTxn(null);setTxn({transaction_type:'issue',quantity:1,issued_to:'',notes:''});loadItems();
  }

  return <section className="inventory-workspace">
    <div className="module-header"><div><p className="eyebrow">Connect operations</p><h1>Inventory</h1><p>Keep member materials, packets, apparel, certificates and ministry supplies visible and easy to manage.</p></div><div className="module-actions"><button className="shell-btn primary" onClick={()=>setShowItem(true)}>+ Add Item</button></div></div>
    {error&&<div className="shell-alert">{error}</div>}
    <div className="module-stats"><div><span>Active Items</span><strong>{items.length}</strong></div><div><span>Total Units</span><strong>{totalUnits}</strong></div><div><span>Low Stock</span><strong>{lowStock}</strong></div><div><span>Categories</span><strong>{categories.length}</strong></div></div>
    <div className="guest-filters"><input placeholder="Search item or SKU…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
    <div className="inventory-grid">{loading?<div className="empty-state">Loading inventory…</div>:filtered.length===0?<div className="empty-state">No inventory items yet.</div>:filtered.map(item=><article className={`inventory-card ${item.quantity_on_hand<=item.reorder_level?'low':''}`} key={item.id}><div className="inventory-card-top"><span className="category-chip">{item.category}</span>{item.quantity_on_hand<=item.reorder_level&&<span className="low-chip">Low stock</span>}</div><h3>{item.name}</h3><p>{item.description||item.sku||'No description'}</p><div className="inventory-count"><strong>{item.quantity_on_hand}</strong><span>{item.unit}{item.quantity_on_hand===1?'':'s'} on hand</span></div><div className="inventory-meta"><span>Reorder at {item.reorder_level}</span><span>{item.location||'No location'}</span></div><button className="shell-btn secondary full" onClick={()=>setShowTxn(item)}>Update Stock</button></article>)}</div>

    {showItem&&<div className="shell-modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowItem(false)}><div className="shell-modal"><div className="shell-modal-head"><div><p className="eyebrow">Connect inventory</p><h2>Add Inventory Item</h2></div><button onClick={()=>setShowItem(false)}>✕</button></div><div className="form-two"><label>Item Name *<input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Category<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label></div><div className="form-two"><label>SKU<input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})}/></label><label>Unit<input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></label></div><div className="form-two"><label>Starting Quantity<input type="number" min="0" value={form.quantity_on_hand} onChange={e=>setForm({...form,quantity_on_hand:e.target.value})}/></label><label>Reorder Level<input type="number" min="0" value={form.reorder_level} onChange={e=>setForm({...form,reorder_level:e.target.value})}/></label></div><label>Storage Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Description<textarea rows="2" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="shell-modal-actions"><button className="shell-btn secondary" onClick={()=>setShowItem(false)}>Cancel</button><button className="shell-btn primary" disabled={saving} onClick={saveItem}>{saving?'Saving…':'Add Item'}</button></div></div></div>}

    {showTxn&&<div className="shell-modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowTxn(null)}><div className="shell-modal"><div className="shell-modal-head"><div><p className="eyebrow">{showTxn.quantity_on_hand} on hand</p><h2>{showTxn.name}</h2></div><button onClick={()=>setShowTxn(null)}>✕</button></div><label>Action<select value={txn.transaction_type} onChange={e=>setTxn({...txn,transaction_type:e.target.value})}><option value="issue">Issue / Give Out</option><option value="add">Add Stock</option><option value="return">Return</option><option value="adjustment">Set Exact Quantity</option></select></label><label>{txn.transaction_type==='adjustment'?'New Quantity':'Quantity'}<input type="number" min="1" value={txn.quantity} onChange={e=>setTxn({...txn,quantity:e.target.value})}/></label>{txn.transaction_type==='issue'&&<label>Issued To<input placeholder="Member, class or ministry" value={txn.issued_to} onChange={e=>setTxn({...txn,issued_to:e.target.value})}/></label>}<label>Notes<textarea rows="2" value={txn.notes} onChange={e=>setTxn({...txn,notes:e.target.value})}/></label><div className="shell-modal-actions"><button className="shell-btn secondary" onClick={()=>setShowTxn(null)}>Cancel</button><button className="shell-btn primary" disabled={saving} onClick={saveTransaction}>{saving?'Saving…':'Save Stock Update'}</button></div></div></div>}
  </section>
}
