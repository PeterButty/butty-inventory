import { useApp } from '../AppContext'
import { Modal, ModalTitle, SectionLabel, EmptyState } from '../components/common'
import { calcMachineBuilds } from '../lib/builds'

function TableHead({ headers, padding = '6px 8px' }) {
  const { t } = useApp()
  return (
    <thead>
      <tr style={{ borderBottom:`1px solid ${t.border}` }}>
        {headers.map(h => (
          <th key={h} style={{ padding, textAlign:'left', fontSize:9, color:t.textDim, letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:500 }}>{h}</th>
        ))}
      </tr>
    </thead>
  )
}

// ── Commit a machine build ───────────────────────────────────────────────────
export function CommitBuildModal({ machine, qty, setQty, onConfirm, onClose }) {
  const { t, products, saving } = useApp()
  if (!machine) return null

  // Worked out once, rather than recomputed for the heading and again for the list.
  const { max, componentDetails } = calcMachineBuilds(machine, products)

  return (
    <Modal onClose={onClose} width={400}>
      <ModalTitle sub={<>{machine.name} · Max possible: <span style={{ color:'#30D158', fontWeight:600 }}>{max}</span></>}>
        Commit Build
      </ModalTitle>

      <SectionLabel style={{ marginBottom:8 }}>Quantity to Build</SectionLabel>
      <input
        className="field-input" type="number" min={1} max={max} value={qty}
        onChange={e => setQty(Math.max(1, Math.min(max, parseInt(e.target.value) || 1)))}
        style={{ marginBottom:6 }}
      />
      <div style={{ fontSize:10, color:t.textDim, marginBottom:20 }}>This will deduct all required components from stock.</div>

      <div style={{ background:t.inputBg, border:`1px solid ${t.border}`, padding:'12px 14px', marginBottom:20, fontSize:11 }}>
        {componentDetails.map((c, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', color:t.textMid, marginBottom:4 }}>
            <span>{c.prod?.name}</span>
            <span style={{ color:'#FF9500' }}>−{c.qty * qty} {c.prod?.unit || 'pcs'}</span>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <button className="btn-success" style={{ flex:1, padding:'11px' }} onClick={() => onConfirm(machine, qty)} disabled={saving}>
          {saving ? 'Committing…' : `✓ Confirm Build ×${qty}`}
        </button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}

// ── Build a subassembly ──────────────────────────────────────────────────────
export function BuildAssemblyModal({ product, qty, setQty, onConfirm, onClose }) {
  const { t, products, saving } = useApp()
  if (!product) return null

  const bom = product.bomComponents || []
  const wanted = parseInt(qty) || 0

  const rows = bom.map(bc => {
    const compProd = products.find(p => p.id === bc.productId)
    const need = bc.qty * wanted
    return {
      ...bc,
      compProd,
      need,
      canBuild: compProd ? Math.floor(compProd.stock / bc.qty) : 0,
      enough: compProd ? compProd.stock >= need : false,
    }
  })

  const maxBuildable = bom.length === 0 ? 0 : Math.min(...rows.map(r => r.canBuild))
  const canSubmit = wanted > 0 && rows.every(r => r.enough)

  return (
    <Modal onClose={onClose} width={560}>
      <ModalTitle sub={`SKU: ${product.sku} · Current stock: ${product.stock} ${product.unit}`}>
        Build: {product.name}
      </ModalTitle>

      {bom.length === 0 ? (
        <div style={{ marginBottom:20 }}>
          <EmptyState padding="20px">No BOM defined for this subassembly. Edit the part to add components.</EmptyState>
        </div>
      ) : (
        <>
          <div style={{ marginBottom:16 }}>
            <SectionLabel>Components Required</SectionLabel>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <TableHead headers={['Part','Per Unit','Need','In Stock','Status']} />
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom:`1px solid ${t.border}`, background:!row.enough && wanted > 0 ? 'rgba(255,59,59,0.04)' : 'transparent' }}>
                    <td style={{ padding:'8px', color:t.text }}>
                      {row.compProd?.name || <span style={{ color:'#FF3B3B' }}>Unknown</span>}
                    </td>
                    <td style={{ padding:'8px', color:t.textMid }}>×{row.qty}</td>
                    <td style={{ padding:'8px', color:wanted > 0 ? (row.enough ? '#30D158' : '#FF3B3B') : t.textDim, fontWeight:500 }}>
                      {wanted > 0 ? row.need : '—'}
                    </td>
                    <td style={{ padding:'8px', color:t.textMid }}>{row.compProd?.stock ?? '?'} {row.compProd?.unit || ''}</td>
                    <td style={{ padding:'8px' }}>
                      {wanted > 0
                        ? (row.enough
                            ? <span style={{ color:'#30D158', fontSize:9 }}>✓ OK</span>
                            : <span style={{ color:'#FF3B3B', fontSize:9 }}>✗ SHORT {row.need - (row.compProd?.stock ?? 0)}</span>)
                        : <span style={{ color:t.textFaint, fontSize:9 }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background:'rgba(100,210,255,0.06)', border:'1px solid rgba(100,210,255,0.2)', padding:'10px 14px', marginBottom:20, fontSize:10, color:'#64D2FF' }}>
            Max buildable with current stock: <strong>{maxBuildable}</strong>
          </div>

          <div style={{ marginBottom:20 }}>
            <SectionLabel style={{ marginBottom:8 }}>Units to Build</SectionLabel>
            <input
              className="field-input" type="number" min="1" max={maxBuildable} value={qty}
              onChange={e => setQty(e.target.value)} style={{ width:120 }}
            />
          </div>
        </>
      )}

      <div style={{ display:'flex', gap:10 }}>
        <button
          className="btn-primary"
          style={{ flex:1, opacity:canSubmit ? 1 : 0.4, cursor:canSubmit ? 'pointer' : 'not-allowed' }}
          onClick={canSubmit ? onConfirm : undefined}
          disabled={saving || !canSubmit}
        >
          {saving ? 'Building…' : `✓ Build ${wanted > 0 ? wanted : ''} Unit${wanted !== 1 ? 's' : ''}`}
        </button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  )
}

// ── Photo lightbox ───────────────────────────────────────────────────────────
export function Lightbox({ product, onClose }) {
  if (!product) return null
  return (
    <div className="lightbox" onClick={onClose}>
      <div style={{ marginBottom:16, fontSize:11, color:'#666', letterSpacing:'0.1em' }}>
        {product.sku} · {product.name} — click to close
      </div>
      <img
        src={product.imageUrl} alt={product.name}
        style={{ maxWidth:'85vw', maxHeight:'78vh', objectFit:'contain', border:'1px solid #2A2A35' }}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}
