import { useApp } from '../AppContext'
import { SectionLabel, StatusBadge, Pill } from '../components/common'
import { STATUS_META } from '../lib/stock'
import { barTubeRow } from '../lib/materials'

function TableHead({ headers, background, padding = '9px 14px' }) {
  const { t } = useApp()
  return (
    <thead>
      <tr style={{ background, borderBottom:`1px solid ${t.border}` }}>
        {headers.map(h => (
          <th key={h} style={{ padding, textAlign:'left', fontSize:10, color:t.textDim, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:500 }}>{h}</th>
        ))}
      </tr>
    </thead>
  )
}

function CardHeading({ icon, title, children }) {
  const { t } = useApp()
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
      <span style={{ fontSize:18 }}>{icon}</span>
      <span style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text }}>{title}</span>
      {children}
    </div>
  )
}

function SteelPlateCard({ rule, plateOrder, onGenerateEmail, onEditRule, onEditQuantities }) {
  const { t } = useApp()
  const { triggered, parts, supplier } = rule
  const config = rule.rule

  return (
    <div style={{ background:t.cardBg, border:`2px solid ${triggered ? 'rgba(255,59,59,0.5)' : 'rgba(255,149,0,0.3)'}`, padding:'24px 28px', marginBottom:24 }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, gap:16 }}>
        <div>
          <CardHeading icon="🪨" title={config.label || 'Steel Plate — Grouped Reorder Rule'}>
            {triggered
              ? <Pill color="#FF3B3B" border="rgba(255,59,59,0.4)" style={{ fontSize:10, background:'rgba(255,59,59,0.15)', padding:'2px 8px', letterSpacing:'0.08em' }}>⚠ TRIGGERED</Pill>
              : <Pill color="#30D158" border="rgba(48,209,88,0.35)" style={{ fontSize:10, background:'rgba(48,209,88,0.1)', padding:'2px 8px', letterSpacing:'0.08em' }}>✓ OK</Pill>}
          </CardHeading>
          <div style={{ fontSize:11, color:t.textDim, letterSpacing:'0.05em' }}>
            Triggers when any <strong style={{ color:t.textMid }}>{config.skuPrefix}-prefix</strong> part drops to ≤ {config.machinesWorth} machines' worth of stock.
            All steel plate sizes are ordered together in fixed quantities.
          </div>
          {supplier ? (
            <div style={{ marginTop:6, fontSize:11, color:'#30D158' }}>
              🏢 Supplier: <strong>{supplier.name}</strong>
              {supplier.email && <span style={{ color:t.textDim }}> — {supplier.email}</span>}
            </div>
          ) : (
            <div style={{ marginTop:6, fontSize:11, color:'#FF9500' }}>
              ⚠ No supplier chosen for this rule — pick one with Edit Rule.
            </div>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
          <button
            onClick={onGenerateEmail}
            disabled={!supplier}
            style={{
              background: triggered ? '#FF3B3B' : 'rgba(255,149,0,0.15)',
              color: triggered ? '#fff' : '#FF9500',
              border:`1px solid ${triggered ? '#FF3B3B' : 'rgba(255,149,0,0.4)'}`,
              padding:'9px 18px', fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:600,
              cursor: supplier ? 'pointer' : 'not-allowed', letterSpacing:'0.08em',
              textTransform:'uppercase', opacity: supplier ? 1 : 0.5, whiteSpace:'nowrap',
            }}
          >
            ✉ Generate Order Email
          </button>
          <button className="btn-ghost" style={{ fontSize:10, whiteSpace:'nowrap' }} onClick={onEditRule}>✎ Edit Rule</button>
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <SectionLabel style={{ marginBottom:0 }}>Fixed Order Quantities</SectionLabel>
          <button className="btn-ghost" style={{ fontSize:10 }} onClick={onEditQuantities}>✎ Edit Quantities</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:8 }}>
          {plateOrder.map(item => (
            <div key={item.id} style={{ background:t.inputBg, border:`1px solid ${t.border}`, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:t.text }}>{item.description}</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#FF9500', fontFamily:"'Syne',sans-serif", marginLeft:12, flexShrink:0 }}>{item.qty}×</span>
            </div>
          ))}
          {plateOrder.length === 0 && (
            <div style={{ gridColumn:'1/-1', padding:'14px', textAlign:'center', border:`1px dashed ${t.border}`, color:t.textFaint, fontSize:11 }}>
              No plate sizes set — add them with Edit Quantities.
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionLabel>
          {config.skuPrefix} Parts Monitoring
          {parts.length === 0 && <span style={{ color:'#FF9500', marginLeft:8 }}>— no {config.skuPrefix}-prefix products found in inventory</span>}
        </SectionLabel>
        {parts.length > 0 && (
          <div style={{ border:`1px solid ${t.border}`, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <TableHead
                background={t.cardBg}
                headers={['SKU','Part Name','On Hand','Qty / Machine Set',`${config.machinesWorth}-Machine Threshold`,'Status']}
              />
              <tbody>
                {parts.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom:`1px solid ${t.border}`, background: p.triggered ? 'rgba(255,59,59,0.05)' : i % 2 === 0 ? 'transparent' : t.rowAlt }}>
                    <td style={{ padding:'10px 14px', color:t.textMid, fontWeight:500 }}>{p.sku}</td>
                    <td style={{ padding:'10px 14px', color:t.text }}>{p.name}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ color: p.triggered ? '#FF3B3B' : STATUS_META[p.status].color, fontWeight:500 }}>
                        {p.stock.toLocaleString()} {p.unit}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', color:t.textDim }}>
                      {p.qtyPerMachineSet > 0 ? `${p.qtyPerMachineSet} ${p.unit}` : <span style={{ color:t.textFaint }}>not in any machine</span>}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      {p.qtyPerMachineSet > 0
                        ? <span style={{ color: p.triggered ? '#FF3B3B' : '#FF9500', fontWeight: p.triggered ? 700 : 400 }}>≤ {p.threshold.toLocaleString()} {p.unit}</span>
                        : <span style={{ color:t.textFaint }}>—</span>}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      {p.triggered
                        ? <span style={{ background:'rgba(255,59,59,0.12)', color:'#FF3B3B', padding:'3px 10px', fontSize:10, letterSpacing:'0.08em' }}>⚠ REORDER</span>
                        : <StatusBadge status={p.status} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function BarTubeCard({ categories, materials, runSize, onEdit }) {
  const { t } = useApp()

  return (
    <div style={{ background:t.cardBg, border:'2px solid rgba(43,63,224,0.35)', padding:'24px 28px', marginTop:24 }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, gap:16 }}>
        <div>
          <CardHeading icon="📐" title={`Bar & Tube Stock — Build Run (${runSize} Machines)`} />
          <div style={{ fontSize:11, color:t.textDim, letterSpacing:'0.05em' }}>
            Quantities shown are for a full run of <strong style={{ color:t.textMid }}>{runSize} machines</strong>.
          </div>
        </div>
        <button className="btn-ghost" style={{ fontSize:10, whiteSpace:'nowrap' }} onClick={onEdit}>✎ Edit Materials</button>
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
        {categories.map(cat => (
          <div key={cat.id} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:t.textDim, background:t.inputBg, border:`1px solid ${t.border}`, padding:'4px 10px', letterSpacing:'0.06em' }}>
            <span style={{ width:8, height:8, background:cat.color, borderRadius:'50%', flexShrink:0 }} />
            {cat.label}
            <span style={{ color:t.textFaint }}>— {cat.stdLength ? `${cat.stdLength} ft std` : 'round up to ft'}</span>
          </div>
        ))}
      </div>

      {categories.map(cat => {
        const items = materials.filter(m => m.categoryId === cat.id)
        if (items.length === 0) return null
        return (
          <div key={cat.id} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ width:3, height:16, background:cat.color, flexShrink:0 }} />
              <span style={{ fontSize:10, color:cat.color, letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600 }}>{cat.label}</span>
              <span style={{ fontSize:10, color:t.textFaint }}>
                {cat.stdLength ? `— ${cat.stdLength} ft standard length` : '— round to nearest foot'}
              </span>
            </div>
            <div style={{ border:`1px solid ${t.border}`, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <TableHead
                  background={t.inputBg}
                  padding="7px 14px"
                  headers={['Material', `Total Needed (${runSize} machines)`, 'Order Qty', 'No. of Lengths']}
                />
                <tbody>
                  {items.map((item, i) => {
                    const row = barTubeRow(item, cat)
                    return (
                      <tr key={item.id} style={{ borderBottom:`1px solid ${t.border}`, background: i % 2 === 0 ? 'transparent' : t.rowAlt }}>
                        <td style={{ padding:'10px 14px', color:t.text }}>{row.name}</td>
                        <td style={{ padding:'10px 14px', color:t.textDim }}>{row.totalFt.toFixed(2)} ft</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ color:cat.color, fontWeight:600, fontFamily:"'Syne',sans-serif", fontSize:13 }}>{row.orderQty} ft</span>
                          {row.roundedUp && <span style={{ marginLeft:8, fontSize:9, color:t.textFaint, letterSpacing:'0.06em' }}>↑ rounded</span>}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          {row.lengths
                            ? <span style={{ fontSize:12, color:t.textMid, fontWeight:600 }}>{row.lengths} {row.lengths === 1 ? 'length' : 'lengths'} @ {cat.stdLength} ft</span>
                            : <span style={{ fontSize:11, color:t.textFaint }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      <div style={{ marginTop:16, background:'rgba(43,63,224,0.05)', border:'1px solid rgba(43,63,224,0.2)', padding:'12px 16px', fontSize:11, color:t.textDim, lineHeight:1.7 }}>
        <strong style={{ color:t.textMid }}>Rounding rule:</strong> If total needed is{' '}
        <strong style={{ color:t.text }}>less than half a standard length</strong> → round up to the nearest foot (avoids ordering a full length for a small offcut).
        If total needed is <strong style={{ color:t.text }}>half a length or more</strong> → round up to the nearest full length multiple.
        Anything with no standard length always rounds up to the nearest foot.
      </div>
    </div>
  )
}

export default function ReorderTab({
  steelPlateRule, purchasing,
  onGenerateSteelPlateEmail, onEditRule, onEditQuantities, onEditMaterials,
}) {
  const { t } = useApp()
  const supplierName = steelPlateRule.supplier?.name || 'the chosen supplier'

  return (
    <div style={{ padding:'28px 40px', maxWidth:1100, margin:'0 auto' }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:t.text, marginBottom:6 }}>Reorder Rules</div>
        <div style={{ fontSize:11, color:t.textDim, letterSpacing:'0.06em' }}>
          Automated purchasing rules. Steel plate orders are grouped and sent together to {supplierName}.
        </div>
        {!purchasing.fromDatabase && (
          <div style={{ marginTop:10, background:'rgba(255,149,0,0.08)', border:'1px solid rgba(255,149,0,0.3)', padding:'10px 14px', fontSize:11, color:'#FF9500' }}>
            ⚠ These rules are still the built-in defaults and cannot be edited yet — run migration
            002_purchasing_rules.sql in Supabase to make them editable here.
          </div>
        )}
      </div>

      <SteelPlateCard
        rule={steelPlateRule}
        plateOrder={purchasing.plateOrder}
        onGenerateEmail={onGenerateSteelPlateEmail}
        onEditRule={onEditRule}
        onEditQuantities={onEditQuantities}
      />

      <div style={{ background:`rgba(${t.accentRgb},0.05)`, border:`1px solid rgba(${t.accentRgb},0.2)`, padding:'14px 18px', fontSize:11, color:t.textDim, lineHeight:1.7 }}>
        <strong style={{ color:t.textMid }}>How this rule works:</strong> Every product with an SKU starting with <strong style={{ color:t.text }}>{purchasing.rule.skuPrefix}</strong> is checked against the machines it's used in.
        If the on-hand quantity for any {purchasing.rule.skuPrefix} part falls to or below <strong style={{ color:'#FF9500' }}>{purchasing.rule.machinesWorth} × (qty needed per machine set)</strong>,
        the rule triggers and a steel plate order email is generated for <strong style={{ color:'#30D158' }}>{supplierName}</strong> covering all plate sizes in the fixed quantities above.
      </div>

      <BarTubeCard
        categories={purchasing.categories}
        materials={purchasing.materials}
        runSize={purchasing.runSize}
        onEdit={onEditMaterials}
      />
    </div>
  )
}
