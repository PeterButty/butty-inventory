import { Component } from 'react'

// Without this, one unexpected error anywhere in the app leaves a blank white
// page with no explanation. This catches it, shows something readable, and
// offers a reload — stock data is safe either way, since it lives in the
// database rather than on screen.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Inventory app error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{ minHeight:'100vh', background:'#0A0A0F', color:'#E8E8F0', fontFamily:"'DM Mono','Fira Mono',monospace", display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div style={{ width:520, maxWidth:'100%', background:'#0F0F18', border:'1px solid #2A2A35', padding:32 }}>
          <div style={{ fontSize:22, marginBottom:14 }}>⚠</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:700, marginBottom:10 }}>
            Something went wrong
          </div>
          <div style={{ fontSize:12, color:'#888', lineHeight:1.7, marginBottom:22 }}>
            The screen hit an unexpected error and stopped. Nothing has been lost —
            your stock figures are stored in the database, not on this page.
            Reloading will almost always clear it.
          </div>
          <div style={{ background:'#111118', border:'1px solid #1E1E28', padding:'12px 14px', fontSize:11, color:'#FF9500', marginBottom:22, wordBreak:'break-word' }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ background:'#2B3FE0', color:'#fff', border:'none', padding:'11px 22px', fontFamily:"'DM Mono',monospace", fontSize:12, cursor:'pointer', letterSpacing:'0.08em', textTransform:'uppercase' }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
