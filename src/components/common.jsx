import { useApp } from '../AppContext'
import { STATUS_META, getStockStatus } from '../lib/stock'

// Small pieces of screen that were previously written out again in every place
// they appeared.

// ── Modal shell ──────────────────────────────────────────────────────────────
// The overlay, the click-outside-to-close and the click-inside-doesn't were
// repeated in all eight pop-ups.
export function Modal({ onClose, width, padded = true, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        style={{ ...(width ? { width } : {}), ...(padded ? {} : { padding:0, overflow:'hidden' }) }}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalTitle({ children, sub }) {
  const { t } = useApp()
  return (
    <>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text, marginBottom:sub ? 6 : 24 }}>
        {children}
      </div>
      {sub && <div style={{ fontSize:11, color:t.textDim, marginBottom:24 }}>{sub}</div>}
    </>
  )
}

// ── Labels and fields ────────────────────────────────────────────────────────
export function FieldLabel({ children, size = 10, style }) {
  const { t } = useApp()
  return (
    <div style={{ fontSize:size, color:t.textDim, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5, ...style }}>
      {children}
    </div>
  )
}

export function SectionLabel({ children, style }) {
  const { t } = useApp()
  return (
    <div style={{ fontSize:10, color:t.textDim, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10, ...style }}>
      {children}
    </div>
  )
}

export function EmptyState({ children, dashed = true, padding = '18px' }) {
  const { t } = useApp()
  return (
    <div style={{ padding, textAlign:'center', border:dashed ? `1px dashed ${t.border}` : `1px solid ${t.border}`, color:t.textFaint, fontSize:11 }}>
      {children}
    </div>
  )
}

// ── Images ───────────────────────────────────────────────────────────────────
export function ImageThumb({ src, size = 44 }) {
  if (!src) return (
    <div style={{ width:size, height:size, background:'#1A1A26', border:'1px solid #2A2A35', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <span style={{ fontSize:size * 0.35, opacity:0.3 }}>📷</span>
    </div>
  )
  return <img src={src} alt="" style={{ width:size, height:size, objectFit:'cover', display:'block', flexShrink:0 }} />
}

// The upload / replace / remove block, previously written once for parts and
// again for machines.
export function PhotoField({ imageUrl, onFile, onRemove, previewWidth = 100, previewHeight = 100, prompt = 'Click to upload a photo', icon = '📷' }) {
  const { t } = useApp()

  if (imageUrl) {
    return (
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
        <img src={imageUrl} alt="" style={{ width:previewWidth, height:previewHeight, objectFit:'cover', border:`1px solid ${t.borderStrong}` }} />
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <label className="btn-ghost" style={{ cursor:'pointer', textAlign:'center' }}>
            Replace Photo
            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { onFile(e.target.files[0]); e.target.value = '' }} />
          </label>
          <button className="btn-danger" onClick={onRemove}>Remove</button>
        </div>
      </div>
    )
  }

  return (
    <label
      style={{ border:`1px dashed ${t.borderStrong}`, background:t.bg, padding:'18px', textAlign:'center', cursor:'pointer', display:'block', transition:'border-color 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = t.accent }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = t.borderStrong }}
    >
      <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:11, color:t.textDim }}>{prompt}</div>
      <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { onFile(e.target.files[0]); e.target.value = '' }} />
    </label>
  )
}

// ── Status ───────────────────────────────────────────────────────────────────
export function StatusBadge({ status, small = false }) {
  const sm = STATUS_META[status]
  if (!sm) return null
  return (
    <span style={{ background:sm.bg, color:sm.color, padding:small ? '3px 8px' : '3px 10px', fontSize:small ? 9 : 10, letterSpacing:'0.08em', textTransform:'uppercase', display:'inline-flex', alignItems:'center', gap:small ? 4 : 5 }}>
      <span style={{ width:small ? 4 : 5, height:small ? 4 : 5, borderRadius:'50%', background:sm.dot, display:'inline-block' }} />
      {sm.label}
    </span>
  )
}

export function StockStatusBadge({ product, small }) {
  if (!product) return null
  return <StatusBadge status={getStockStatus(product.stock, product.minStock)} small={small} />
}

// ── Pills ────────────────────────────────────────────────────────────────────
export function Pill({ color, border, children, style }) {
  return (
    <span style={{ fontSize:9, color, border:`1px solid ${border || color}`, padding:'1px 6px', letterSpacing:'0.06em', flexShrink:0, ...style }}>
      {children}
    </span>
  )
}

export function PartTypePill({ partType }) {
  if (partType === 'made') return <Pill color="#FF9500" border="rgba(255,149,0,0.4)" style={{ padding:'1px 5px' }}>MADE</Pill>
  if (partType === 'subassembly') return <Pill color="#64D2FF" border="rgba(100,210,255,0.4)" style={{ padding:'1px 5px' }}>🔩 ASSEMBLY</Pill>
  return null
}

// ── Toast ────────────────────────────────────────────────────────────────────
export function Toast({ toast }) {
  if (!toast) return null
  const isError = toast.type === 'error'
  return (
    <div
      className="toast"
      style={{
        background:   isError ? 'rgba(255,59,59,0.15)' : 'rgba(48,209,88,0.12)',
        color:        isError ? '#FF3B3B' : '#30D158',
        borderColor:  isError ? 'rgba(255,59,59,0.3)' : 'rgba(48,209,88,0.3)',
      }}
    >
      {toast.msg}
    </div>
  )
}
