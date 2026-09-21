import { useApp } from '../AppContext'
import { EmptyState } from './common'

// The "pick something, say how many, add a note, delete the row" editor.
// This existed three times over: machine usage on a part, the components of a
// subassembly, and the parts list of a machine. One version now, with the
// dropdown's contents supplied by the caller.

function ColumnLabel({ show, children }) {
  const { t } = useApp()
  if (!show) return null
  return (
    <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.08em', marginBottom:4 }}>{children}</div>
  )
}

export default function LineItemRows({
  rows,
  onChange,                       // (index, field, value) => void
  onRemove,                       // (index) => void
  options,                        // [{ value, label }]
  valueField,                     // which field on a row holds the chosen option
  selectLabel = 'PART',
  qtyLabel = 'QTY EACH',
  placeholder = '— Select —',
  notePlaceholder = 'Optional note...',
  emptyMessage,
  labelsOnFirstRowOnly = true,
}) {
  if (rows.length === 0 && emptyMessage) {
    return <EmptyState>{emptyMessage}</EmptyState>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {rows.map((row, idx) => {
        const showLabels = labelsOnFirstRowOnly ? idx === 0 : true
        return (
          <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 80px 1fr auto', gap:8, alignItems:'end' }}>
            <div>
              <ColumnLabel show={showLabels}>{selectLabel}</ColumnLabel>
              <select
                className="field-input"
                value={row[valueField] || ''}
                onChange={e => onChange(idx, valueField, e.target.value)}
              >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <ColumnLabel show={showLabels}>{qtyLabel}</ColumnLabel>
              <input
                className="field-input" type="number" min="1" value={row.qty}
                onChange={e => onChange(idx, 'qty', parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <ColumnLabel show={showLabels}>NOTE</ColumnLabel>
              <input
                className="field-input" value={row.note || ''} placeholder={notePlaceholder}
                onChange={e => onChange(idx, 'note', e.target.value)}
              />
            </div>
            <button className="btn-danger" style={showLabels ? { marginTop:18 } : {}} onClick={() => onRemove(idx)}>✕</button>
          </div>
        )
      })}
    </div>
  )
}
