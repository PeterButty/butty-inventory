import { useApp } from '../AppContext'
import { Modal, FieldLabel } from '../components/common'

export default function EmailDraftModal({ draft, drafts, onChange, onClose, onSend, onCopy, onDismiss }) {
  const { t } = useApp()
  if (!draft) return null

  const position = drafts.indexOf(draft)
  const remaining = drafts.length - position - 1

  return (
    <Modal onClose={onClose} width={640} padded={false}>
      <div style={{ background:t.headerBg, borderBottom:`1px solid ${t.border}`, padding:'22px 28px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:4 }}>
            Purchase Order Email — Review Before Sending
            {drafts.length > 1 && <span style={{ marginLeft:10, color:t.accent }}>{position + 1} of {drafts.length}</span>}
          </div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text }}>{draft.supplier.name}</div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:t.textDim, fontSize:20, cursor:'pointer' }}>✕</button>
      </div>

      <div style={{ padding:'14px 28px', borderBottom:`1px solid ${t.border}`, display:'flex', flexWrap:'wrap', gap:6 }}>
        {(draft.items || []).map((item, i) => (
          <div key={i} style={{ fontSize:11, color:t.text, background:t.cardBg, border:`1px solid ${item.isRaw ? 'rgba(255,149,0,0.4)' : t.border}`, padding:'4px 10px', display:'flex', gap:8, alignItems:'center' }}>
            {item.isRaw && <span style={{ fontSize:10 }}>⚙</span>}
            <span>{item.label}</span>
            <span style={{ color:item.isRaw ? '#FF9500' : t.textDim }}>— {item.detail}</span>
          </div>
        ))}
      </div>

      <div style={{ padding:'18px 28px' }}>
        <div style={{ marginBottom:10 }}>
          <FieldLabel size={9}>To</FieldLabel>
          <input className="field-input" value={draft.supplier.email} readOnly style={{ background:t.inputBg, opacity:0.7 }} />
        </div>
        <div style={{ marginBottom:10 }}>
          <FieldLabel size={9}>Subject</FieldLabel>
          <input className="field-input" value={draft.subject} onChange={e => onChange({ ...draft, subject:e.target.value })} />
        </div>
        <div style={{ marginBottom:18 }}>
          <FieldLabel size={9}>Body — Edit Before Sending</FieldLabel>
          <textarea
            value={draft.body}
            onChange={e => onChange({ ...draft, body:e.target.value })}
            style={{ background:t.inputBg, border:`1px solid ${t.borderStrong}`, color:t.text, padding:'12px', fontFamily:"'DM Mono',monospace", fontSize:11, width:'100%', height:180, resize:'vertical', outline:'none', lineHeight:1.6 }}
          />
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button className="btn-success" style={{ flex:1 }} onClick={onSend}>✉ Open in Email Client</button>
          <button className="btn-ghost" onClick={onCopy}>Copy to Clipboard</button>
          <button className="btn-ghost" onClick={onDismiss}>Dismiss</button>
        </div>

        {drafts.length > 1 && (
          <div style={{ marginTop:12, fontSize:10, color:t.textDim, textAlign:'center' }}>
            {remaining} more email{remaining !== 1 ? 's' : ''} to review after this one
          </div>
        )}
      </div>
    </Modal>
  )
}
