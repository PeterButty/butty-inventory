import { useApp } from '../AppContext'
import { EmptyState } from '../components/common'
import { calcMachineBuilds, buildStatusColor, componentColor, buildBarScale } from '../lib/builds'

// The component breakdown is shown in the machine list and again in the
// machine detail pop-up, so it lives here and is exported for both.
export function ComponentCard({ detail, isBottleneck, barScale }) {
  const { t } = useApp()
  const color = componentColor(detail.canBuild, isBottleneck)
  const barPct = barScale > 0 ? Math.round((detail.canBuild / barScale) * 100) : 0

  return (
    <div style={{ background:t.inputBg, border:`1px solid ${isBottleneck ? 'rgba(255,149,0,0.4)' : t.border}`, padding:'12px 14px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <div style={{ fontSize:11, color:t.text, fontWeight:500 }}>
          {detail.prod?.name || <span style={{ color:'#FF3B3B' }}>Part not found</span>}
        </div>
        {isBottleneck && <span className="bottleneck-badge">⚠ BOTTLENECK</span>}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:t.textDim, marginBottom:6 }}>
        <span>Needs: <b style={{ color:t.textMid }}>{detail.qty} {detail.prod?.unit || 'pcs'}</b></span>
        <span>Stock: <b style={{ color }}>{detail.stock.toLocaleString()}</b></span>
        <span>→ <b style={{ color }}>{detail.canBuild} builds</b></span>
      </div>
      {detail.note && <div style={{ fontSize:9, color:t.textFaint, marginBottom:6, fontStyle:'italic' }}>{detail.note}</div>}
      <div className="build-bar">
        <div className="build-bar-inner" style={{ width:`${barPct}%`, background:color }} />
      </div>
    </div>
  )
}

function SummaryCard({ machine, onView }) {
  const { t, products } = useApp()
  const { max, bottlenecks } = calcMachineBuilds(machine, products)
  const color = buildStatusColor(max)
  const idleBorder = max === 0 ? 'rgba(255,59,59,0.4)' : max < 3 ? 'rgba(255,149,0,0.3)' : t.border

  return (
    <div
      style={{ background:t.cardBg, border:`1px solid ${idleBorder}`, padding:'20px 24px', cursor:'pointer', transition:'all 0.2s', overflow:'hidden', position:'relative' }}
      onClick={() => onView(machine)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = idleBorder }}
    >
      {machine.imageUrl && (
        <div style={{ position:'absolute', inset:0, backgroundImage:`url(${machine.imageUrl})`, backgroundSize:'cover', backgroundPosition:'center', opacity:0.12 }} />
      )}
      <div style={{ position:'relative' }}>
        <div style={{ fontSize:10, color:t.textDim, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8, textDecoration:'underline', textUnderlineOffset:3 }}>{machine.name}</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:6 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:40, fontWeight:700, color, lineHeight:1 }}>{max}</div>
          <div style={{ fontSize:11, color:t.textDim }}>buildable</div>
        </div>
        {bottlenecks.length > 0 && (
          <div style={{ fontSize:10, color:'#FF9500', display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
            <span>⚠</span> Bottleneck: {bottlenecks.map(b => b.prod?.name || 'Unknown').join(', ')}
          </div>
        )}
        <div style={{ fontSize:9, color:t.textFaint, marginTop:8, letterSpacing:'0.06em' }}>
          {machine.components.length} components · click to view
        </div>
      </div>
    </div>
  )
}

function MachineCard({ machine, onView, onEdit, onDelete, onCommit }) {
  const { t, products } = useApp()
  const { max, bottlenecks, componentDetails, required } = calcMachineBuilds(machine, products)
  const barScale = buildBarScale(required)
  const statusColor = buildStatusColor(max)
  const viaAssembly = componentDetails.length - required.length

  return (
    <div className="machine-card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <div
            style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text, marginBottom:4, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}
            onClick={() => onView(machine)}
          >
            {machine.name}
          </div>
          {machine.description && <div style={{ fontSize:11, color:t.textDim }}>{machine.description}</div>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ textAlign:'right', marginRight:8 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:700, color:statusColor, lineHeight:1 }}>{max}</div>
            <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.08em' }}>MAX BUILDS</div>
          </div>
          <button
            className="btn-success"
            onClick={() => onCommit(machine, max)}
            disabled={max === 0}
            style={{ opacity:max === 0 ? 0.4 : 1, cursor:max === 0 ? 'not-allowed' : 'pointer' }}
          >
            ✓ Commit Build
          </button>
          <button className="btn-ghost" onClick={() => onEdit(machine)}>Edit BOM</button>
          <button className="btn-danger" onClick={() => onDelete(machine.id)}>✕</button>
        </div>
      </div>

      {viaAssembly > 0 && (
        <div style={{ fontSize:10, color:t.textFaint, letterSpacing:'0.04em', marginBottom:10 }}>
          Showing the {required.length} items this machine needs on the bench.
          Another {viaAssembly} on the parts list are components of the weldments above,
          so they are accounted for when those are built rather than counted again here.
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:10 }}>
        {required.map((c, idx) => (
          <ComponentCard
            key={idx}
            detail={c}
            isBottleneck={bottlenecks.some(b => b.productId === c.productId)}
            barScale={barScale}
          />
        ))}
      </div>
    </div>
  )
}

export default function MachinesTab({ onView, onEdit, onDelete, onCommit }) {
  const { machines } = useApp()

  return (
    <div style={{ padding:'28px 40px', maxWidth:1400, margin:'0 auto' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
        {machines.map(m => <SummaryCard key={m.id} machine={m} onView={onView} />)}
        {machines.length === 0 && (
          <div style={{ gridColumn:'1/-1' }}>
            <EmptyState padding="48px">
              No machines defined yet. Click "+ Add Machine" to create your first Bill of Materials.
            </EmptyState>
          </div>
        )}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {machines.map(m => (
          <MachineCard key={m.id} machine={m} onView={onView} onEdit={onEdit} onDelete={onDelete} onCommit={onCommit} />
        ))}
      </div>
    </div>
  )
}
