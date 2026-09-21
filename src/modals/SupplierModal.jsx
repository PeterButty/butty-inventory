import { useApp } from '../AppContext'
import { Modal, FieldLabel, SectionLabel } from '../components/common'

const FIELDS = [
  { label:'Company Name',  key:'name',    full:true  },
  { label:'Contact Person', key:'contact', full:false },
  { label:'Email Address', key:'email',   full:true  },
  { label:'Phone',         key:'phone',   full:false },
]

function PartSearchResults({ query, selected, onToggle }) {
  const { t, products } = useApp()
  if (query.trim() === '') return null

  const q = query.toLowerCase()
  const matches = products
    .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    .slice(0, 20)

  return (
    <div style={{ maxHeight:180, overflowY:'auto', display:'flex', flexDirection:'column', gap:3, marginBottom:12, border:`1px solid ${t.border}`, borderRadius:4, padding:4 }}>
      {matches.length === 0 && (
        <div style={{ padding:'10px', fontSize:11, color:t.textFaint, textAlign:'center' }}>No parts found</div>
      )}
      {matches.map(p => {
        const checked = selected.includes(p.id)
        return (
          <label key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', background:checked ? `rgba(${t.accentRgb},0.1)` : t.inputBg, border:`1px solid ${checked ? t.accent : t.border}`, borderRadius:3, cursor:'pointer', transition:'all 0.15s' }}>
            <input type="checkbox" checked={checked} onChange={() => onToggle(p.id)} style={{ accentColor:t.accent, width:14, height:14 }} />
            <span style={{ fontSize:11, color:t.text }}>{p.name}</span>
            <span style={{ fontSize:10, color:t.textDim, marginLeft:'auto' }}>{p.sku}</span>
          </label>
        )
      })}
    </div>
  )
}

function LinkedParts({ selected, onRemove }) {
  const { t, products } = useApp()

  if (selected.length === 0) {
    return (
      <div style={{ fontSize:11, color:t.textFaint, padding:'10px', border:`1px dashed ${t.border}`, borderRadius:4, textAlign:'center' }}>
        No parts linked yet — search above to add
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <div style={{ fontSize:9, color:t.textFaint, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>
        Linked ({selected.length})
      </div>
      {selected.map(pid => {
        const p = products.find(x => x.id === pid)
        if (!p) return null
        return (
          <div key={pid} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', background:`rgba(${t.accentRgb},0.07)`, border:`1px solid ${t.accent}`, borderRadius:3 }}>
            <span style={{ fontSize:11, color:t.text, flex:1 }}>{p.name}</span>
            <span style={{ fontSize:10, color:t.textDim }}>{p.sku}</span>
            <button onClick={() => onRemove(pid)} title="Remove" style={{ background:'none', border:'none', color:t.textDim, cursor:'pointer', fontSize:14, lineHeight:1, padding:'0 2px' }}>×</button>
          </div>
        )
      })}
    </div>
  )
}

export default function SupplierModal({ mode, form, setForm, search, setSearch, onSave, onClose }) {
  const { saving } = useApp()
  const selected = form.products || []

  const setField = (key, value) => setForm(s => ({ ...s, [key]: value }))
  const toggleProduct = pid => setForm(s => ({
    ...s,
    products: (s.products || []).includes(pid)
      ? s.products.filter(id => id !== pid)
      : [...(s.products || []), pid],
  }))

  return (
    <Modal onClose={onClose} width={540}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:24 }}>
        {mode === 'add' ? 'Add Supplier' : 'Edit Supplier'}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        {FIELDS.map(f => (
          <div key={f.key} style={f.full ? { gridColumn:'1/-1' } : {}}>
            <FieldLabel>{f.label}</FieldLabel>
            <input className="field-input" value={form[f.key] || ''} onChange={e => setField(f.key, e.target.value)} />
          </div>
        ))}
        <div style={{ gridColumn:'1/-1' }}>
          <FieldLabel>Notes (lead times, MOQ, etc.)</FieldLabel>
          <input
            className="field-input" value={form.notes || ''}
            onChange={e => setField('notes', e.target.value)}
            placeholder="e.g. 5–7 day lead time, minimum order 50 units"
          />
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <SectionLabel>Products Supplied</SectionLabel>
        <input
          className="field-input" placeholder="Search parts by name or SKU…"
          value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom:8 }}
        />
        <PartSearchResults query={search} selected={selected} onToggle={toggleProduct} />
        <LinkedParts selected={selected} onRemove={toggleProduct} />
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <button className="btn-primary" style={{ flex:1 }} onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : mode === 'add' ? 'Add Supplier' : 'Save Changes'}
        </button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}
