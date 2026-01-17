import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function SetupPage() {
  const [loading, setLoading] = useState(true);
  const [alreadySetup, setAlreadySetup] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'fail'>('checking');
  const [dbError, setDbError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check DB connection
    fetch('/api/setup-admin?dbcheck=1')
      .then(res => res.json())
      .then(data => {
        if (data.connected) {
          setDbStatus('ok');
        } else {
          setDbStatus('fail');
          setDbError(data.error || 'Unknown error');
        }
      })
      .catch(() => {
        setDbStatus('fail');
        setDbError('Unknown error');
      });
  }, []);

  useEffect(() => {
    // Check if any users exist
    fetch('/api/setup-admin?check=1')
      .then(res => res.json())
      .then(data => {
        if (data.exists) {
          setAlreadySetup(true);
          router.replace('/login');
        } else {
          setLoading(false);
        }
      });
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/setup-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.replace('/login');
    } else {
      const data = await res.json();
      setError(data.message || 'Failed to create admin');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (alreadySetup) return null;

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h2>Setup Admin Account</h2>
      <div style={{ marginBottom: 16 }}>
        {dbStatus === 'checking' && <span>Checking database connection...</span>}
        {dbStatus === 'ok' && <span style={{ color: 'green' }}>Database connected</span>}
        {dbStatus === 'fail' && <span style={{ color: 'red' }}>Database connection failed: {dbError}</span>}
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Username</label>
          <input name="username" value={form.username} onChange={handleChange} required style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} required style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input name="password" type="password" value={form.password} onChange={handleChange} required style={{ width: '100%' }} />
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <button type="submit" style={{ width: '100%' }} disabled={dbStatus !== 'ok'}>Create Admin</button>
      </form>
    </div>
  );
} 