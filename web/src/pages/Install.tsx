import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

type InstallStatus = {
  ok: boolean;
  installed: boolean;
  setupTokenHint: string | null;
};

type PreflightResponse = {
  ok: boolean;
  checks: {
    dbConnection: boolean;
    hotelTables: boolean;
    cmsTables: boolean;
    envWritable: boolean;
  };
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || (data as any)?.message || 'Request failed');
  }
  return data as T;
}

export default function Install() {
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);

  const [form, setForm] = useState({
    setupToken: '',
    dbHost: '127.0.0.1',
    dbPort: '3306',
    dbName: 'plus',
    dbUser: 'root',
    dbPass: '',
    siteUrl: window.location.origin,
    hotelName: 'Hotel',
    nitroUrl: `${window.location.origin}/client`,
    adminUsername: 'admin',
    adminEmail: 'admin@example.com',
    adminPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchJson<InstallStatus>('/api/install/status');
        setStatus(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load installer status.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canSubmit = useMemo(() => {
    return !saving && !!form.dbHost && !!form.dbPort && !!form.dbName && !!form.dbUser && !!form.siteUrl && !!form.hotelName && !!form.nitroUrl && !!form.adminUsername && !!form.adminEmail && !!form.adminPassword && !!form.confirmPassword;
  }, [form, saving]);

  if (!loading && status?.installed) return <Navigate to='/login' replace />;

  async function runPreflight() {
    setError('');
    setDone('');
    setTesting(true);
    try {
      const data = await fetchJson<PreflightResponse>('/api/install/test', {
        method: 'POST',
        body: JSON.stringify({ ...form, dbPort: Number(form.dbPort || 3306) }),
      });
      setPreflight(data);
    } catch (e) {
      setPreflight(null);
      setError(e instanceof Error ? e.message : 'Configuration test failed.');
    } finally {
      setTesting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDone('');
    setSaving(true);

    try {
      const data = await fetchJson<{ ok: boolean; message: string }>('/api/install/run', {
        method: 'POST',
        body: JSON.stringify({ ...form, dbPort: Number(form.dbPort || 3306) }),
      });
      setDone(data.message || 'Installation complete.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Installation failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='install-page'>
      <div className='install-card'>
        <div className='install-head'>PlusCMS Installation</div>
        <div className='install-body'>
          <p className='install-copy'>
            This wizard performs first-time CMS setup. It validates the hotel database, creates CMS tables, writes the API env file, and creates or promotes your first administrator.
          </p>

          {status?.setupTokenHint ? (
            <div className='install-note'>
              Setup token required for remote installs. Read it from: <code>{status.setupTokenHint}</code>
            </div>
          ) : null}

          {error ? <div className='install-alert install-alert--error'>{error}</div> : null}
          {done ? <div className='install-alert install-alert--ok'>{done}</div> : null}

          {preflight ? (
            <div className='install-checks'>
              <div>Database connection: {preflight.checks.dbConnection ? 'Passed' : 'Failed'}</div>
              <div>Hotel tables: {preflight.checks.hotelTables ? 'Passed' : 'Failed'}</div>
              <div>CMS tables: {preflight.checks.cmsTables ? 'Passed' : 'Failed'}</div>
              <div>Env file writable: {preflight.checks.envWritable ? 'Passed' : 'Failed'}</div>
            </div>
          ) : null}

          <form className='install-form' onSubmit={submit}>
            <div className='install-grid'>
              <label><span>Setup Token</span><input value={form.setupToken} onChange={(e) => setForm({ ...form, setupToken: e.target.value })} placeholder='Required unless installing from localhost' /></label>
              <label><span>Hotel Name</span><input value={form.hotelName} onChange={(e) => setForm({ ...form, hotelName: e.target.value })} /></label>
              <label><span>Site URL</span><input value={form.siteUrl} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} /></label>
              <label><span>Nitro URL</span><input value={form.nitroUrl} onChange={(e) => setForm({ ...form, nitroUrl: e.target.value })} /></label>
              <label><span>DB Host</span><input value={form.dbHost} onChange={(e) => setForm({ ...form, dbHost: e.target.value })} /></label>
              <label><span>DB Port</span><input value={form.dbPort} onChange={(e) => setForm({ ...form, dbPort: e.target.value })} /></label>
              <label><span>DB Name</span><input value={form.dbName} onChange={(e) => setForm({ ...form, dbName: e.target.value })} /></label>
              <label><span>DB User</span><input value={form.dbUser} onChange={(e) => setForm({ ...form, dbUser: e.target.value })} /></label>
              <label className='install-grid-full'><span>DB Password</span><input type='password' value={form.dbPass} onChange={(e) => setForm({ ...form, dbPass: e.target.value })} /></label>
              <label><span>Admin Username</span><input value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} /></label>
              <label><span>Admin Email</span><input value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></label>
              <label><span>Admin Password</span><input type='password' value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} /></label>
              <label><span>Confirm Password</span><input type='password' value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} /></label>
            </div>

            <div className='install-actions'>
              <button className='install-btn install-btn--secondary' type='button' disabled={testing || saving} onClick={() => void runPreflight()}>
                {testing ? 'Testing...' : 'Test Configuration'}
              </button>
              <button className='install-btn' type='submit' disabled={!canSubmit}>
                {saving ? 'Installing...' : 'Install CMS'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
