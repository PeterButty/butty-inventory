import { useState } from 'react'
import { supabase } from '../supabase'
import AuthCard, { AuthField, AuthMessage } from './AuthCard'

// Shown after someone follows a password reset link. Until this existed the
// link signed you in for that session and left the password unchanged, so the
// Forgot Password flow could never actually reset anything.

const MIN_LENGTH = 8

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  const tooShort = password.length > 0 && password.length < MIN_LENGTH
  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !loading

  async function handleSubmit() {
    if (!canSubmit) return
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    // Sign out so the new password is actually used to get back in, rather
    // than riding the recovery session.
    await supabase.auth.signOut()
    setDone(true)
  }

  if (done) {
    return (
      <AuthCard title="Password changed">
        <AuthMessage tone="success">
          Your password has been updated. You can sign in with it now.
        </AuthMessage>
        <button className="login-btn" onClick={onDone}>Go to sign in</button>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Choose a new password"
      footer={<button className="text-link" onClick={onDone}>← Back to sign in</button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <AuthField
          label="New password"
          type="password"
          value={password}
          placeholder="••••••••"
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        <AuthField
          label="Confirm new password"
          type="password"
          value={confirm}
          placeholder="••••••••"
          onChange={e => setConfirm(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
      </div>

      <AuthMessage tone={error ? 'error' : 'info'}>
        {error
          || (tooShort && `At least ${MIN_LENGTH} characters.`)
          || (mismatch && 'The two passwords do not match.')
          || `Use at least ${MIN_LENGTH} characters.`}
      </AuthMessage>

      <button className="login-btn" onClick={handleSubmit} disabled={!canSubmit}>
        {loading ? 'Saving...' : 'Save New Password'}
      </button>
    </AuthCard>
  )
}
