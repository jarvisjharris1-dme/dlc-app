import { useEffect, useState } from 'react';
import ConnectTeamApp from './App.jsx';
import { supabase } from './supabase.js';
import './ConnectTeamShell.css';

const blankItem = () => ({ item_name:'', category:'New Member Materials', quantity:0, minimum_quantity:10, notes:'' });

function relabelPastorsAndElders(root){
  if(!root) return;
  const replacements = new Map([
    ['✝ Pastors','✝ Pastors & Elders'],
    ['Pastor','Pastor & Elder'],
    ['Pastor assigned','Pastor & Elder assigned'],
    ['✝ Manage Pastors','✝ Manage Pastors & Elders'],
    ['These names populate the "Pastor Assigned" dropdown on each member record.','These names populate the "Pastor & Elder Assigned" dropdown on each member record.'],
    ['No pastors added yet.','No pastors or elders added yet.'],
    ['Add pastor name (e.g. Pastor Williams)','Add pastor or elder name']
  ]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const text = node.nodeValue;
    if(replacements.has(text)) node.nodeValue = replacements.get(text);
  });
}

export default function ConnectTeamShell({ onHome }){
  const [inventoryOpen,setInventoryOpen] = useState(false);
  const [items,setItems] = useState([]);
  const [editing,setEditing] = useState(null);
  const [newItem,setNewItem] = useState(blankItem());
  const [message,setMessage] = useState('');

  async function loadInventory(){
    const {data,error} = await supabase.from('connect_team_inventory').select('*').order('item_name');
    if(error){ setMessage('Could not load Connect Team inventory.'); return; }
    setItems(data || []);
  }

  useEffect(()=>{
    relabelPastorsAndElders(document.body);
    const observer = new MutationObserver(()=>relabelPastorsAndElders(document.body));
    observer.observe(document.body,{childList:true,subtree:true});
    return ()=>observer.disconnect();
  },[]);

  useEffect(()=>{ if(inventoryOpen) loadInventory(); },[inventoryOpen]);

  async function addItem(){
    if(!newItem.item_name.trim()) return setMessage('Item name is required.');
    const payload = {...newItem,item_name:newItem.item_name.trim(),quantity:Number(newItem.quantity)||0,minimum_quantity:Number(newItem.minimum_quantity)||0};
    const {error} = await supabase.from('connect_team_inventory').insert(payload);
    if(error) return setMessage('Could not add inventory item.');
    setNewItem(blankItem()); setMessage('Inventory item added.'); loadInventory();
  }

  async function saveItem(){
    if(!editing) return;
    const {error} = await supabase.from('connect_team_inventory').update({
      item_name:editing.item_name,
      category:editing.category,
      quantity:Number(editing.quantity)||0,
      minimum_quantity:Number(editing.minimum_quantity)||0,
      notes:editing.notes || '',
      updated_at:new Date().toISOString()
    }).eq('id',editing.id);
    if(error) return setMessage('Could not update inventory item.');
    setEditing(null); setMessage('Inventory item updated.'); loadInventory();
  }

  async function deleteItem(item){
    if(!confirm(`Delete ${item.item_name} from Connect Team inventory?`)) return;
    const {error} = await supabase.from('connect_team_inventory').delete().eq('id',item.id);
    if(error) return setMessage('Could not delete inventory item.');
    setMessage(`${item.item_name} deleted.`); loadInventory();
  }

  async function quickAdjust(item,delta){
    const next = Math.max(0, Number(item.quantity) + delta);
    const {error} = await supabase.from('connect_team_inventory').update({quantity:next,updated_at:new Date().toISOString()}).eq('id',item.id);
    if(error) return setMessage('Could not update quantity.');
    await supabase.from('connect_team_inventory_transactions').insert({inventory_item_id:item.id,transaction_type:delta>0?'add':'use',quantity:Math.abs(delta),previous_quantity:item.quantity,new_quantity:next,notes:'Quick update'});
    loadInventory();
  }

  return <div className="ct-shell-wrap">
    <ConnectTeamApp />
    <button className="dlc-home-float" onClick={onHome}>← Divine Life Connect</button>
    <button className="ct-inventory-launch" onClick={()=>setInventoryOpen(true)}>📦 Inventory</button>

    {inventoryOpen && <div className="ct-modal-bg" onClick={e=>e.target===e.currentTarget&&setInventoryOpen(false)}>
      <div className="ct-inventory-modal">
        <div className="ct-modal-head">
          <div><small>CONNECT TEAM</small><h2>Inventory</h2><p>Keep new-member materials ready.</p></div>
          <button onClick={()=>setInventoryOpen(false)}>✕</button>
        </div>
        {message && <div className="ct-message">{message}<button onClick={()=>setMessage('')}>×</button></div>}

        <div className="ct-add-grid">
          <input placeholder="Item name" value={newItem.item_name} onChange={e=>setNewItem({...newItem,item_name:e.target.value})}/>
          <select value={newItem.category} onChange={e=>setNewItem({...newItem,category:e.target.value})}><option>New Member Materials</option><option>Class Materials</option><option>Completion Materials</option><option>Office Supplies</option><option>Other</option></select>
          <input type="number" min="0" placeholder="On hand" value={newItem.quantity} onChange={e=>setNewItem({...newItem,quantity:e.target.value})}/>
          <input type="number" min="0" placeholder="Minimum" value={newItem.minimum_quantity} onChange={e=>setNewItem({...newItem,minimum_quantity:e.target.value})}/>
          <button className="ct-primary" onClick={addItem}>+ Add Item</button>
        </div>

        <div className="ct-table-wrap"><table><thead><tr><th>Item</th><th>On Hand</th><th>Minimum</th><th>Status</th><th>Quick Update</th><th></th></tr></thead><tbody>
          {items.map(item=><tr key={item.id}><td><strong>{item.item_name}</strong><br/><small>{item.category || 'Other'}</small></td><td>{item.quantity}</td><td>{item.minimum_quantity}</td><td><span className={`ct-status ${item.quantity<=item.minimum_quantity?'low':'good'}`}>{item.quantity===0?'Out of Stock':item.quantity<=item.minimum_quantity?'Low Stock':'Good'}</span></td><td><button onClick={()=>quickAdjust(item,5)}>+5</button> <button onClick={()=>quickAdjust(item,-5)}>-5</button></td><td><button onClick={()=>setEditing({...item})}>Update</button> <button className="ct-danger" onClick={()=>deleteItem(item)}>Delete</button></td></tr>)}
          {!items.length&&<tr><td colSpan="6" className="ct-empty">No inventory items yet.</td></tr>}
        </tbody></table></div>
      </div>
    </div>}

    {editing && <div className="ct-modal-bg"><div className="ct-edit-modal"><h2>Update Inventory Item</h2><label>Item Name<input value={editing.item_name||''} onChange={e=>setEditing({...editing,item_name:e.target.value})}/></label><label>Category<input value={editing.category||''} onChange={e=>setEditing({...editing,category:e.target.value})}/></label><label>Quantity On Hand<input type="number" min="0" value={editing.quantity} onChange={e=>setEditing({...editing,quantity:e.target.value})}/></label><label>Minimum Quantity<input type="number" min="0" value={editing.minimum_quantity} onChange={e=>setEditing({...editing,minimum_quantity:e.target.value})}/></label><label>Notes<textarea value={editing.notes||''} onChange={e=>setEditing({...editing,notes:e.target.value})}/></label><div><button className="ct-primary" onClick={saveItem}>Save Changes</button> <button onClick={()=>setEditing(null)}>Cancel</button></div></div></div>}
  </div>;
}
