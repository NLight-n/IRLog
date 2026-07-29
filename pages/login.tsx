import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn, useSession } from 'next-auth/react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;
    if (session) {
      router.replace('/');
    }
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await signIn('credentials', {
      redirect: false,
      username,
      password,
    });

    setLoading(false);

    if (res?.ok) {
      window.location.href = `${router.basePath || ''}/`;
    } else {
      setError('Invalid username or password');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-4">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="card shadow-lg">
          <div className="card-header flex flex-col items-center text-center">
            <img src={`${router.basePath || ''}/irLogo.svg`} alt="IR Logo" style={{ height: '120px', width: 'auto' }} className="mb-4" />
            <h1 className="text-3xl font-bold text-black mb-2">IR Log System</h1>
            <p className="text-gray-600">Sign in to your account</p>
          </div>

          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="form-group">
                <label className="form-label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  className="form-input"
                  placeholder="Enter your username"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="form-input"
                  placeholder="Enter your password"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase tracking-wider">Or</span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setError('');
                  setLoading(true);
                  const { loginWithBiometrics } = await import('../lib/auth/webauthn');
                  const res = await loginWithBiometrics();
                  if (res.ok && res.username) {
                    const authRes = await signIn('credentials', {
                      redirect: false,
                      username: res.username,
                      password: 'WEBAUTHN_BIOMETRIC_PASS',
                    });
                    if (authRes?.ok) {
                      window.location.href = `${router.basePath || ''}/`;
                      return;
                    }
                  }
                  setLoading(false);
                  setError(res.message || 'Biometric login failed. Please sign in with password.');
                }}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
                disabled={loading}
              >
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457-.315-2.84-.875-4.087" />
                </svg>
                Log in with Biometrics (Face ID / Fingerprint)
              </button>
            </form>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-500 text-sm">
            Interventional Radiology Log Management System
          </p>
        </div>
      </div>
    </div>
  );
} 