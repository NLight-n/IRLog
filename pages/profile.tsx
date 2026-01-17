import React, { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import NavBar from '../components/layout/NavBar';
import { useAppSettings } from './_app';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({ username: '', email: '' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { appHeading, appSubheading, appLogo } = useAppSettings();
  const navbarRef = useRef<HTMLDivElement>(null);
  const [navbarHeight, setNavbarHeight] = useState(0);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.replace('/login');
      return;
    }
    fetch('/api/users/profile')
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        setForm({ username: data.username, email: data.email });
      });
  }, [session, status]);

  useEffect(() => {
    let frame: number;
    let lastHeight = 0;
    let stableCount = 0;
    function measure() {
      if (navbarRef.current) {
        const h = navbarRef.current.offsetHeight;
        if (h !== lastHeight) {
          lastHeight = h;
          stableCount = 0;
          setNavbarHeight(h);
        } else {
          stableCount++;
        }
        if (stableCount < 3) {
          frame = requestAnimationFrame(measure);
        }
      }
    }
    function updateNavbarHeight() {
      lastHeight = 0;
      stableCount = 0;
      frame = requestAnimationFrame(measure);
    }
    updateNavbarHeight();
    window.addEventListener('resize', updateNavbarHeight);
    router.events?.on('routeChangeComplete', updateNavbarHeight);
    return () => {
      window.removeEventListener('resize', updateNavbarHeight);
      router.events?.off('routeChangeComplete', updateNavbarHeight);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [router.events]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, email: form.email }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      setSuccess('Profile updated successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    if (passwords.new !== passwords.confirm) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwords.new }),
      });
      if (!res.ok) throw new Error('Failed to update password');
      setSuccess('Password updated successfully');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || !profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavBar ref={navbarRef} user={session?.user || null} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />
      <div className="container max-w-xl mx-auto py-8" style={{ paddingTop: navbarHeight + 8 }}>
        <h1 className="text-2xl font-bold mb-6">User Profile</h1>
        <form onSubmit={handleSubmit} className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Profile Info</h2>
          <div className="mb-4">
            <label className="form-label block mb-1">Username</label>
            <input type="text" name="username" value={form.username} onChange={handleChange} className="form-input w-full" />
          </div>
          <div className="mb-4">
            <label className="form-label block mb-1">Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} className="form-input w-full" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>Update Profile</button>
        </form>
        <form onSubmit={handlePasswordSubmit} className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>
          <div className="mb-4">
            <label className="form-label block mb-1">New Password</label>
            <input type="password" name="new" value={passwords.new} onChange={handlePasswordChange} className="form-input w-full" />
          </div>
          <div className="mb-4">
            <label className="form-label block mb-1">Confirm New Password</label>
            <input type="password" name="confirm" value={passwords.confirm} onChange={handlePasswordChange} className="form-input w-full" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>Change Password</button>
        </form>
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Role & Permissions</h2>
          <div className="mb-2"><b>Role:</b> {profile.role}</div>
          <div className="mb-2"><b>Permissions:</b></div>
          <ul className="list-disc ml-6">
            {profile.permissions && profile.permissions.length > 0 && Object.entries(profile.permissions[0]).map(([key, value]) => (
              <li key={key}>{key}: {value ? 'Yes' : 'No'}</li>
            ))}
          </ul>
        </div>
        {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>}
        {success && <div className="p-3 mb-4 bg-green-50 border border-green-200 rounded text-green-700">{success}</div>}
      </div>
    </div>
  );
} 