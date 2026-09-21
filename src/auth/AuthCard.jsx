// The signed-out card. Sign in and set-a-new-password share it, so the two
// screens cannot drift apart.

const AUTH_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .login-input { background: #111118; border: 1px solid #2A2A35; color: #E8E8F0; padding: 11px 14px; font-family: 'DM Mono', monospace; font-size: 13px; width: 100%; outline: none; transition: border-color 0.15s; }
  .login-input:focus { border-color: #2B3FE0; }
  .login-btn { background: #2B3FE0; color: #fff; border: none; padding: 12px; font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 500; cursor: pointer; letter-spacing: 0.1em; text-transform: uppercase; width: 100%; transition: opacity 0.15s; }
  .login-btn:hover { opacity: 0.85; }
  .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .text-link { background: none; border: none; color: #555; font-family: 'DM Mono', monospace; font-size: 11px; cursor: pointer; letter-spacing: 0.06em; text-decoration: underline; }
  .text-link:hover { color: #888; }
`

export function AuthField({ label, ...props }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <input className="login-input" {...props} />
    </div>
  )
}

export function AuthMessage({ tone = 'error', children }) {
  if (!children) return null
  const color = tone === 'success' ? '#30D158' : tone === 'info' ? '#888' : '#FF3B3B'
  return (
    <div style={{ fontSize: 11, color, marginBottom: 16, letterSpacing: '0.04em', lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

export default function AuthCard({ title, children, footer }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono', monospace" }}>
      <style>{AUTH_CSS}</style>

      <div style={{ width: 380, padding: 40, background: '#0F0F18', border: '1px solid #1E1E28' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#2B3FE0', letterSpacing: '-0.02em' }}>butty</div>
          <div style={{ width: 1, height: 28, background: '#2A2A35' }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#E8E8F0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Manufacturing</div>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.12em' }}>INVENTORY SYSTEM</div>
          </div>
        </div>

        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: '#E8E8F0', marginBottom: 24, letterSpacing: '-0.01em' }}>
          {title}
        </div>

        {children}

        {footer && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
