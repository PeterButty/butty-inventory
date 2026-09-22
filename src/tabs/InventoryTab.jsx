import { useMemo } from 'react'
import { useApp } from '../AppContext'
import { ImageThumb, StatusBadge, PartTypePill, Pill } from '../components/common'
import { getStockStatus, needsReorder, lowStockProducts, sortRows, stockBarPercent, STATUS_META, STATUS_ORDER } from '../lib/stock'
import { wipFor, stageLabel } from '../lib/production'

const COLUMNS = [
  { label:'Photo',        field:null },
  { label:'SKU',          field:'sku' },
  { label:'Product Name', field:'name' },
  { label:'Category',     field:'category' },
  { label:'Location',     field:'location' },
  { label:'Stock',        field:'stock' },
  { label:'Min Level',    field:'minStock' },
  { label:'Status',       field:null },
  { label:'Actions',      field:null },
]

// Colours carry their rgb alongside, rather than the card matching on hex
// strings to work out its own tint.
const STAT_CARDS = [
  { label:'Total SKUs',   key:'total', color:'#FFE033', rgb:'255,224,51', filter:'All' },
  { label:'In Stock',     key:'ok',    color:'#30D158', rgb:'48,209,88',  filter:'ok'  },
  { label:'Low Stock',    key:'low',   color:'#FF9500', rgb:'255,149,0',  filter:'low' },
  { label:'Out of Stock', key:'out',   color:'#FF3B3B', rgb:'255,59,59',  filter:'out' },
]

function StatCards({ stats, filterStatus, setFilterStatus }) {
  const { t } = useApp()
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
      {STAT_CARDS.map(s => {
        const isActive = filterStatus === s.filter
        return (
          <div
            key={s.label}
            className="stat-card"
            onClick={() => setFilterStatus(isActive ? 'All' : s.filter)}
            style={{ background:isActive ? `rgba(${s.rgb},0.08)` : t.cardBg, border:`1px solid ${isActive ? s.color : t.border}` }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = s.color }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = t.border }}
          >
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:10, color:isActive ? s.color : t.textDim, letterSpacing:'0.12em', textTransform:'uppercase' }}>{s.label}</div>
              {isActive && <div style={{ fontSize:9, color:s.color, border:`1px solid ${s.color}`, padding:'2px 6px' }}>ACTIVE</div>}
            </div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:36, fontWeight:700, color:s.color, lineHeight:1 }}>{stats[s.key]}</div>
            <div style={{ fontSize:9, color:isActive ? s.color : t.textFaint, letterSpacing:'0.08em', marginTop:8 }}>
              {isActive ? 'click to clear ✕' : 'click to filter →'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PhotoCell({ product, onLightbox, onFile }) {
  const { t } = useApp()

  if (product.imageUrl) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
        <button onClick={() => onLightbox(product)} style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
          <ImageThumb src={product.imageUrl} size={44} />
        </button>
        <label style={{ fontSize:9, color:t.textDim, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>
          replace
          <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { onFile(product.id, e.target.files[0]); e.target.value = '' }} />
        </label>
      </div>
    )
  }

  return (
    <label
      style={{ background:t.cardBg, border:`1px dashed ${t.borderStrong}`, width:44, height:44, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:2 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderStrong }}
    >
      <span style={{ fontSize:16 }}>📷</span>
      <span style={{ fontSize:8, color:t.textDim, fontFamily:'inherit' }}>ADD</span>
      <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { onFile(product.id, e.target.files[0]); e.target.value = '' }} />
    </label>
  )
}

// Pieces part-made and waiting at a process. Shown next to stock so the
// difference between "finished" and "still on the floor" is visible without
// leaving this screen.
function WipNote({ product }) {
  const { t, production } = useApp()
  const waiting = wipFor(production, product.id)
  const stages = Object.entries(waiting).filter(([, qty]) => qty > 0)
  if (stages.length === 0) return null

  const total = stages.reduce((sum, [, qty]) => sum + qty, 0)
  const where = stages.map(([stageId, qty]) => `${qty} at ${stageLabel(production, stageId)}`).join(' · ')

  return (
    <span title={where} style={{ fontSize:9, color:'#FF9500', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>
      ⚙ {total} in process
    </span>
  )
}

function NameCell({ product }) {
  const { t, machines, supplierForProduct } = useApp()
  const supplier = supplierForProduct(product.id)
  const usedIn = machines.filter(m => m.components.some(c => c.productId === product.id))

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
        <span>{product.name}</span>
        <PartTypePill partType={product.partType} />
      </div>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4 }}>
        {supplier && (
          <Pill color="#30D158" border="rgba(48,209,88,0.35)" style={{ opacity:0.9 }}>🏢 {supplier.name}</Pill>
        )}
        {usedIn.map(m => {
          const comp = m.components.find(c => c.productId === product.id)
          return <Pill key={m.id} color={t.accent} style={{ opacity:0.8 }}>{m.name} ×{comp.qty}</Pill>
        })}
      </div>
    </>
  )
}

export default function InventoryTab({
  search, setSearch,
  category, setCategory,
  filterStatus, setFilterStatus,
  sortBy, sortDir, onToggleSort,
  onLightbox, onRowImageFile,
  onAdjust, onEdit, onDelete, onBuildAssembly,
}) {
  const { t, products } = useApp()

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))],
    [products]
  )

  const stats = useMemo(() => ({
    total: products.length,
    out:   products.filter(p => getStockStatus(p.stock, p.minStock) === 'out').length,
    low:   products.filter(p => getStockStatus(p.stock, p.minStock) === 'low').length,
    ok:    products.filter(p => getStockStatus(p.stock, p.minStock) === 'ok').length,
  }), [products])

  const alerts = useMemo(() => lowStockProducts(products), [products])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const matching = products.filter(p => {
      const matchSearch = p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
      const matchCat    = category === 'All' || p.category === category
      const matchStatus = filterStatus === 'All' || getStockStatus(p.stock, p.minStock) === filterStatus
      return matchSearch && matchCat && matchStatus
    })
    return sortRows(matching, sortBy, sortDir)
  }, [products, search, category, filterStatus, sortBy, sortDir])

  return (
    <div style={{ padding:'28px 40px', maxWidth:1400, margin:'0 auto' }}>

      <StatCards stats={stats} filterStatus={filterStatus} setFilterStatus={setFilterStatus} />

      {alerts.length > 0 && (
        <div style={{ background:'rgba(255,59,59,0.08)', border:'1px solid rgba(255,59,59,0.2)', padding:'10px 18px', display:'flex', alignItems:'center', gap:12, fontSize:11, letterSpacing:'0.06em', marginBottom:22 }}>
          <span style={{ color:'#FF3B3B', fontSize:14 }}>⚠</span>
          <span style={{ color:'#FF9090' }}>{alerts.length} product{alerts.length > 1 ? 's' : ''} need attention:</span>
          <span style={{ color:t.textDim }}>{alerts.map(a => a.name).join(' · ')}</span>
        </div>
      )}

      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <input className="field-input" style={{ width:240 }} placeholder="Search SKU or name..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {categories.map(c => (
            <span key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</span>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          {['All', ...STATUS_ORDER].map(s => (
            <span key={s} className={`chip ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s === 'All' ? 'All Status' : STATUS_META[s].label}
            </span>
          ))}
        </div>
      </div>

      {filterStatus !== 'All' && (
        <div style={{ marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:11, color:STATUS_META[filterStatus]?.color || t.text, letterSpacing:'0.08em' }}>
            Showing: {STATUS_META[filterStatus]?.label || filterStatus} ({filtered.length} products)
          </div>
          <button onClick={() => setFilterStatus('All')} style={{ background:'none', border:`1px solid ${t.borderStrong}`, color:t.textDim, fontSize:10, padding:'2px 8px', cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.06em' }}>
            clear ✕
          </button>
        </div>
      )}

      <div style={{ border:`1px solid ${t.border}`, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${t.border}`, background:t.cardBg }}>
              {COLUMNS.map(col => (
                <th key={col.label} style={{ padding:'12px 16px', textAlign:'left', color:t.textDim, letterSpacing:'0.1em', textTransform:'uppercase', fontSize:10, fontWeight:500, whiteSpace:'nowrap' }}>
                  {col.field ? (
                    <button className="sort-btn" style={{ color:sortBy === col.field ? t.text : t.textDim }} onClick={() => onToggleSort(col.field)}>
                      {col.label} {sortBy === col.field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={COLUMNS.length} style={{ padding:'40px', textAlign:'center', color:t.textFaint }}>No products found.</td></tr>
            )}
            {filtered.map((p, i) => {
              const status = getStockStatus(p.stock, p.minStock)
              const sm = STATUS_META[status]
              return (
                <tr key={p.id} className="row-hover" style={{ borderBottom:`1px solid ${t.border}`, background:i % 2 === 0 ? 'transparent' : t.rowAlt }}>
                  <td style={{ padding:'10px 16px' }}>
                    <PhotoCell product={p} onLightbox={onLightbox} onFile={onRowImageFile} />
                  </td>
                  <td style={{ padding:'10px 16px', color:t.textMid, fontWeight:500 }}>{p.sku}</td>
                  <td style={{ padding:'10px 16px', color:t.text }}><NameCell product={p} /></td>
                  <td style={{ padding:'10px 16px', color:t.textDim }}>{p.category}</td>
                  <td style={{ padding:'10px 16px', color:t.textDim }}>{p.location}</td>
                  <td style={{ padding:'10px 16px' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <span style={{ color:sm.color, fontWeight:500 }}>{p.stock.toLocaleString()} {p.unit}</span>
                      <div style={{ height:3, background:t.borderStrong, width:80, borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${stockBarPercent(p.stock, p.minStock)}%`, background:sm.color, borderRadius:2 }} />
                      </div>
                      <WipNote product={p} />
                    </div>
                  </td>
                  <td style={{ padding:'10px 16px', color:t.textDim }}>{p.minStock.toLocaleString()} {p.unit}</td>
                  <td style={{ padding:'10px 16px' }}><StatusBadge status={status} /></td>
                  <td style={{ padding:'10px 16px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      {p.partType === 'subassembly' && (
                        <button className="btn-ghost" style={{ color:'#64D2FF', borderColor:'rgba(100,210,255,0.4)' }} onClick={() => onBuildAssembly(p)}>Build</button>
                      )}
                      <button className="btn-ghost" onClick={() => onAdjust(p)}>Adjust</button>
                      <button className="btn-ghost" onClick={() => onEdit(p)}>Edit</button>
                      <button className="btn-danger" onClick={() => onDelete(p.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop:12, fontSize:10, color:t.textFaint, letterSpacing:'0.08em' }}>
        SHOWING {filtered.length} OF {products.length} PRODUCTS
      </div>
    </div>
  )
}
