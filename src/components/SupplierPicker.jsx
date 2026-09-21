import { useApp } from '../AppContext'
import { EmptyState } from './common'

// The supplier radio list. This block existed twice, near-identically: once
// for purchased parts and once for the raw material supplier on made-in-house
// parts. The only difference was the "currently assigned" marker, which is now
// an option rather than a second copy of the component.

function Radio({ selected }) {
  const { t } = useApp()
  return (
    <div style={{ width:14, height:14, border:`2px solid ${selected ? t.accent : t.borderStrong}`, borderRadius:'50%', background:selected ? t.accent : 'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
      {selected && <div style={{ width:5, height:5, borderRadius:'50%', background:'#fff' }} />}
    </div>
  )
}

export default function SupplierPicker({ value, onChange, showAssignedTo = null, emptyMessage = 'No suppliers yet — add them in the Suppliers tab first.' }) {
  const { t, suppliers } = useApp()

  if (suppliers.length === 0) {
    return <EmptyState padding="12px">{emptyMessage}</EmptyState>
  }

  const noneSelected = value === null || value === undefined

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <button
        onClick={() => onChange(null)}
        style={{
          padding:'7px 12px', fontFamily:"'DM Mono',monospace", fontSize:10, textAlign:'left',
          border:`1px solid ${noneSelected ? t.accent : t.border}`,
          background: noneSelected ? `rgba(${t.accentRgb},0.12)` : t.inputBg,
          color: noneSelected ? t.text : t.textDim, cursor:'pointer',
        }}
      >
        — None
      </button>

      {suppliers.map(sup => {
        const selected = value === sup.id
        // Whether this supplier is already recorded as supplying the part
        // being edited — shown only when it differs from the current choice.
        const alreadySupplies = showAssignedTo != null && sup.products?.includes(showAssignedTo)
        return (
          <div
            key={sup.id}
            onClick={() => onChange(selected ? null : sup.id)}
            style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'10px 14px', cursor:'pointer', transition:'all 0.15s',
              border:`1px solid ${selected ? t.accent : t.border}`,
              background: selected ? `rgba(${t.accentRgb},0.1)` : t.inputBg,
            }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Radio selected={selected} />
              <div>
                <div style={{ fontSize:11, color:t.text, fontWeight:selected ? 500 : 400 }}>{sup.name}</div>
                <div style={{ fontSize:10, color:t.textDim }}>{sup.contact} · {sup.email}</div>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              {sup.notes && <div style={{ fontSize:9, color:t.textFaint }}>{sup.notes}</div>}
              {alreadySupplies && !selected && <div style={{ fontSize:9, color:'#30D158', marginTop:2 }}>● currently assigned</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
