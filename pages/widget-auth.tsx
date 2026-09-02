import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';

export default function WidgetAuthPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ token: string; username: string } | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);

  // If user is already authenticated via session, generate token immediately
  useEffect(() => {
    if (session?.user && !tokenInfo && !loading) {
      exchangeSessionForWidgetToken();
    }
  }, [session]);

  const exchangeSessionForWidgetToken = async () => {
    try {
      setLoading(true);
      setError('');
      const basePath = router.basePath || '';
      const res = await fetch(`${basePath}/api/auth/widget-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.token) {
        completeAuth(data.token, data.user?.username || session?.user?.name || 'User');
      } else {
        setError(data.message || 'Failed to generate widget token');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  };

  const completeAuth = (token: string, user: string) => {
    setSuccess(true);
    setTokenInfo({ token, username: user });
    
    // Construct deep link URL
    const callbackUrl = `irlog://auth-callback?token=${encodeURIComponent(token)}&username=${encodeURIComponent(user)}`;
    
    // Attempt automatic deep link redirection
    window.location.href = callbackUrl;
  };

  const handlePasskeyAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const { loginWithBiometrics } = await import('../lib/auth/webauthn');
      const res = await loginWithBiometrics();
      
      if (res.ok && res.username) {
        // Sign in via NextAuth or get direct token
        const authRes = await signIn('credentials', {
          redirect: false,
          username: res.username,
          password: 'WEBAUTHN_BIOMETRIC_PASS',
        });

        if (authRes?.ok) {
          await exchangeSessionForWidgetToken();
          return;
        }
      }
      setError(res.message || 'Passkey authentication was not completed.');
    } catch (err: any) {
      setError(err.message || 'Passkey authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        username,
        password,
      });

      if (res?.ok) {
        await exchangeSessionForWidgetToken();
      } else {
        setError('Invalid username or password');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-6">
          <img
            src={`${router.basePath || ''}/irLogo.svg`}
            alt="IR Logo"
            className="mx-auto mb-4"
            style={{ height: '80px', width: 'auto' }}
          />
          <h1 className="text-2xl font-bold text-gray-900">Android Widget Setup</h1>
          <p className="text-sm text-gray-500 mt-1">Authorize your Android Home Screen Widget</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && tokenInfo ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Authentication Successful!</h2>
            <p className="text-sm text-gray-600">
              Authenticated as <span className="font-semibold">{tokenInfo.username}</span>.
            </p>
            <p className="text-xs text-gray-400">
              If the widget app did not open automatically, tap below:
            </p>
            <a
              href={`irlog://auth-callback?token=${encodeURIComponent(tokenInfo.token)}&username=${encodeURIComponent(tokenInfo.username)}`}
              className="btn btn-primary w-full inline-block text-center py-3 font-medium rounded-xl shadow-md"
            >
              Open IRLog Widget App
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handlePasskeyAuth}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-3 shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <div className="spinner mr-2"></div>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457-.315-2.84-.875-4.087" />
                </svg>
              )}
              <span>{loading ? 'Authenticating...' : 'Sign in with Passkey (Biometrics)'}</span>
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {!showPasswordFallback ? (
              <button
                type="button"
                onClick={() => setShowPasswordFallback(true)}
                className="w-full text-sm text-gray-600 hover:text-gray-800 py-2 font-medium"
              >
                Sign in with Password instead
              </button>
            ) : (
              <form onSubmit={handlePasswordLogin} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition"
                >
                  {loading ? 'Signing in...' : 'Sign in with Password'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">IRLog Worklist Companion • Version 1.0</p>
        </div>
      </div>
    </div>
  );
}
