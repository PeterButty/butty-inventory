import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { authRedirect, isRecovery, hasAuthError, describeAuthError } from './auth/urlHash'
import Login from './Login'
import ResetPassword from './auth/ResetPassword'
import Inventory from './Inventory'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // Set from the address bar on arrival, and again if supabase reports the
  // recovery event after it has processed the link.
  const [recovering, setRecovering] = useState(isRecovery)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function leaveRecovery() {
    setRecovering(false)
    // Drop the token from the address bar so refreshing does not reopen this.
    window.history.replaceState(null, '', window.location.pathname)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 20, height: 20, border: '2px solid #2A2A35', borderTopColor: '#2B3FE0', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // A reset link wins over the session it creates: the point of following it is
  // to choose a new password, not to be dropped into the inventory with the old
  // one still in force.
  if (recovering) return <ResetPassword onDone={leaveRecovery} />

  if (!session) {
    return <Login initialError={hasAuthError ? describeAuthError(authRedirect) : ''} />
  }

  return <Inventory user={session.user} onSignOut={handleSignOut} />
}
