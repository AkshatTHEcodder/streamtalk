import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Home() {
  const [user, setUser] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    setErr('');
    try {
      await api('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (e) {
      setErr(e?.message || 'Logout failed');
    }
  }

  return (
    <div className="shell">
      <div className="card">
        <div className="brand">
          <div className="mark">◈</div>
          <div className="name">StreamTalk</div>
        </div>
        <div className="title">Auth dashboard</div>
        <p className="sub">This is the MERN auth app. Your existing static demo remains at the repo root.</p>

        {user ? (
          <>
            <div className="pill" style={{ marginBottom: 14 }}>
              <span className="dot" />
              {user.email} {user.verified ? '(verified)' : '(unverified)'}
            </div>
            <button className="btn secondary" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <div className="hint">You’re not signed in.</div>
            <div className="row">
              <Link className="btn" to="/auth?mode=login" style={{ textAlign: 'center', textDecoration: 'none' }}>Sign in</Link>
              <Link className="btn secondary" to="/auth?mode=register" style={{ textAlign: 'center', textDecoration: 'none' }}>Create account</Link>
            </div>
          </>
        )}

        {err && <div className="hint danger">{err}</div>}
      </div>
    </div>
  );
}

