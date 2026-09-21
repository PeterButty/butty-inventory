import { useApp } from '../AppContext'
import { EmptyState, Pill } from '../components/common'
import { getStockStatus, needsReorder, lowStockProducts, STATUS_META } from '../lib/stock'

function LowStockBanner({ onGenerateAll }) {
  const { t, products } = useApp()
  const low = lowStockProducts(products)
  if (low.length === 0) return null

  return (
    <div style={{ background:'rgba(255,149,0,0.08)', border:'1px solid rgba(255,149,0,0.3)', padding:'14px 20px', marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12 }}>
        <span style={{ fontSize:18 }}>⚠</span>
        <div>
          <div style={{ color:'#FF9500', fontWeight:500, marginBottom:2 }}>
            {low.length} product{low.length > 1 ? 's' : ''} below minimum stock
          </div>
          <div style={{ fontSize:11, color:t.textDim }}>{low.map(p => p.name).join(' · ')}</div>
        </div>
      </div>
      <button onClick={onGenerateAll} style={{ background:'#FF9500', color:'#000', border:'none', padding:'9px 18px', fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:600, cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase' }}>
        ✉ Generate Reorder Emails
      </button>
    </div>
  )
}

function ContactLine({ label, value, color }) {
  const { t } = useApp()
  if (!value) return null
  return (
    <div style={{ display:'flex', gap:8 }}>
      <span style={{ color:t.textFaint, width:48 }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  )
}

function SupplierCard({ supplier, onEmail, onEdit, onDelete }) {
  const { t, products } = useApp()
  const supplied = products.filter(p => supplier.products?.includes(p.id))
  const lowItems = supplied.filter(needsReorder)

  return (
    <div style={{ background:t.cardBg, border:`1px solid ${lowItems.length > 0 ? 'rgba(255,149,0,0.4)' : t.border}`, padding:'22px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, color:t.text, marginBottom:3 }}>{supplier.name}</div>
          <div style={{ fontSize:11, color:t.textDim }}>{supplier.contact}</div>
        </div>
        {lowItems.length > 0 && (
          <Pill color="#FF9500" border="rgba(255,149,0,0.4)" style={{ fontSize:10, background:'rgba(255,149,0,0.15)', padding:'3px 8px' }}>
            {lowItems.length} LOW
          </Pill>
        )}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:16, fontSize:11 }}>
        <ContactLine label="Email" value={supplier.email} color={t.accent} />
        <ContactLine label="Phone" value={supplier.phone} color={t.textMid} />
        <ContactLine label="Notes" value={supplier.notes} color={t.textDim} />
      </div>

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:9, color:t.textFaint, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>Supplied Parts</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {supplied.length === 0 && <div style={{ fontSize:11, color:t.textFaint }}>No products assigned</div>}
          {supplied.map(p => {
            const status = getStockStatus(p.stock, p.minStock)
            const low = needsReorder(p)
            return (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:t.inputBg, border:`1px solid ${low ? 'rgba(255,149,0,0.2)' : t.border}` }}>
                <div>
                  <span style={{ fontSize:11, color:t.text }}>{p.name}</span>
                  <span style={{ fontSize:10, color:t.textDim, marginLeft:8 }}>{p.sku}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:10, color:STATUS_META[status].color }}>{p.stock.toLocaleString()} {p.unit}</span>
                  {p.reorderQty > 0 && low && (
                    <Pill color="#FF9500" border="rgba(255,149,0,0.3)" style={{ padding:'1px 5px' }}>reorder: {p.reorderQty}</Pill>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display:'flex', gap:8 }}>
        {lowItems.length > 0 && (
          <button className="btn-success" style={{ flex:1, fontSize:10 }} onClick={() => onEmail(supplier)}>✉ Email Reorder</button>
        )}
        <button className="btn-ghost" style={{ fontSize:10 }} onClick={() => onEdit(supplier)}>Edit</button>
        <button className="btn-danger" onClick={() => onDelete(supplier.id)}>✕</button>
      </div>
    </div>
  )
}

export default function SuppliersTab({ onGenerateAllEmails, onSupplierEmail, onEdit, onDelete }) {
  const { suppliers } = useApp()

  return (
    <div style={{ padding:'28px 40px', maxWidth:1200, margin:'0 auto' }}>
      <LowStockBanner onGenerateAll={onGenerateAllEmails} />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px,1fr))', gap:16 }}>
        {suppliers.map(sup => (
          <SupplierCard key={sup.id} supplier={sup} onEmail={onSupplierEmail} onEdit={onEdit} onDelete={onDelete} />
        ))}
        {suppliers.length === 0 && (
          <div style={{ gridColumn:'1/-1' }}>
            <EmptyState padding="48px">No suppliers yet. Click "+ Add Supplier" to get started.</EmptyState>
          </div>
        )}
      </div>
    </div>
  )
}
