import { useApp } from '../AppContext'
import { Modal, StockStatusBadge, Pill } from '../components/common'
import { calcMachineBuilds, buildStatusColor, componentColor, buildBarScale } from '../lib/builds'

function BuildSummary({ max, bottlenecks }) {
  if (max === 0) {
    return (
      <div style={{ fontSize:11, color:'#FF3B3B', display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:16 }}>⛔</span> Cannot build — stock too low
      </div>
    )
  }
  if (bottlenecks.length > 0) {
    return (
      <div style={{ fontSize:11, color:'#FF9500', display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:14 }}>⚠</span>
        <div>
          <div style={{ marginBottom:2 }}>Bottleneck{bottlenecks.length > 1 ? 's' : ''}:</div>
          {bottlenecks.map(b => (
            <div key={b.productId} style={{ color:'#FF9500', fontWeight:500 }}>{b.prod?.name}</div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div style={{ fontSize:11, color:'#30D158', display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:14 }}>✓</span> All parts in stock
    </div>
  )
}

function SubassemblyContents({ product }) {
  const { t, products } = useApp()
  const bom = product?.bomComponents || []
  if (product?.partType !== 'subassembly' || bom.length === 0) return null

  return (
    <div style={{ marginTop:6, paddingLeft:8, borderLeft:'2px solid rgba(100,210,255,0.3)' }}>
      <div style={{ fontSize:9, color:'#64D2FF', letterSpacing:'0.08em', marginBottom:3 }}>CONTAINS:</div>
      {bom.map((bc, bi) => {
        const cp = products.find(p => p.id === bc.productId)
        return (
          <div key={bi} style={{ fontSize:9, color:t.textDim, display:'flex', gap:8, marginBottom:2 }}>
            <span>×{bc.qty}</span>
            <span>{cp?.name || 'Unknown'}</span>
            {cp && <span style={{ color:cp.stock > 0 ? '#30D158' : '#FF3B3B' }}>({cp.stock} in stock)</span>}
          </div>
        )
      })}
    </div>
  )
}

export default function MachineDetailModal({ machine, onClose, onEditBom, onCommit }) {
  const { t, products } = useApp()
  if (!machine) return null

  const { max, bottlenecks, componentDetails } = calcMachineBuilds(machine, products)
  const barScale = buildBarScale(componentDetails)
  const statusColor = buildStatusColor(max)

  return (
    <Modal onClose={onClose} width={680} padded={false}>

      <div style={{ background:t.headerBg, borderBottom:`1px solid ${t.border}`, padding:'28px 32px', position:'relative', overflow:'hidden' }}>
        {machine.imageUrl && (
          <div style={{ position:'absolute', inset:0, backgroundImage:`url(${machine.imageUrl})`, backgroundSize:'cover', backgroundPosition:'center', opacity:0.08 }} />
        )}
        <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ display:'flex', gap:18, alignItems:'flex-start' }}>
            {machine.imageUrl && (
              <img src={machine.imageUrl} alt={machine.name} style={{ width:72, height:72, objectFit:'cover', border:`1px solid ${t.borderStrong}`, flexShrink:0 }} />
            )}
            <div>
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>Machine / Assembly</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:t.text, marginBottom:4 }}>{machine.name}</div>
              {machine.description && <div style={{ fontSize:12, color:t.textMid }}>{machine.description}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:t.textDim, fontSize:20, cursor:'pointer', lineHeight:1, padding:'4px 8px' }}>✕</button>
        </div>

        <div style={{ display:'flex', gap:24, marginTop:24 }}>
          <div>
            <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:4 }}>Max Buildable</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:44, fontWeight:800, color:statusColor, lineHeight:1 }}>{max}</div>
          </div>
          <div style={{ width:1, background:t.border }} />
          <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:8 }}>
            <div>
              <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:2 }}>Components</div>
              <div style={{ fontSize:16, fontWeight:600, color:t.text }}>{machine.components.length} parts</div>
            </div>
          </div>
          <div style={{ width:1, background:t.border }} />
          <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:6 }}>
            <BuildSummary max={max} bottlenecks={bottlenecks} />
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center' }}>
            <button
              className="btn-success"
              style={{ padding:'10px 20px', fontSize:12, opacity:max === 0 ? 0.4 : 1, cursor:max === 0 ? 'not-allowed' : 'pointer' }}
              onClick={() => onCommit(machine, max)}
              disabled={max === 0}
            >
              ✓ Commit Build
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding:'24px 32px', maxHeight:420, overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontSize:10, color:t.textDim, letterSpacing:'0.12em', textTransform:'uppercase' }}>Bill of Materials</div>
          <button className="btn-ghost" style={{ fontSize:10 }} onClick={() => onEditBom(machine)}>✎ Edit BOM</button>
        </div>

        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${t.border}` }}>
              {['Part','SKU','Location','Stock','Qty / Build','Builds Possible','Status'].map(h => (
                <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:9, color:t.textDim, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {componentDetails.map((c, idx) => {
              const isBottleneck = bottlenecks.some(b => b.productId === c.productId)
              const color = componentColor(c.canBuild, isBottleneck)
              const barPct = barScale > 0 ? Math.round((c.canBuild / barScale) * 100) : 0
              return (
                <tr key={idx} style={{ borderBottom:`1px solid ${t.border}`, background:isBottleneck ? 'rgba(255,149,0,0.04)' : 'transparent' }}>
                  <td style={{ padding:'12px 10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {c.prod?.imageUrl && <img src={c.prod.imageUrl} alt="" style={{ width:28, height:28, objectFit:'cover', borderRadius:2 }} />}
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ color:t.text, fontWeight:500 }}>
                            {c.prod?.name || <span style={{ color:'#FF3B3B' }}>Unknown part</span>}
                          </span>
                          {c.prod?.partType === 'subassembly' && (
                            <Pill color="#64D2FF" border="rgba(100,210,255,0.4)" style={{ padding:'1px 5px' }}>🔩 ASSEMBLY</Pill>
                          )}
                        </div>
                        {c.note && <div style={{ fontSize:9, color:t.textFaint, marginTop:1 }}>{c.note}</div>}
                        <SubassemblyContents product={c.prod} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'12px 10px', color:t.textMid, fontSize:11 }}>{c.prod?.sku || '—'}</td>
                  <td style={{ padding:'12px 10px', color:t.textDim, fontSize:11 }}>{c.prod?.location || '—'}</td>
                  <td style={{ padding:'12px 10px' }}>
                    <div style={{ color, fontWeight:500 }}>{c.stock.toLocaleString()}</div>
                    <div style={{ height:3, background:t.border, width:60, borderRadius:2, marginTop:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${barPct}%`, background:color, borderRadius:2 }} />
                    </div>
                  </td>
                  <td style={{ padding:'12px 10px' }}>
                    <span style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text }}>×{c.qty}</span>
                    <span style={{ fontSize:10, color:t.textDim, marginLeft:4 }}>{c.prod?.unit || 'pcs'}</span>
                  </td>
                  <td style={{ padding:'12px 10px' }}>
                    <span style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color }}>{c.canBuild}</span>
                    {isBottleneck && <div style={{ fontSize:9, color:'#FF9500', letterSpacing:'0.06em', marginTop:2 }}>⚠ BOTTLENECK</div>}
                  </td>
                  <td style={{ padding:'12px 10px' }}>
                    <StockStatusBadge product={c.prod} small />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding:'16px 32px', borderTop:`1px solid ${t.border}`, background:t.headerBg, display:'flex', justifyContent:'flex-end', gap:10 }}>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}
