// Sign-in for the Momentum app. Google goes through the same Firebase flow as the rest of the
// product: the browser gets a Google ID token, and the server swaps it for a session cookie.
// Email and password is checked by the server alone (POST /api/auth/admin-login).
const FIREBASE_VERSION = '12.19.0';

class SignInError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

async function postJson(path, body) {
  let response;
  try {
    response = await fetch(path, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch { throw new SignInError('network'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) throw new SignInError(data?.error?.code || 'failed', data?.error?.message);
  return data;
}

export function signInWithEmail(email, password) {
  return postJson('/api/auth/admin-login', { email, password });
}

// Which sign-in method this server runs: true when Google sessions are on, false when they are off.
export async function googleEnabled() {
  try {
    const response = await fetch('/api/auth/config', { cache: 'no-store' });
    const config = response.ok ? await response.json() : undefined;
    return typeof config?.enabled === 'boolean' ? config.enabled : undefined;
  } catch { return undefined; }
}

let firebase;
async function loadFirebase() {
  if (firebase) return firebase;
  const response = await fetch('/api/auth/config', { cache: 'no-store' }).catch(() => undefined);
  const config = response?.ok ? await response.json().catch(() => undefined) : undefined;
  if (!config || config.enabled !== true || !config.clientConfig) throw new SignInError('google-unavailable');
  const [{ initializeApp }, auth] = await Promise.all([
    import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
  ]);
  firebase = { auth, instance: auth.getAuth(initializeApp(config.clientConfig)) };
  return firebase;
}

export async function signInWithGoogle() {
  const { auth, instance } = await loadFirebase();
  const provider = new auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let result;
  try { result = await auth.signInWithPopup(instance, provider); }
  catch (error) { throw new SignInError(error?.code || 'failed'); }
  return postJson('/api/auth/session', { idToken: await result.user.getIdToken() });
}

export function describe(error) {
  switch (error && error.code) {
    case 'google-unavailable': return 'Google sign-in isn’t available right now. Use your email and password instead.';
    case 'ADMIN_LOGIN_NOT_ENABLED': return 'Email sign-in isn’t available right now. Use Google instead.';
    case 'ADMIN_LOGIN_NOT_AVAILABLE': return 'Email sign-in isn’t available right now. Use Google instead.';
    case 'VALIDATION_ERROR': return 'Enter your email and password.';
    case 'INVALID_CREDENTIALS': return 'That email and password don’t match. Check both and try again.';
    case 'TOO_MANY_ATTEMPTS': return 'Too many attempts. Wait a few minutes, then try again.';
    case 'ACCOUNT_NOT_APPROVED': return 'This Google account doesn’t have access to Momentum. Ask the plant manager to add it.';
    case 'INVALID_AUTHENTICATION':
    case 'RECENT_SIGN_IN_REQUIRED': return 'Sign in again with your Google account.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request': return 'Google sign-in was closed before it finished. Try again when you’re ready.';
    case 'auth/popup-blocked': return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
    case 'auth/unauthorized-domain': return 'This address isn’t allowed to sign in with Google yet.';
    case 'network':
    case 'auth/network-request-failed': return 'Can’t reach the sign-in service. Check your connection and try again.';
    default: return 'Sign-in didn’t go through. Try again in a moment.';
  }
}
