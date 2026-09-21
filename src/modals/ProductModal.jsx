import { useMemo } from 'react'
import { useApp } from '../AppContext'
import { Modal, ModalTitle, FieldLabel, SectionLabel, EmptyState, PhotoField } from '../components/common'
import SupplierPicker from '../components/SupplierPicker'
import LineItemRows from '../components/LineItemRows'
import { partsCausingLoop } from '../lib/builds'

const BASIC_FIELDS = [
  { label:'SKU',             key:'sku'                      },
  { label:'Name',            key:'name',       full:true    },
  { label:'Category',        key:'category'                 },
  { label:'Location',        key:'location'                 },
  { label:'Stock Qty',       key:'stock',      type:'number' },
  { label:'Min Stock Level', key:'minStock',   type:'number' },
  { label:'Reorder Qty',     key:'reorderQty', type:'number' },
  { label:'Unit',            key:'unit'                     },
]

const PART_TYPES = [
  ['purchased',   '🛒  Purchased'],
  ['made',        '⚙  Made In-House'],
  ['subassembly', '🔩  Subassembly'],
]

const RAW_UNITS = ['kg','g','m','mm','m²','m³','L','sheets','bars','lengths','pcs']

function Callout({ color, rgb, icon, children }) {
  return (
    <div style={{ background:`rgba(${rgb},0.06)`, border:`1px solid rgba(${rgb},0.25)`, padding:'10px 14px', marginBottom:16, fontSize:10, color, display:'flex', gap:8 }}>
      <span style={{ fontSize:14, flexShrink:0 }}>{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function SectionHeader({ label, action, onAction }) {
  const { t } = useApp()
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
      <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.1em', textTransform:'uppercase' }}>{label}</div>
      <button className="btn-ghost" style={{ fontSize:10 }} onClick={onAction}>{action}</button>
    </div>
  )
}

function RawMaterialRow({ material, index, reorderQty, onUpdate, onRemove }) {
  const { t } = useApp()
  const update = (key, val) => onUpdate(index, key, val)

  return (
    <div style={{ background:t.inputBg, border:`1px solid ${t.border}`, padding:'12px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:8, marginBottom:8 }}>
        <div>
          <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Material Name</FieldLabel>
          <input className="field-input" placeholder="e.g. Mild Steel Sheet" value={material.material} onChange={e => update('material', e.target.value)} />
        </div>
        <div>
          <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Type / Grade</FieldLabel>
          <input className="field-input" placeholder="e.g. S275, 304SS" value={material.type} onChange={e => update('type', e.target.value)} />
        </div>
        <div>
          <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Size / Spec</FieldLabel>
          <input className="field-input" placeholder="e.g. 3mm, 25×50mm" value={material.size} onChange={e => update('size', e.target.value)} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, alignItems:'end' }}>
        <div>
          <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Qty Per Batch</FieldLabel>
          <input className="field-input" type="number" min="0" step="0.01" placeholder="0" value={material.qtyPerBatch} onChange={e => update('qtyPerBatch', e.target.value)} />
        </div>
        <div>
          <FieldLabel size={9} style={{ letterSpacing:'0.08em', marginBottom:4 }}>Unit</FieldLabel>
          <select className="field-input" value={material.unit} onChange={e => update('unit', e.target.value)}>
            {RAW_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <button className="btn-danger" onClick={() => onRemove(index)}>✕</button>
      </div>

      {material.qtyPerBatch !== '' && material.qtyPerBatch != null && (
        <div style={{ marginTop:10, paddingTop:8, borderTop:`1px solid ${t.border}`, fontSize:10, color:t.textDim, display:'flex', gap:16 }}>
          <span>Per finished part: <b style={{ color:t.textMid }}>{(parseFloat(material.qtyPerBatch) || 0).toFixed(4)} {material.unit}</b></span>
          {reorderQty > 0 && (
            <span>To make {reorderQty} parts: <b style={{ color:'#FF9500' }}>{((parseFloat(material.qtyPerBatch) || 0) * reorderQty).toFixed(2)} {material.unit}</b></span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Adjust stock ─────────────────────────────────────────────────────────────
function AdjustForm({ product, adjustType, setAdjustType, adjustQty, setAdjustQty, onApply, onClose }) {
  const { t, saving } = useApp()

  return (
    <>
      <ModalTitle sub={<>{product.sku} · {product.name} · Current: <span style={{ color:t.text }}>{product.stock}</span></>}>
        Adjust Stock
      </ModalTitle>

      <div style={{ display:'flex', gap:10, marginBottom:18 }}>
        {['add','remove'].map(type => (
          <button
            key={type} onClick={() => setAdjustType(type)}
            style={{ flex:1, padding:'10px', background:adjustType === type ? t.accent : t.cardBg, color:adjustType === type ? '#fff' : t.textMid, border:'none', fontFamily:'DM Mono,monospace', fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', cursor:'pointer' }}
          >
            {type === 'add' ? '+ Add' : '– Remove'}
          </button>
        ))}
      </div>

      <input className="field-input" type="number" min="0" placeholder="Quantity" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} style={{ marginBottom:20 }} />

      <div style={{ display:'flex', gap:10 }}>
        <button className="btn-primary" style={{ flex:1 }} onClick={onApply} disabled={saving}>
          {saving ? 'Saving...' : 'Apply'}
        </button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </>
  )
}

// ── Add / edit a part ────────────────────────────────────────────────────────
function ProductForm({ mode, form, setForm, onSave, onClose }) {
  const { t, machines, products, saving } = useApp()

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const updateList = (listKey, idx, key, val) => setForm(f => {
    const list = [...(f[listKey] || [])]
    list[idx] = { ...list[idx], [key]: val }
    return { ...f, [listKey]: list }
  })
  const removeFromList = (listKey, idx) => setForm(f => ({ ...f, [listKey]: f[listKey].filter((_, i) => i !== idx) }))
  const addToList = (listKey, item) => setForm(f => ({ ...f, [listKey]: [...(f[listKey] || []), item] }))

  const reorderQty = parseFloat(form.reorderQty) || 0

  // Anything that would make this assembly contain itself, directly or through
  // another assembly, is kept out of the component picker.
  const loopingParts = useMemo(() => partsCausingLoop(form.id, products), [form.id, products])

  return (
    <>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:24, color:t.text }}>
        {mode === 'add' ? 'Add Product' : 'Edit Product'}
      </div>

      <div style={{ marginBottom:20 }}>
        <FieldLabel style={{ marginBottom:8 }}>Product Photo</FieldLabel>
        <PhotoField
          imageUrl={form.imageUrl}
          onFile={file => {
            if (!file || !file.type.startsWith('image/')) return
            const reader = new FileReader()
            reader.onload = e => setForm(f => ({ ...f, imageUrl:e.target.result, _imageFile:file }))
            reader.readAsDataURL(file)
          }}
          onRemove={() => setForm(f => ({ ...f, imageUrl:null, _imageFile:null }))}
        />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        {BASIC_FIELDS.map(f => (
          <div key={f.key} style={f.full ? { gridColumn:'1/-1' } : {}}>
            <FieldLabel>{f.label}</FieldLabel>
            <input
              className="field-input" type={f.type || 'text'} value={form[f.key] ?? ''}
              onChange={e => {
                const val = e.target.value
                setForm(p => ({
                  ...p,
                  [f.key]: val,
                  // An S15 SKU always belongs to the SW150 machine.
                  ...(f.key === 'sku' && val.toUpperCase().startsWith('S15') ? { category:'SW150' } : {}),
                }))
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:18, marginBottom:20 }}>
        <SectionLabel style={{ marginBottom:14 }}>Sourcing &amp; Reordering</SectionLabel>

        <div style={{ display:'flex', marginBottom:18, border:`1px solid ${t.borderStrong}`, overflow:'hidden', width:'100%' }}>
          {PART_TYPES.map(([val, label], i) => (
            <button
              key={val} onClick={() => setField('partType', val)}
              style={{
                flex:1, padding:'10px 0', fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.07em',
                border:'none', cursor:'pointer', transition:'all 0.2s',
                background: form.partType === val ? t.accent : t.inputBg,
                color: form.partType === val ? '#fff' : t.textDim,
                borderRight: i < PART_TYPES.length - 1 ? `1px solid ${t.borderStrong}` : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {form.partType === 'purchased' && (
          <div>
            <FieldLabel style={{ letterSpacing:'0.08em', marginBottom:8 }}>Supplier</FieldLabel>
            <SupplierPicker
              value={form.supplierId}
              onChange={id => setField('supplierId', id)}
              showAssignedTo={form.id}
            />
          </div>
        )}

        {form.partType === 'subassembly' && (
          <div>
            <Callout color="#64D2FF" rgb="100,210,255" icon="🔩">
              Define the inventory parts that go into this subassembly. When you build units,
              component stock will be deducted and assembly stock increased.
            </Callout>

            <SectionHeader
              label="Component Parts"
              action="+ Add Component"
              onAction={() => addToList('bomComponents', { productId:'', qty:1, note:'' })}
            />

            <LineItemRows
              rows={form.bomComponents || []}
              onChange={(idx, key, val) => updateList('bomComponents', idx, key, val)}
              onRemove={idx => removeFromList('bomComponents', idx)}
              valueField="productId"
              selectLabel="COMPONENT PART"
              placeholder="— Select part —"
              emptyMessage='No components defined yet. Click "+ Add Component" above.'
              options={products
                .filter(p => !loopingParts.has(p.id))
                .map(p => ({ value:p.id, label:`${p.name} (${p.sku}) — ${p.stock} in stock` }))}
            />

            {(form.bomComponents || []).length > 0 && (
              <div style={{ fontSize:10, color:t.textFaint, marginTop:8 }}>
                Total: {form.bomComponents.length} component type{form.bomComponents.length !== 1 ? 's' : ''} per assembly unit
              </div>
            )}
          </div>
        )}

        {form.partType === 'made' && (
          <div>
            <Callout color="#FF9500" rgb="255,149,0" icon="⚙">
              Define the raw materials needed to produce one finished unit. When stock falls below
              minimum, the system will calculate and order the correct raw material quantities.
            </Callout>

            <SectionHeader
              label="Raw Materials Required"
              action="+ Add Material"
              onAction={() => addToList('rawMaterials', { material:'', type:'', size:'', qtyPerBatch:1, unit:'kg' })}
            />

            {(form.rawMaterials || []).length === 0 && (
              <div style={{ marginBottom:8 }}>
                <EmptyState>No raw materials defined yet. Click "+ Add Material" above.</EmptyState>
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
              {(form.rawMaterials || []).map((rm, idx) => (
                <RawMaterialRow
                  key={idx}
                  material={rm}
                  index={idx}
                  reorderQty={reorderQty}
                  onUpdate={(i, key, val) => updateList('rawMaterials', i, key, val)}
                  onRemove={i => removeFromList('rawMaterials', i)}
                />
              ))}
            </div>

            {(form.rawMaterials || []).length > 0 && (
              <div style={{ marginTop:12 }}>
                <FieldLabel size={9} style={{ letterSpacing:'0.1em', marginBottom:8 }}>Raw Material Supplier</FieldLabel>
                <div style={{ fontSize:10, color:t.textFaint, marginBottom:8 }}>Who supplies the raw material for this part?</div>
                <SupplierPicker
                  value={form.supplierId}
                  onChange={id => setField('supplierId', id)}
                  emptyMessage="No suppliers yet."
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:18, marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div>
            <SectionLabel style={{ marginBottom:2 }}>Machine Usage</SectionLabel>
            <div style={{ fontSize:10, color:t.textFaint }}>Which machines use this part, and how many per build?</div>
          </div>
          <button className="btn-ghost" style={{ fontSize:10 }} onClick={() => addToList('machineLinks', { machineId:'', qty:1, note:'' })}>
            + Link Machine
          </button>
        </div>

        <LineItemRows
          rows={form.machineLinks || []}
          onChange={(idx, key, val) => updateList('machineLinks', idx, key, val)}
          onRemove={idx => removeFromList('machineLinks', idx)}
          valueField="machineId"
          selectLabel="MACHINE"
          qtyLabel="QTY / BUILD"
          placeholder="— Select machine —"
          notePlaceholder="e.g. Frame brackets"
          emptyMessage="Not linked to any machine yet"
          options={machines.map(m => ({ value:m.id, label:m.name }))}
        />
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <button className="btn-primary" style={{ flex:1 }} onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : mode === 'add' ? 'Add Product' : 'Save Changes'}
        </button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </>
  )
}

export default function ProductModal({ modal, form, setForm, adjust, onSave, onApplyAdjust, onClose }) {
  if (!modal) return null

  return (
    <Modal onClose={onClose}>
      {modal.mode === 'adjust'
        ? <AdjustForm product={modal.product} onApply={onApplyAdjust} onClose={onClose} {...adjust} />
        : <ProductForm mode={modal.mode} form={form} setForm={setForm} onSave={onSave} onClose={onClose} />}
    </Modal>
  )
}
