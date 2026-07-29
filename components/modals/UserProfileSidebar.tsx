import React, { useEffect, useState, useContext, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { HexColorPicker } from 'react-colorful';
import { useTheme } from '../../lib/theme/ThemeContext';
import { ColumnContext, defaultColumns } from '../../lib/columnContext';
import { useRouter } from 'next/router';

interface UserProfileSidebarProps {
  open: boolean;
  onClose: () => void;
  scrollToColumnPrefs?: boolean;
  setScrollToColumnPrefs?: (v: boolean) => void;
}

// Utility to darken a hex color by a percent (0.2 = 20%)
function darkenColor(hex: string, percent: number) {
  hex = hex.replace(/^#/, '');
  const r = parseInt(hex.substring(0,2), 16);
  const g = parseInt(hex.substring(2,4), 16);
  const b = parseInt(hex.substring(4,6), 16);
  const newR = Math.floor(r * (1 - percent));
  const newG = Math.floor(g * (1 - percent));
  const newB = Math.floor(b * (1 - percent));
  return `#${[newR,newG,newB].map(x => x.toString(16).padStart(2,'0')).join('')}`;
}

// Utility to get best contrast color (white or black) for a given hex color
function getContrastColor(hex: string) {
  hex = hex.replace(/^#/, '');
  const r = parseInt(hex.substring(0,2), 16);
  const g = parseInt(hex.substring(2,4), 16);
  const b = parseInt(hex.substring(4,6), 16);
  // Perceived brightness formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#000' : '#fff';
}

const UserProfileSidebar: React.FC<UserProfileSidebarProps> = ({ open, onClose, scrollToColumnPrefs, setScrollToColumnPrefs }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({ username: '', email: '' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();
  const { columns, setColumns } = useContext(ColumnContext);
  const [formTheme, setFormTheme] = useState(theme);
  const [formAccentColor, setFormAccentColor] = useState(accentColor);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState('');
  const [notifPermission, setNotifPermission] = useState<string>('default');

  // New state for column preferences
  const [visibleColumns, setVisibleColumns] = useState<any[]>([]);
  const [selectedAvailable, setSelectedAvailable] = useState<string | null>(null);
  const [selectedVisible, setSelectedVisible] = useState<string | null>(null);

  // Compute available columns as those not in visibleColumns
  const availableColumns = defaultColumns.filter(
    dc => !visibleColumns.some(vc => vc.key === dc.key)
  );

  const columnPrefsCardRef = useRef<HTMLDivElement>(null);

  // Initialize notification permission status on open
  useEffect(() => {
    if (open && typeof window !== 'undefined') {
      if (!('Notification' in window)) {
        setNotifPermission('unsupported');
      } else {
        import('../../lib/notifications').then(({ checkPushSubscriptionStatus }) => {
          checkPushSubscriptionStatus().then(isSubscribed => {
            if (isSubscribed) {
              setNotifPermission('granted');
            } else if (Notification.permission === 'denied') {
              setNotifPermission('denied');
            } else {
              setNotifPermission('default');
            }
          });
        });
      }
    }
  }, [open]);

  // On open, initialize visibleColumns from user columns or defaults
  useEffect(() => {
    if (!open) return;
    setError(''); setSuccess('');
    (async () => {
      if (status === 'loading') return;
      if (!session) return;
      const res = await fetch('/api/users/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setForm({ username: data.username, email: data.email });
        let userCols = Array.isArray(data.columns) ? data.columns : defaultColumns;
        // Only keep columns that exist in defaultColumns
        userCols = userCols.filter((uc: any) => defaultColumns.some(dc => dc.key === uc.key));
        // Merge in any missing columns from defaultColumns
        const userColKeys = userCols.map((uc: any) => uc.key);
        const mergedCols = [
          ...userCols,
          ...defaultColumns.filter(dc => !userColKeys.includes(dc.key))
        ];
        setVisibleColumns(mergedCols.filter((c: any) => c.visible !== false));
      } else {
        setProfile(null);
        setVisibleColumns(defaultColumns);
      }
    })();
  }, [open, session, status]);

  useEffect(() => {
    if (open && scrollToColumnPrefs && columnPrefsCardRef.current) {
      columnPrefsCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (setScrollToColumnPrefs) setScrollToColumnPrefs(false);
    }
  }, [open, scrollToColumnPrefs]);

  // Add column from available to visible
  const handleAddColumn = () => {
    if (!selectedAvailable) return;
    const col = defaultColumns.find(c => c.key === selectedAvailable);
    if (!col || visibleColumns.some(vc => vc.key === col.key)) return;
    setVisibleColumns([...visibleColumns, col]);
    setSelectedAvailable(null);
  };

  // Remove column from visible
  const handleRemoveColumn = () => {
    if (!selectedVisible) return;
    setVisibleColumns(visibleColumns.filter(c => c.key !== selectedVisible));
    setSelectedVisible(null);
  };

  // Move selected visible column up
  const handleMoveUp = () => {
    if (!selectedVisible) return;
    const idx = visibleColumns.findIndex(c => c.key === selectedVisible);
    if (idx > 0) {
      const newCols = [...visibleColumns];
      [newCols[idx - 1], newCols[idx]] = [newCols[idx], newCols[idx - 1]];
      setVisibleColumns(newCols);
      setSelectedVisible(newCols[idx - 1].key);
    }
  };

  // Move selected visible column down
  const handleMoveDown = () => {
    if (!selectedVisible) return;
    const idx = visibleColumns.findIndex(c => c.key === selectedVisible);
    if (idx < visibleColumns.length - 1) {
      const newCols = [...visibleColumns];
      [newCols[idx + 1], newCols[idx]] = [newCols[idx], newCols[idx + 1]];
      setVisibleColumns(newCols);
      setSelectedVisible(newCols[idx + 1].key);
    }
  };

  // Save preferences
  const handlePrefsSave = async () => {
    setSavingPrefs(true);
    // 1. Start with visibleColumns (in user order, visible: true)
    // 2. Then add remaining defaultColumns (not in visibleColumns), visible: false
    const visibleKeys = visibleColumns.map(vc => vc.key);
    const orderedColumns = [
      ...visibleColumns.map(vc => ({ ...vc, visible: true })),
      ...defaultColumns.filter(dc => !visibleKeys.includes(dc.key)).map(dc => ({ ...dc, visible: false }))
    ];
    setColumns(orderedColumns);
    await fetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns: orderedColumns }),
    });
    setPrefsMessage('Preferences saved!');
    setTimeout(() => {
      setPrefsMessage('');
      window.location.reload();
    }, 1000);
    setSavingPrefs(false);
  };

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
      // Alert and log out to refresh session with new username/email
      alert('Profile updated. Please log in again to see changes.');
      await signOut({ callbackUrl: `${router.basePath || ''}/login` });
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
    if (!passwords.current) {
      setError('Current password is required');
      setLoading(false);
      return;
    }
    if (passwords.new !== passwords.confirm) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, password: passwords.new }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to update password');
      }
      setSuccess('Password updated successfully');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormTheme(e.target.value);
    setTheme(e.target.value);
  };
  const handleAccentColorChange = (color: string) => {
    setFormAccentColor(color);
    setAccentColor(color);
    // Also set a 20% darker version for hover
    const hoverColor = darkenColor(color, 0.2);
    if (typeof window !== 'undefined') {
      document.body.style.setProperty('--color-accent-hover', hoverColor);
      document.documentElement.style.setProperty('--color-accent-hover', hoverColor);
      // Set contrast color for accent
      const contrastColor = getContrastColor(color);
      document.body.style.setProperty('--color-accent-contrast', contrastColor);
      document.documentElement.style.setProperty('--color-accent-contrast', contrastColor);
    }
  };

  // Accent color and contrast for selected row
  const accentBg = accentColor || '#3b82f6';
  const accentText = getContrastColor(accentBg);
  const themeText = theme === 'dark' ? '#fff' : '#18181b';
  const borderColor = theme === 'dark' ? '#23272f' : '#e5e5e5';

  return (
    <div
      className={`fixed inset-0 flex justify-end transition-all ${open ? '' : 'pointer-events-none'}`}
      style={{ zIndex: 9999, background: open ? 'rgba(0,0,0,0.5)' : 'transparent', backdropFilter: open ? 'blur(4px)' : 'none', WebkitBackdropFilter: open ? 'blur(4px)' : 'none', visibility: open ? 'visible' : 'hidden' }}
      onClick={onClose}
    >
      <div
        className={`bg-gray-50 dark:bg-gray-900 shadow-lg h-full w-full max-w-md user-profile-sidebar-mobile transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold">User Profile</h2>
          <button onClick={onClose} className="text-2xl font-bold text-gray-500 hover:text-gray-800">×</button>
        </div>
        <div className="space-y-6 p-4 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 64px)', paddingBottom: '120px' }}>
          {!session ? (
            <div className="text-center text-gray-500">Not logged in.</div>
          ) : !profile ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Profile Info Card */}
              <div className="card">
                <div className="card-body">
                  <form onSubmit={handleSubmit}>
                    <h3 className="text-lg font-semibold mb-4">Profile Info</h3>
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
                </div>
              </div>
              {/* Change Password Card */}
              <div className="card">
                <div className="card-body">
                  <form onSubmit={handlePasswordSubmit}>
                    <h3 className="text-lg font-semibold mb-4">Change Password</h3>
                    <div className="mb-4">
                      <label className="form-label block mb-1">Current Password</label>
                      <input type="password" name="current" value={passwords.current} onChange={handlePasswordChange} className="form-input w-full" />
                    </div>
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
                </div>
              </div>
              {/* Biometric Login Registration Card */}
              <div className="card">
                <div className="card-body">
                  <h3 className="text-lg font-semibold mb-2">Biometric Login</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Register this device's Face ID, Touch ID, or Fingerprint reader for 1-touch sign-in without typing passwords.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const { registerBiometricCredential } = await import('../../lib/auth/webauthn');
                      const res = await registerBiometricCredential();
                      if (res.ok) {
                        alert(res.message);
                      } else {
                        alert(res.message);
                      }
                    }}
                    className="btn btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457-.315-2.84-.875-4.087" />
                    </svg>
                    Register Biometrics for this Device
                  </button>
                </div>
              </div>
              {/* Push Notifications Card */}
              <div className="card">
                <div className="card-body">
                  <h3 className="text-lg font-semibold mb-2">Push Notifications</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Receive real-time push notifications when appointments are scheduled, updated, or cancelled on the worklist.
                  </p>
                  {notifPermission === 'granted' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ padding: '8px 12px', background: 'var(--color-accent-subtle, rgba(59,130,246,0.1))', borderRadius: '8px', border: '1px solid var(--color-accent, #3b82f6)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-accent, #3b82f6)', fontSize: 13, fontWeight: 500 }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Push Notifications are Enabled
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const { unsubscribeUserFromPush } = await import('../../lib/notifications');
                          const res = await unsubscribeUserFromPush();
                          if (res.ok) {
                            setNotifPermission('default');
                            alert('Push notifications disabled.');
                          } else {
                            alert(res.message);
                          }
                        }}
                        className="btn btn-secondary w-full text-xs"
                        style={{ padding: '6px 12px' }}
                      >
                        Disable Notifications
                      </button>
                    </div>
                  )}
                  {notifPermission === 'denied' && (
                    <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid #ef4444', display: 'flex', alignItems: 'flex-start', gap: 8, color: '#ef4444', fontSize: 13 }}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginTop: 2, flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <div>
                        <strong>Notifications are Blocked:</strong> Please allow notifications for this website in your browser or device system settings to receive alerts.
                      </div>
                    </div>
                  )}
                  {notifPermission === 'unsupported' && (
                    <div style={{ padding: '8px 12px', background: 'var(--color-gray-100, #f3f4f6)', borderRadius: '8px', border: '1px solid var(--color-gray-300, #d1d5db)', color: 'var(--color-text-muted, #6b7280)', fontSize: 13 }}>
                      Notifications are not supported on this browser or device.
                    </div>
                  )}
                  {(notifPermission === 'default' || notifPermission === '') && (
                    <button
                      type="button"
                      onClick={async () => {
                        const { subscribeUserToPush } = await import('../../lib/notifications');
                        const res = await subscribeUserToPush();
                        if (res.ok) {
                          setNotifPermission('granted');
                          alert('Push notifications enabled successfully!');
                        } else {
                          setNotifPermission('denied');
                          alert(res.message);
                        }
                      }}
                      className="btn btn-secondary w-full flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      Enable Push Notifications
                    </button>
                  )}
                </div>
              </div>

              {/* Role & Permissions Card */}
              <div className="card">
                <div className="card-body">
                  <h3 className="text-lg font-semibold mb-4">Role & Permissions</h3>
                  <div className="mb-2"><b>Role:</b> {profile.role}</div>
                  <div className="mb-2"><b>Permissions:</b></div>
                  <ul className="list-disc ml-6">
                    {profile.permissions && profile.permissions.length > 0 && Object.entries(profile.permissions[0]).map(([key, value]) => (
                      <li key={key}>{key}: {value ? 'Yes' : 'No'}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {/* Theme & Preferences Card */}
              <div className="card">
                <div className="card-body">
                  <h3 className="text-lg font-semibold mb-4">Theme & Preferences</h3>
                  <div className="form-group mb-4">
                    <label className="form-label">Theme</label>
                    <select value={formTheme} onChange={handleThemeChange} className="form-select">
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                  <div className="form-group mb-4">
                    <label className="form-label">Accent Color</label>
                    <div className="flex items-center gap-4 mt-2">
                      <HexColorPicker color={formAccentColor} onChange={handleAccentColorChange} style={{ width: 180, height: 180 }} />
                      <div className="flex flex-col items-center ml-4">
                        <span className="mb-2">Current</span>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: formAccentColor, border: '2px solid #ccc' }} />
                        <span className="mt-2 text-xs">{formAccentColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Column Preferences Card */}
              <div className="card" ref={columnPrefsCardRef}>
                <div className="card-body">
                  <h4 className="mb-2 font-semibold">Column Preferences</h4>
                  <div className="flex gap-4 column-prefs-layout">
                    {/* Available Columns */}
                    <div className="flex-1">
                      <div className="font-medium mb-1">Available</div>
                      <ul
                        className="border rounded h-48 overflow-y-auto p-0"
                        style={{
                          listStyle: 'none',
                          margin: 0,
                          paddingLeft: 0,
                          fontSize: '0.97rem',
                        }}
                      >
                        {availableColumns.map((col, idx) => (
                          <li
                            key={col.key}
                            style={{
                              background: selectedAvailable === col.key ? accentBg : 'transparent',
                              color: selectedAvailable === col.key ? accentText : themeText,
                              borderBottom: idx !== availableColumns.length - 1 ? `1px solid ${borderColor}` : 'none',
                              padding: '6px 12px 6px 6px', // top right bottom left
                              cursor: 'pointer',
                              transition: 'background 0.2s, color 0.2s',
                              fontSize: '0.97rem',
                            }}
                            onClick={() => setSelectedAvailable(col.key)}
                          >
                            {col.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Controls */}
                    <div className="flex flex-col justify-center gap-2 column-prefs-controls">
                      <button className="btn btn-secondary" style={{background: accentBg, color: accentText, borderColor: accentBg}} onClick={handleAddColumn} disabled={!selectedAvailable}> &gt;&gt; </button>
                      <button className="btn btn-secondary" style={{background: accentBg, color: accentText, borderColor: accentBg}} onClick={handleRemoveColumn} disabled={!selectedVisible}> &lt;&lt; </button>
                      <button className="btn btn-secondary" style={{background: accentBg, color: accentText, borderColor: accentBg}} onClick={handleMoveUp} disabled={!selectedVisible}> ↑ </button>
                      <button className="btn btn-secondary" style={{background: accentBg, color: accentText, borderColor: accentBg}} onClick={handleMoveDown} disabled={!selectedVisible}> ↓ </button>
                    </div>
                    {/* Visible Columns */}
                    <div className="flex-1">
                      <div className="font-medium mb-1">Visible</div>
                      <ul
                        className="border rounded h-48 overflow-y-auto p-0"
                        style={{
                          listStyle: 'none',
                          margin: 0,
                          paddingLeft: 0,
                          fontSize: '0.97rem',
                        }}
                      >
                        {visibleColumns.map((col, idx) => (
                          <li
                            key={col.key}
                            style={{
                              background: selectedVisible === col.key ? accentBg : 'transparent',
                              color: selectedVisible === col.key ? accentText : themeText,
                              borderBottom: idx !== visibleColumns.length - 1 ? `1px solid ${borderColor}` : 'none',
                              padding: '6px 12px 6px 6px', // top right bottom left
                              cursor: 'pointer',
                              transition: 'background 0.2s, color 0.2s',
                              fontSize: '0.97rem',
                            }}
                            onClick={() => setSelectedVisible(col.key)}
                          >
                            {col.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <button className="btn btn-primary mt-4 w-full" style={{background: accentBg, color: accentText, borderColor: accentBg}} onClick={handlePrefsSave} disabled={savingPrefs}>
                    {savingPrefs ? 'Saving...' : 'Save Preferences'}
                  </button>
                  {prefsMessage && <div className="text-green-600 mt-2">{prefsMessage}</div>}
                </div>
              </div>
              {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>}
              {success && <div className="p-3 mb-4 bg-green-50 border border-green-200 rounded text-green-700">{success}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileSidebar; 