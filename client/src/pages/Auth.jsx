import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Auth() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const mode = (params.get('mode') || 'login'); // login | register | forgot | reset | verify

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const effectiveMode = useMemo(() => {
    // If user lands on /verify or /reset, we get a token but might not have mode
    if (!params.get('mode') && token) {
      if (window.location.pathname.startsWith('/verify')) return 'verify';
      if (window.location.pathname.startsWith('/reset')) return 'reset';
    }
    return mode;
  }, [mode, params, token]);

  const title = useMemo(() => {
    if (effectiveMode === 'register') return 'Create your account';
    if (effectiveMode === 'forgot') return 'Reset your password';
    if (effectiveMode === 'reset') return 'Set a new password';
    if (effectiveMode === 'verify') return 'Verify your email';
    return 'Welcome back';
  }, [effectiveMode]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      if (effectiveMode === 'register') {
        await api('/api/auth/register', { method: 'POST', body: { email, password } });
        setMsg('Account created. Check your email (SMTP) to verify, then log in.');
      } else if (effectiveMode === 'login') {
        await api('/api/auth/login', { method: 'POST', body: { email, password } });
        nav('/');
      } else if (effectiveMode === 'forgot') {
        await api('/api/auth/forgot', { method: 'POST', body: { email } });
        setMsg('If that email exists, a reset link has been sent.');
      } else if (effectiveMode === 'reset') {
        await api('/api/auth/reset', { method: 'POST', body: { token, password } });
        setMsg('Password updated. You can now log in.');
      } else if (effectiveMode === 'verify') {
        await api('/api/auth/verify', { method: 'POST', body: { token } });
        setMsg('Email verified. You can now log in.');
      }
    } catch (e2) {
      const code = e2?.code || e2?.message || 'FAILED';
      if (code === 'EMAIL_NOT_VERIFIED') setErr('Please verify your email first (check your inbox).');
      else if (code === 'INVALID_CREDENTIALS') setErr('Invalid email or password.');
      else if (code === 'EMAIL_IN_USE') setErr('This email is already registered.');
      else setErr(String(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <div className="card">
        <div className="brand">
          <div className="mark">◈</div>
          <div className="name">StreamTalk</div>
        </div>
        <div className="title">{title}</div>
        <p className="sub">MERN-style auth UI + Express API + SMTP mail + Supabase storage.</p>

        <form className="grid" onSubmit={submit}>
          {(effectiveMode === 'login' || effectiveMode === 'register' || effectiveMode === 'forgot') && (
            <div className="field">
              <label>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
            </div>
          )}

          {(effectiveMode === 'login' || effectiveMode === 'register') && (
            <div className="field">
              <label>Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
            </div>
          )}

          {(effectiveMode === 'reset') && (
            <>
              <div className="pill">
                <span className="dot" />
                Reset token detected
              </div>
              <div className="field">
                <label>New password</label>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" required />
              </div>
            </>
          )}

          {(effectiveMode === 'verify') && (
            <div className="pill">
              <span className="dot" />
              Verification token detected
            </div>
          )}

          <button className="btn" disabled={busy} type="submit">
            {busy ? 'Please wait…' : 'Continue'}
          </button>

          <div className="row">
            {mode !== 'login' && <Link className="link" to="/auth?mode=login">Sign in</Link>}
            {mode !== 'register' && <Link className="link" to="/auth?mode=register">Create account</Link>}
            {mode !== 'forgot' && <Link className="link" to="/auth?mode=forgot">Forgot password</Link>}
          </div>
        </form>

        {msg && <div className="hint">{msg}</div>}
        {err && <div className="hint danger">{err}</div>}
      </div>
    </div>
  );
}

