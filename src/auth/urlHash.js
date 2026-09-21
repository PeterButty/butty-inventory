// Supabase clears the recovery token out of the address bar as soon as its
// client starts up, so the hash is snapshotted here. main.jsx imports this
// before anything that touches supabase, which is what makes it reliable.

const raw = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
const params = new URLSearchParams(raw);

export const authRedirect = {
  type:        params.get('type'),
  error:       params.get('error'),
  errorCode:   params.get('error_code'),
  description: params.get('error_description'),
};

export const isRecovery   = authRedirect.type === 'recovery';
export const hasAuthError = Boolean(authRedirect.error);

// Turns the raw redirect error into something worth reading. An expired or
// already-used link is by far the common case — email scanners often follow
// the link before the person does.
export function describeAuthError({ errorCode, description }) {
  if (errorCode === 'otp_expired') {
    return 'That reset link has expired or had already been used. Request a new one below.';
  }
  if (description) return description;
  return 'That link could not be used. Request a new one below.';
}
