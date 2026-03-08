import { useState } from 'react'
import { supabase } from './supabase'

const LOGO_URL = 'https://doajjmtxvwqounqpqzxv.supabase.co/storage/v1/object/public/product-images/butty-logo.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit() {
    setError('')
    setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setError('Check your email to confirm your account.')
    } else if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) setError(error.message)
      else setResetSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .login-input { background: #111118; border: 1px solid #2A2A35; color: #E8E8F0; padding: 11px 14px; font-family: 'DM Mono', monospace; font-size: 13px; width: 100%; outline: none; transition: border-color 0.15s; }
        .login-input:focus { border-color: #2B3FE0; }
        .login-btn { background: #2B3FE0; color: #fff; border: none; padding: 12px; font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 500; cursor: pointer; letter-spacing: 0.1em; text-transform: uppercase; width: 100%; transition: opacity 0.15s; }
        .login-btn:hover { opacity: 0.85; }
        .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .text-link { background: none; border: none; color: #555; font-family: 'DM Mono', monospace; font-size: 11px; cursor: pointer; letter-spacing: 0.06em; text-decoration: underline; }
        .text-link:hover { color: #888; }
      `}</style>

      <div style={{ width: 380, padding: 40, background: '#0F0F18', border: '1px solid #1E1E28' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#2B3FE0', letterSpacing: '-0.02em' }}>butty</div>
          <div style={{ width: 1, height: 28, background: '#2A2A35' }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#E8E8F0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Manufacturing</div>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: '0.12em' }}>INVENTORY SYSTEM</div>
          </div>
        </div>

        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: '#E8E8F0', marginBottom: 24, letterSpacing: '-0.01em' }}>
          {mode === 'login' ? 'Sign in to your account' : mode === 'signup' ? 'Create an account' : 'Reset your password'}
        </div>

        {resetSent ? (
          <div style={{ fontSize: 12, color: '#30D158', letterSpacing: '0.04em', lineHeight: 1.6 }}>
            Password reset email sent. Check your inbox and follow the link to reset your password.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Email</div>
                <input className="login-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@butty.com" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </div>
              {mode !== 'reset' && (
                <div>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Password</div>
                  <input className="login-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                </div>
              )}
            </div>

            {error && <div style={{ fontSize: 11, color: error.includes('Check') ? '#30D158' : '#FF3B3B', marginBottom: 16, letterSpacing: '0.04em', lineHeight: 1.5 }}>{error}</div>}

            <button className="login-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
            </button>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {mode === 'login' ? (
            <>
              <button className="text-link" onClick={() => setMode('reset')}>Forgot password?</button>
              <button className="text-link" onClick={() => setMode('signup')}>Create account</button>
            </>
          ) : (
            <button className="text-link" onClick={() => { setMode('login'); setResetSent(false); }}>← Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  )
}
