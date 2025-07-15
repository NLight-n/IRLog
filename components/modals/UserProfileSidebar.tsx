import React, { useEffect, useState, useContext, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { HexColorPicker } from 'react-colorful';
import { useTheme } from '../../lib/theme/ThemeContext';
import { ColumnContext, defaultColumns } from '../../lib/columnContext';

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

  // New state for column preferences
  const [visibleColumns, setVisibleColumns] = useState<any[]>([]);
  const [selectedAvailable, setSelectedAvailable] = useState<string | null>(null);
  const [selectedVisible, setSelectedVisible] = useState<string | null>(null);

  // Compute available columns as those not in visibleColumns
  const availableColumns = defaultColumns.filter(
    dc => !visibleColumns.some(vc => vc.key === dc.key)
  );

  const columnPrefsCardRef = useRef<HTMLDivElement>(null);

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
      await signOut({ callbackUrl: '/login' });
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
      className={`fixed inset-0 z-50 flex justify-end transition-all ${open ? '' : 'pointer-events-none'}`}
      style={{ background: open ? 'rgba(0,0,0,0.3)' : 'transparent', visibility: open ? 'visible' : 'hidden' }}
      onClick={onClose}
    >
      <div
        className={`bg-gray-50 dark:bg-gray-900 shadow-lg h-full w-full max-w-md transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ minWidth: 350, maxWidth: 420 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold">User Profile</h2>
          <button onClick={onClose} className="text-2xl font-bold text-gray-500 hover:text-gray-800">×</button>
        </div>
        <div className="space-y-6 p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)' }}>
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
                  <div className="flex gap-4">
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
                    <div className="flex flex-col justify-center gap-2">
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