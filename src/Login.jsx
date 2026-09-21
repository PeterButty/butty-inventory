import { useState } from 'react'
import { supabase } from './supabase'
import AuthCard, { AuthField, AuthMessage } from './auth/AuthCard'

export default function Login({ initialError = '' }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(initialError)
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState('login') // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit() {
    setError('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      // Send people back to wherever they are using the app from, rather than
      // relying on the Site URL setting in Supabase.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) setError(error.message)
      else setResetSent(true)
    }

    setLoading(false)
  }

  function backToSignIn() {
    setMode('login')
    setResetSent(false)
    setError('')
  }

  return (
    <AuthCard
      title={mode === 'login' ? 'Sign in to your account' : 'Reset your password'}
      footer={
        mode === 'login'
          ? <button className="text-link" onClick={() => { setMode('reset'); setError('') }}>Forgot password?</button>
          : <button className="text-link" onClick={backToSignIn}>← Back to sign in</button>
      }
    >
      {resetSent ? (
        <AuthMessage tone="success">
          Reset email sent to {email}. Follow the link in it to choose a new password.
          The link only works once, and expires after an hour.
        </AuthMessage>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <AuthField
              label="Email"
              type="email"
              value={email}
              placeholder="you@butty.com"
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            {mode === 'login' && (
              <AuthField
                label="Password"
                type="password"
                value={password}
                placeholder="••••••••"
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            )}
          </div>

          <AuthMessage>{error}</AuthMessage>

          <button className="login-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Send Reset Email'}
          </button>
        </>
      )}
    </AuthCard>
  )
}
