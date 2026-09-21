import { useState } from 'react'
import { useApp } from '../AppContext'
import { Modal, ModalTitle, FieldLabel, SectionLabel, EmptyState } from '../components/common'
import SupplierPicker from '../components/SupplierPicker'
import { calcReorderQty, calcLengths } from '../lib/materials'

// Editing screens for the purchasing rules. Everything these change lives in
// the database, so a rule can be adjusted without a code change.

function Footer({ onSave, onClose, saveLabel = 'Save Changes' }) {
  const { saving } = useApp()
  return (
    <div style={{ display:'flex', gap:10, marginTop:24 }}>
      <button className="btn-primary" style={{ flex:1 }} onClick={onSave} disabled={saving}>
        {saving ? 'Saving...' : saveLabel}
      </button>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
    </div>
  )
}

// ── The rule itself: which parts it watches and when it fires ────────────────
export function RuleModal({ rule, onSave, onClose }) {
  const { t } = useApp()
  const [draft, setDraft] = useState(rule)

  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }))

  return (
    <Modal onClose={onClose} width={520}>
      <ModalTitle sub="Which parts this rule watches, and when it fires.">
        Edit Reorder Rule
      </ModalTitle>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        <div>
          <FieldLabel>SKU Prefix</FieldLabel>
          <input
            className="field-input" value={draft.skuPrefix}
            onChange={e => set('skuPrefix', e.target.value.toUpperCase())}
            placeholder="e.g. S15"
          />
          <div style={{ fontSize:10, color:t.textFaint, marginTop:5 }}>
            Parts whose SKU starts with this, and whose raw materials mention plate.
          </div>
        </div>
        <div>
          <FieldLabel>Trigger at (machines' worth)</FieldLabel>
          <input
            className="field-input" type="number" min="1" value={draft.machinesWorth}
            onChange={e => set('machinesWorth', parseInt(e.target.value) || 1)}
          />
          <div style={{ fontSize:10, color:t.textFaint, marginTop:5 }}>
            Fires when stock drops to this many machine sets or fewer.
          </div>
        </div>
      </div>

      <div style={{ marginBottom:4 }}>
        <SectionLabel>Supplier to order from</SectionLabel>
        <SupplierPicker value={draft.supplierId} onChange={id => set('supplierId', id)} />
      </div>

      <Footer onSave={() => onSave(draft)} onClose={onClose} />
    </Modal>
  )
}

// ── The fixed plate quantities ordered together ──────────────────────────────
export function PlateOrderModal({ lines, onSave, onClose }) {
  const { t } = useApp()
  const [draft, setDraft] = useState(lines)

  const update = (idx, key, value) => setDraft(d => d.map((l, i) => (i === idx ? { ...l, [key]: value } : l)))
  const remove = idx => setDraft(d => d.filter((_, i) => i !== idx))
  const add = () => setDraft(d => [...d, { id:`new-${Date.now()}`, description:'', qty:1 }])

  const valid = draft.every(l => l.description.trim() !== '' && l.qty > 0)

  return (
    <Modal onClose={onClose} width={620}>
      <ModalTitle sub="Every size on this list goes on the same order when the rule fires.">
        Edit Steel Plate Quantities
      </ModalTitle>

      {draft.length === 0 && (
        <div style={{ marginBottom:12 }}>
          <EmptyState>No plate sizes yet. Add one below.</EmptyState>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {draft.map((line, idx) => (
          <div key={line.id} style={{ display:'grid', gridTemplateColumns:'1fr 90px auto', gap:8, alignItems:'end' }}>
            <div>
              {idx === 0 && <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Description</FieldLabel>}
              <input
                className="field-input" value={line.description}
                onChange={e => update(idx, 'description', e.target.value)}
                placeholder={`e.g. 1/4" Mild Steel, 4' x 8'`}
              />
            </div>
            <div>
              {idx === 0 && <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Qty</FieldLabel>}
              <input
                className="field-input" type="number" min="1" value={line.qty}
                onChange={e => update(idx, 'qty', parseInt(e.target.value) || 1)}
              />
            </div>
            <button className="btn-danger" style={idx === 0 ? { marginTop:18 } : {}} onClick={() => remove(idx)}>✕</button>
          </div>
        ))}
      </div>

      <button className="btn-ghost" style={{ fontSize:10, marginTop:12 }} onClick={add}>+ Add Plate Size</button>

      {!valid && (
        <div style={{ marginTop:12, fontSize:10, color:'#FF9500' }}>
          Every line needs a description and a quantity of at least 1.
        </div>
      )}

      <Footer onSave={() => valid && onSave(draft)} onClose={onClose} />
    </Modal>
  )
}

// ── The bar & tube material list and run size ────────────────────────────────
export function MaterialsModal({ materials, categories, runSize, onSave, onClose }) {
  const { t } = useApp()
  const [draftMaterials, setDraftMaterials] = useState(materials)
  const [draftRunSize, setDraftRunSize] = useState(runSize)
  const [draftCategories, setDraftCategories] = useState(categories)
  const [tab, setTab] = useState('materials')

  const updateMaterial = (idx, key, value) =>
    setDraftMaterials(d => d.map((m, i) => (i === idx ? { ...m, [key]: value } : m)))
  const removeMaterial = idx => setDraftMaterials(d => d.filter((_, i) => i !== idx))
  const addMaterial = () => setDraftMaterials(d => [
    ...d,
    { id:`new-${Date.now()}`, name:'', totalFt:0, categoryId:draftCategories[0]?.id || '' },
  ])

  const updateCategory = (idx, key, value) =>
    setDraftCategories(d => d.map((c, i) => (i === idx ? { ...c, [key]: value } : c)))

  const valid = draftMaterials.every(m => m.name.trim() !== '' && m.categoryId) && draftRunSize > 0

  return (
    <Modal onClose={onClose} width={760}>
      <ModalTitle sub="Footage needed for a full build run, and the standard lengths they are bought in.">
        Edit Bar &amp; Tube Requirements
      </ModalTitle>

      <div style={{ display:'flex', marginBottom:18, border:`1px solid ${t.borderStrong}`, overflow:'hidden' }}>
        {[['materials', `Materials (${draftMaterials.length})`], ['categories', `Standard Lengths (${draftCategories.length})`]].map(([key, label], i) => (
          <button
            key={key} onClick={() => setTab(key)}
            style={{
              flex:1, padding:'10px 0', fontFamily:"'DM Mono',monospace", fontSize:10,
              letterSpacing:'0.07em', border:'none', cursor:'pointer',
              background: tab === key ? t.accent : t.inputBg,
              color: tab === key ? '#fff' : t.textDim,
              borderRight: i === 0 ? `1px solid ${t.borderStrong}` : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom:20, maxWidth:260 }}>
        <FieldLabel>Run size (machines)</FieldLabel>
        <input
          className="field-input" type="number" min="1" value={draftRunSize}
          onChange={e => setDraftRunSize(parseInt(e.target.value) || 1)}
        />
        <div style={{ fontSize:10, color:t.textFaint, marginTop:5 }}>
          The footages below are the total for this many machines.
        </div>
      </div>

      {tab === 'materials' ? (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:360, overflowY:'auto' }}>
            {draftMaterials.map((m, idx) => (
              <div key={m.id} style={{ display:'grid', gridTemplateColumns:'2fr 110px 1fr auto', gap:8, alignItems:'end' }}>
                <div>
                  {idx === 0 && <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Material</FieldLabel>}
                  <input className="field-input" value={m.name} onChange={e => updateMaterial(idx, 'name', e.target.value)} placeholder="e.g. Round Bar Ø1/2&quot; CRS" />
                </div>
                <div>
                  {idx === 0 && <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Total ft</FieldLabel>}
                  <input className="field-input" type="number" min="0" step="0.01" value={m.totalFt} onChange={e => updateMaterial(idx, 'totalFt', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  {idx === 0 && <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Category</FieldLabel>}
                  <select className="field-input" value={m.categoryId} onChange={e => updateMaterial(idx, 'categoryId', e.target.value)}>
                    {draftCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <button className="btn-danger" style={idx === 0 ? { marginTop:18 } : {}} onClick={() => removeMaterial(idx)}>✕</button>
              </div>
            ))}
          </div>
          <button className="btn-ghost" style={{ fontSize:10, marginTop:12 }} onClick={addMaterial}>+ Add Material</button>
        </>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:360, overflowY:'auto' }}>
          <div style={{ fontSize:10, color:t.textFaint, marginBottom:4, lineHeight:1.6 }}>
            The length each material is bought in. Leave blank for anything with no standard
            length — those always round up to the nearest foot.
          </div>
          {draftCategories.map((c, idx) => (
            <div key={c.id} style={{ display:'grid', gridTemplateColumns:'16px 2fr 130px', gap:10, alignItems:'end' }}>
              <div style={{ width:10, height:10, background:c.color, borderRadius:'50%', marginBottom:10 }} />
              <div>
                {idx === 0 && <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Category</FieldLabel>}
                <input className="field-input" value={c.label} onChange={e => updateCategory(idx, 'label', e.target.value)} />
              </div>
              <div>
                {idx === 0 && <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Standard length (ft)</FieldLabel>}
                <input
                  className="field-input" type="number" min="0" step="0.5"
                  value={c.stdLength ?? ''} placeholder="none"
                  onChange={e => updateCategory(idx, 'stdLength', e.target.value === '' ? null : parseFloat(e.target.value))}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* What the change means, before it is saved. */}
      {tab === 'materials' && draftMaterials.length > 0 && (
        <div style={{ marginTop:16, background:`rgba(${t.accentRgb},0.05)`, border:`1px solid rgba(${t.accentRgb},0.2)`, padding:'10px 14px', fontSize:10, color:t.textDim }}>
          {(() => {
            const totalLengths = draftMaterials.reduce((sum, m) => {
              const cat = draftCategories.find(c => c.id === m.categoryId)
              if (!cat) return sum
              const qty = calcReorderQty(m.totalFt, cat.stdLength)
              return sum + (calcLengths(qty, cat.stdLength) || 0)
            }, 0)
            return <>This order works out at <strong style={{ color:t.textMid }}>{totalLengths} full lengths</strong> across {draftMaterials.length} materials for {draftRunSize} machines.</>
          })()}
        </div>
      )}

      {!valid && (
        <div style={{ marginTop:12, fontSize:10, color:'#FF9500' }}>
          Every material needs a name and a category, and the run size must be at least 1.
        </div>
      )}

      <Footer
        onSave={() => valid && onSave({ materials:draftMaterials, categories:draftCategories, runSize:draftRunSize })}
        onClose={onClose}
      />
    </Modal>
  )
}
