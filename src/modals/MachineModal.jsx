import { useApp } from '../AppContext'
import { Modal, FieldLabel, SectionLabel, PhotoField } from '../components/common'
import LineItemRows from '../components/LineItemRows'

export default function MachineModal({ mode, form, setForm, onSave, onClose }) {
  const { products, saving } = useApp()

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const updateComponent = (idx, field, val) => setForm(f => {
    const comps = [...f.components]
    comps[idx] = { ...comps[idx], [field]: val }
    return { ...f, components: comps }
  })

  const removeComponent = idx => setForm(f => ({ ...f, components: f.components.filter((_, i) => i !== idx) }))
  const addComponent = () => setForm(f => ({ ...f, components: [...f.components, { productId:'', qty:1, note:'' }] }))

  return (
    <Modal onClose={onClose} width={620}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:24 }}>
        {mode === 'add' ? 'New Machine / Bill of Materials' : 'Edit Bill of Materials'}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        <div style={{ gridColumn:'1/-1' }}>
          <FieldLabel>Machine Name</FieldLabel>
          <input className="field-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Assembly Unit Alpha" />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <FieldLabel>Description (optional)</FieldLabel>
          <input className="field-input" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Brief description..." />
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <FieldLabel style={{ marginBottom:8 }}>Machine Photo (optional)</FieldLabel>
        <PhotoField
          imageUrl={form.imageUrl}
          previewWidth={120}
          previewHeight={80}
          icon="🏭"
          prompt="Click to upload a machine photo"
          onFile={file => {
            if (!file || !file.type.startsWith('image/')) return
            const reader = new FileReader()
            reader.onload = e => setForm(f => ({ ...f, imageUrl:e.target.result, _imageFile:file }))
            reader.readAsDataURL(file)
          }}
          onRemove={() => setForm(f => ({ ...f, imageUrl:null, _imageFile:null }))}
        />
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <SectionLabel style={{ marginBottom:0 }}>Components / Bill of Materials</SectionLabel>
        <button className="btn-ghost" onClick={addComponent} style={{ fontSize:10 }}>+ Add Component</button>
      </div>

      <div style={{ maxHeight:320, overflowY:'auto', marginBottom:20 }}>
        <LineItemRows
          rows={form.components}
          onChange={updateComponent}
          onRemove={removeComponent}
          valueField="productId"
          selectLabel="INVENTORY PART"
          placeholder="— Select part —"
          labelsOnFirstRowOnly={false}
          options={products.map(p => ({ value:p.id, label:`${p.name} (${p.sku})` }))}
          emptyMessage="No components yet. Add inventory items or custom parts."
        />
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <button className="btn-primary" style={{ flex:1 }} onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : mode === 'add' ? 'Create Machine' : 'Save Changes'}
        </button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}
