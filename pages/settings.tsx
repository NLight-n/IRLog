import React, { useState, useEffect, useRef } from 'react';
import NavBar from '../components/layout/NavBar';
import { useSession } from 'next-auth/react';
import { useTheme } from '../lib/theme/ThemeContext';
import { ColumnContext } from '../lib/columnContext';
import { useAppSettings } from './_app';
import { useRouter } from 'next/router';

const TABS = [
  { label: 'Physicians', value: 'physicians' },
  { label: 'Procedures', value: 'procedures' },
  { label: 'Data Log', value: 'datalog' },
  { label: 'About', value: 'about' },
  // Admin tab will be conditionally rendered
];

// --- AdminTab Component ---
function AdminTab({ user, onUpdateAppHeading, onUpdateLogo }: { user: unknown, onUpdateAppHeading: (heading: string, subheading: string) => void, onUpdateLogo: (logo: string) => void }) {
  const [currency, setCurrency] = React.useState('$');
  const [dateFormat, setDateFormat] = React.useState('DD/MM/YYYY');
  const [appHeading, setAppHeading] = React.useState('Interventional Radiology Register');
  const [timeFormat, setTimeFormat] = React.useState('24hr');
  const [appSubheading, setAppSubheading] = React.useState('');
  const [appLogo, setAppLogo] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');
  const [logoUploading, setLogoUploading] = React.useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Fetch settings from backend
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.currency) setCurrency(data.currency);
        if (data.dateFormat) setDateFormat(data.dateFormat);
        if (data.appHeading) setAppHeading(data.appHeading);
        if (data.timeFormat) setTimeFormat(data.timeFormat);
        if (data.appSubheading) setAppSubheading(data.appSubheading);
        // Use /api/logo endpoint if logo exists
        if (data.hasLogo) {
          setAppLogo(`/api/logo?t=${Date.now()}`);
        } else {
          setAppLogo('');
        }
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, appHeading, appSubheading, dateFormat, timeFormat }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setSuccess('Settings saved!');
      onUpdateAppHeading(appHeading, appSubheading);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to upload logo');

      // Update local state and parent with new logo URL
      const newLogoUrl = `/api/logo?t=${Date.now()}`;
      setAppLogo(newLogoUrl);
      onUpdateLogo(newLogoUrl);
      setSuccess('Logo uploaded successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to upload logo');
      }
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleLogoRemove = async () => {
    if (!window.confirm('Remove the logo?')) return;

    setLogoUploading(true);
    setError('');
    try {
      const res = await fetch('/api/upload-logo', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove logo');

      setAppLogo('');
      onUpdateLogo('');
      setSuccess('Logo removed!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to remove logo');
      }
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">System Settings</h3>

      {/* Logo Upload Section - Outside the grid */}
      <div className="mb-6">
        <label className="block font-medium mb-2">App Logo</label>
        <div className="flex items-center gap-4">
          {appLogo ? (
            <div className="flex items-center gap-4">
              <img
                src={appLogo}
                alt=""
                onError={() => setAppLogo('')}
                style={{
                  height: '48px',
                  width: 'auto',
                  maxWidth: '120px',
                  objectFit: 'contain',
                  borderRadius: '4px',
                  border: '1px solid var(--color-gray-200)',
                }}
              />
              <button
                onClick={handleLogoRemove}
                disabled={logoUploading}
                className="btn btn-danger btn-sm"
              >
                Remove
              </button>
            </div>
          ) : (
            <span className="text-gray-500 text-sm">No logo uploaded</span>
          )}
          <div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleLogoUpload}
              disabled={logoUploading}
              className="form-input"
              style={{ maxWidth: '250px' }}
            />
            {logoUploading && (
              <span className="ml-2 text-sm text-gray-500">Uploading...</span>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">Recommended: PNG or JPG, max 1MB. Logo will appear in the top bar.</p>
      </div>

      {/* Other settings in 2-column grid */}
      <div className="general-settings-grid">
        <div className="mb-2">
          <label className="block font-medium mb-1">App Heading</label>
          <input className="form-input" value={appHeading} onChange={e => setAppHeading(e.target.value)} />
        </div>
        <div className="mb-2">
          <label className="block font-medium mb-1">App Subheading</label>
          <input className="form-input" value={appSubheading} onChange={e => setAppSubheading(e.target.value)} />
        </div>

        <div className="mb-2">
          <label className="block font-medium mb-1">Date Format</label>
          <select className="form-input" value={dateFormat} onChange={e => setDateFormat(e.target.value)}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD-MM-YYYY">DD-MM-YYYY</option>
          </select>
        </div>
        <div className="mb-2">
          <label className="block font-medium mb-1">Time Format</label>
          <select className="form-input" value={timeFormat} onChange={e => setTimeFormat(e.target.value)}>
            <option value="24hr">24 hour</option>
            <option value="12hr">12 hour (AM/PM)</option>
          </select>
        </div>

        <div className="mb-2">
          <label className="block font-medium mb-1">Currency</label>
          <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="$">Dollar $</option>
            <option value="₹">Rupee ₹</option>
            <option value="£">Pound £</option>
            <option value="€">Euro €</option>
          </select>
        </div>
        <div className="mb-2">
          <label className="block font-medium mb-1">&nbsp;</label>
          <div className="flex items-center gap-3">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            {success && <span className="text-green-600">{success}</span>}
            {error && <span className="text-red-600">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState('physicians');
  const [adminSubtab, setAdminSubtab] = useState('system-settings');
  const { data: session } = useSession();
  const isAdmin = (session?.user && (session.user as unknown as { permissions?: { manageUsers?: boolean } })?.permissions?.manageUsers);
  const { theme, setTheme, accentColor } = useTheme();
  const { columns, setColumns } = React.useContext(ColumnContext);
  const { appHeading, setAppHeading, appSubheading, setAppSubheading, appLogo, setAppLogo, refreshSettings } = useAppSettings();
  const router = useRouter();
  const navbarRef = useRef<HTMLDivElement>(null);
  const [navbarHeight, setNavbarHeight] = useState(0);
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

  // Add onToggleTheme handler
  const onToggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  // Update app heading everywhere
  const handleUpdateAppHeading = (heading: string, subheading: string) => {
    setAppHeading(heading);
    setAppSubheading(subheading);
    if (typeof window !== 'undefined') {
      (window as unknown as { __APP_HEADING__?: string; __APP_SUBHEADING__?: string }).__APP_HEADING__ = heading;
      (window as unknown as { __APP_HEADING__?: string; __APP_SUBHEADING__?: string }).__APP_SUBHEADING__ = subheading;
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50${theme === 'dark' ? ' dark' : ''}`}>
      <NavBar ref={navbarRef} user={session?.user || null} theme={theme} onToggleTheme={onToggleTheme} appHeading={appHeading} appSubheading={appSubheading} appLogo={appLogo} />
      <div className="container" style={{ paddingTop: navbarHeight + 8 }}>
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure system preferences and manage data</p>
        </div>
        {/* Tab Navigation */}
        <div className="card mb-6">
          <div className="card-body">
            <div className="flex flex-wrap gap-2">
              {TABS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`btn ${tab === t.value ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {t.label}
                </button>
              ))}
              {isAdmin && (
                <button
                  key="admin"
                  onClick={() => setTab('user-management')}
                  className={`btn ${tab === 'user-management' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Admin
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Tab Content */}
        <div className="card">
          <div className="card-body">
            {/* General Settings removed */}
            {tab === 'physicians' && <PhysicianManagement />}
            {tab === 'procedures' && <ProcedureManagement />}
            {tab === 'datalog' && <DataLog navbarHeight={navbarHeight} />}
            {tab === 'about' && (
              <div>
                <h3 className="mb-4">About IR Log</h3>
                <p>
                  <strong>IR Log</strong> is a comprehensive Interventional Radiology Procedure Register and Analytics application designed for hospital and clinical use. It allows you to:
                </p>
                <ul className="mb-4" style={{ marginLeft: 24 }}>
                  <li>• Securely log and manage all IR procedures with patient details, modalities, and outcomes.</li>
                  <li>• Track referring and performing physicians, procedure notes, and follow-ups.</li>
                  <li>• Analyze trends with built-in analytics: monthly, yearly, by modality, and by physician.</li>
                  <li>• Export data for reporting and compliance.</li>
                  <li>• Manage users, permissions, and customize settings for your department.</li>
                  <li>• Enjoy a modern, mobile-friendly interface with dark/light mode support.</li>
                </ul>
                <p>
                  <strong>Developed for:</strong> Interventional Radiology teams seeking efficient, auditable, and insightful digital record-keeping.<br />
                  <strong>For support or feedback:</strong> Contact Dr. Nishanth Gopal, Interventional Radiologist and a part time app developer.
                </p>
              </div>
            )}
            {tab === 'user-management' && isAdmin && (
              <>
                {/* Admin Subtab Navigation */}
                <div className="flex gap-2 mb-6 pb-4" style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
                  <button
                    onClick={() => setAdminSubtab('system-settings')}
                    className={`btn btn-sm ${adminSubtab === 'system-settings' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    System Settings
                  </button>
                  <button
                    onClick={() => setAdminSubtab('user-management')}
                    className={`btn btn-sm ${adminSubtab === 'user-management' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    User Management
                  </button>
                  <button
                    onClick={() => setAdminSubtab('backup')}
                    className={`btn btn-sm ${adminSubtab === 'backup' ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    Backup
                  </button>
                </div>
                {/* Admin Subtab Content */}
                {adminSubtab === 'system-settings' && (
                  <AdminTab user={session?.user} onUpdateAppHeading={handleUpdateAppHeading} onUpdateLogo={setAppLogo} />
                )}
                {adminSubtab === 'user-management' && (
                  <UserManagement navbarHeight={navbarHeight} />
                )}
                {adminSubtab === 'backup' && (
                  <BackupRestore />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom ConfirmDialog for deletion
function ConfirmDialog({ open, message, onConfirm, onCancel }: { open: boolean, message: string, onConfirm: () => void, onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
        <div className="flex items-center select-none mb-4">
          <span
            className="navbar-brand text-2xl font-extrabold"
            style={{
              fontFamily: `'Segoe UI', 'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif`,
              letterSpacing: '0.04em',
              color: 'var(--color-accent)',
              textShadow: 'none',
              background: 'none',
              WebkitBackgroundClip: 'unset',
              WebkitTextFillColor: 'unset',
              backgroundClip: 'unset',
              transition: 'color 0.3s',
            }}
          >
            Interventional Radiology Register
          </span>
        </div>
        <div className="mb-4 text-gray-900 dark:text-gray-100 whitespace-pre-line">{message}</div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function PhysicianManagement() {
  const { data: session } = useSession();
  const canEdit = (session?.user && (session.user as unknown as { permissions?: { editSettings?: boolean } })?.permissions?.editSettings);
  const [physicians, setPhysicians] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showModal, setShowModal] = React.useState(false);
  const [editData, setEditData] = React.useState<any>(null);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [confirmMsg, setConfirmMsg] = React.useState('');
  const [pendingDeleteID, setPendingDeleteID] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetchPhysicians();
  }, []);

  function fetchPhysicians() {
    setLoading(true);
    fetch('/api/procedures/physician')
      .then(res => res.json())
      .then(setPhysicians)
      .catch(() => setError('Failed to load physicians'))
      .finally(() => setLoading(false));
  }

  function handleAdd() {
    setEditData(null);
    setShowModal(true);
  }

  function handleEdit(row: any) {
    setEditData(row);
    setShowModal(true);
  }

  async function handleDelete(physicianID: number) {
    // Check for related procedure logs
    const logsRes = await fetch(`/api/procedures/user?refPhysician=${physicianID}`);
    let logCount = 0;
    if (logsRes.ok) {
      const logs = await logsRes.json();
      logCount = Array.isArray(logs) ? logs.length : 0;
    }
    let msg = 'Delete this physician?';
    if (logCount > 0) {
      msg = `Warning: There are multiple procedure log entries with this physician as referring physician.\nDeleting will leave those entries with an empty referring physician.\n\nAre you sure you want to delete?`;
    }
    setConfirmMsg(msg);
    setPendingDeleteID(physicianID);
    setShowConfirm(true);
  }

  async function confirmDelete() {
    if (!pendingDeleteID) return;
    setShowConfirm(false);
    const res = await fetch('/api/procedures/physician', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ physicianID: pendingDeleteID }),
    });
    setPendingDeleteID(null);
    if (res.ok) fetchPhysicians();
    else setError('Failed to delete');
  }

  function cancelDelete() {
    setShowConfirm(false);
    setPendingDeleteID(null);
  }

  async function handleSave(form: any) {
    const isEdit = !!editData;
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch('/api/procedures/physician', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { ...form, physicianID: editData.physicianID } : form),
    });
    if (res.ok) {
      setShowModal(false);
      fetchPhysicians();
    } else {
      setError('Failed to save');
    }
  }

  const irs = physicians.filter((p: any) => p.role === 'IR');
  // Sort referring physicians alphabetically by name
  const referrers = physicians.filter((p: any) => p.role === 'Referrer').sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div>
      <ConfirmDialog open={showConfirm} message={confirmMsg} onConfirm={confirmDelete} onCancel={cancelDelete} />
      <div className="flex justify-between items-center mb-6" style={{ paddingLeft: 16, paddingTop: 16, paddingRight: 16 }}>
        <h3>Physician Management</h3>
        {canEdit && (
          <button onClick={handleAdd} className="btn btn-primary">
            + Add Physician
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 mb-6 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-4">Loading physicians...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Interventional Radiologists */}
          <div>
            <h4 className="mb-4 text-lg font-medium" style={{ paddingLeft: 16, paddingTop: 16 }}>Interventional Radiologists</h4>
            <div className="card">
              <div className="card-body p-0">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Credentials</th>
                        <th>Department</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {irs.map((p: any) => (
                        <tr key={p.physicianID}>
                          <td className="font-medium">{p.name}</td>
                          <td>{p.credentials}</td>
                          <td>{p.department}</td>
                          <td>
                            <div className="flex gap-2">
                              {canEdit && (
                                <button onClick={() => handleEdit(p)} className="btn btn-secondary btn-sm">
                                  Edit
                                </button>
                              )}
                              {canEdit && (
                                <button onClick={() => handleDelete(p.physicianID)} className="btn btn-danger btn-sm">
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {irs.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No interventional radiologists found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Referring Physicians */}
          <div>
            <h4 className="mb-4 text-lg font-medium" style={{ paddingLeft: 16, paddingTop: 16 }}>Referring Physicians</h4>
            <div className="card">
              <div className="card-body p-0">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Credentials</th>
                        <th>Department</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrers.map((p: any) => (
                        <tr key={p.physicianID}>
                          <td className="font-medium">{p.name}</td>
                          <td>{p.credentials}</td>
                          <td>{p.department}</td>
                          <td>
                            <div className="flex gap-2">
                              {canEdit && (
                                <button onClick={() => handleEdit(p)} className="btn btn-secondary btn-sm">
                                  Edit
                                </button>
                              )}
                              {canEdit && (
                                <button onClick={() => handleDelete(p.physicianID)} className="btn btn-danger btn-sm">
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {referrers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No referring physicians found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <PhysicianModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          initialData={editData}
        />
      )}
    </div>
  );
}

function PhysicianModal({ open, onClose, onSave, initialData }: any) {
  const safeInitialData = initialData || {};
  const [form, setForm] = React.useState<any>({
    name: '',
    credentials: '',
    department: '',
    role: '',
    ...safeInitialData,
  });

  React.useEffect(() => {
    if (open) {
      setForm({
        name: '',
        credentials: '',
        department: '',
        role: '',
        ...safeInitialData,
      });
    }
  }, [open, initialData]);

  function handleChange(e: any) {
    const { name, value } = e.target;
    setForm((f: any) => ({ ...f, [name]: value }));
  }

  function handleSubmit(e: any) {
    e.preventDefault();
    onSave(form);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card max-w-md w-full mx-4">
        <div className="card-header">
          <h3 className="text-lg font-semibold">
            {safeInitialData.physicianID ? 'Edit' : 'Add'} Physician
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="card-body">
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter physician name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Credentials</label>
              <input
                name="credentials"
                value={form.credentials}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="e.g., MD, PhD"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Department</label>
              <input
                name="department"
                value={form.department}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter department"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                className="form-select"
              >
                <option value="">Select Role</option>
                <option value="IR">Interventional Radiologist</option>
                <option value="Referrer">Referring Physician</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button type="submit" className="btn btn-primary flex-1">
              Save
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProcedureManagement() {
  const { data: session } = useSession();
  const canEdit = (session?.user && (session.user as unknown as { permissions?: { editSettings?: boolean } })?.permissions?.editSettings);
  const [procedures, setProcedures] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showModal, setShowModal] = React.useState(false);
  const [editData, setEditData] = React.useState<any>(null);
  const [currency, setCurrency] = React.useState('$');

  // Filter state
  const [procedureNameFilter, setProcedureNameFilter] = React.useState('');

  // Sorting state
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  // Filtered and sorted procedures
  const filteredProcedures = procedures
    .filter((p: any) => {
      if (procedureNameFilter && !p.procedureName.toLowerCase().includes(procedureNameFilter.toLowerCase())) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const aName = a.procedureName.toLowerCase();
      const bName = b.procedureName.toLowerCase();
      if (aName > bName) return sortDirection === 'asc' ? 1 : -1;
      if (aName < bName) return sortDirection === 'asc' ? -1 : 1;
      return 0;
    });

  const clearFilters = () => {
    setProcedureNameFilter('');
  };

  React.useEffect(() => {
    fetchProcedures();
    fetchCurrency();
  }, []);

  function fetchProcedures() {
    setLoading(true);
    fetch('/api/procedures/procedure')
      .then(res => res.json())
      .then(setProcedures)
      .catch(() => setError('Failed to load procedures'))
      .finally(() => setLoading(false));
  }

  function fetchCurrency() {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.currency) setCurrency(data.currency);
      });
  }

  function handleAdd() {
    setEditData(null);
    setShowModal(true);
  }

  function handleEdit(row: any) {
    setEditData(row);
    setShowModal(true);
  }

  async function handleDelete(proID: number) {
    if (!window.confirm('Delete this procedure?')) return;
    const res = await fetch('/api/procedures/procedure', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proID }),
    });
    if (res.ok) fetchProcedures();
    else setError('Failed to delete');
  }

  async function handleSave(form: any) {
    const isEdit = !!editData;
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch('/api/procedures/procedure', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { ...form, proID: editData.proID } : form),
    });
    if (res.ok) {
      setShowModal(false);
      fetchProcedures();
    } else {
      setError('Failed to save');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6" style={{ paddingLeft: 16, paddingTop: 16, paddingRight: 16 }}>
        <h3>Procedure Management</h3>
        {canEdit && (
          <button onClick={handleAdd} className="btn btn-primary">
            + Add Procedure
          </button>
        )}
      </div>
      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 12, paddingLeft: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200 }}>
          <label className="block text-sm font-medium mb-1">Procedure Name</label>
          <input
            className="form-input w-full"
            type="text"
            placeholder="Search procedure name"
            value={procedureNameFilter}
            onChange={e => setProcedureNameFilter(e.target.value)}
          />
        </div>
        <div style={{ minWidth: 120, marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={clearFilters}>Clear Filters</button>
        </div>
      </div>


      {error && (
        <div className="p-3 mb-6 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-4">Loading procedures...</span>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                    >
                      Procedure Name
                      <span style={{ marginLeft: 4, fontSize: 12 }}>
                        {sortDirection === 'asc' ? '▼' : '▲'}
                      </span>
                    </th>
                    <th>Cost</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcedures.map((p: any) => (
                    <tr key={p.proID}>
                      <td className="font-medium">{p.procedureName}</td>
                      <td>{p.procedureCost ? `${currency}${p.procedureCost}` : '-'}</td>
                      <td>
                        <div className="flex gap-2">
                          {canEdit && (
                            <button onClick={() => handleEdit(p)} className="btn btn-secondary btn-sm">
                              Edit
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => handleDelete(p.proID)} className="btn btn-danger btn-sm">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {procedures.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No procedures found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ProcedureModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          initialData={editData}
        />
      )}
    </div>
  );
}

function ProcedureModal({ open, onClose, onSave, initialData }: any) {
  const safeInitialData = initialData || {};
  const [form, setForm] = React.useState<any>({
    procedureName: '',
    procedureCost: '',
    ...safeInitialData,
  });

  React.useEffect(() => {
    if (open) {
      setForm({
        procedureName: '',
        procedureCost: '',
        ...safeInitialData,
      });
    }
  }, [open, initialData]);

  function handleChange(e: any) {
    const { name, value } = e.target;
    setForm((f: any) => ({ ...f, [name]: value }));
  }

  function handleSubmit(e: any) {
    e.preventDefault();
    onSave(form);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card max-w-md w-full mx-4">
        <div className="card-header">
          <h3 className="text-lg font-semibold">
            {safeInitialData.proID ? 'Edit' : 'Add'} Procedure
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="card-body">
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">Procedure Name</label>
              <input
                name="procedureName"
                value={form.procedureName || ''}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter procedure name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cost</label>
              <input
                name="procedureCost"
                type="number"
                value={form.procedureCost || ''}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="form-input"
                placeholder="0.00 (optional)"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button type="submit" className="btn btn-primary flex-1">
              Save
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DataLog({ navbarHeight = 0 }: { navbarHeight?: number }) {
  const { data: session } = useSession();
  const canView = (session?.user && (session.user as unknown as { permissions?: { viewOnly?: boolean } })?.permissions?.viewOnly);
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [filters, setFilters] = React.useState({
    actionType: '',
    affectedTable: '',
    userID: '',
    dateFrom: '',
    dateTo: '',
  });
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [showModal, setShowModal] = React.useState(false);
  const [selectedLog, setSelectedLog] = React.useState<any>(null);
  const [users, setUsers] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetchLogs();
  }, [filters, pagination.page]);

  React.useEffect(() => {
    // Fetch users for the User filter dropdown
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data);
        else if (data.users) setUsers(data.users);
      })
      .catch(() => setUsers([]));
  }, []);

  function fetchLogs() {
    setLoading(true);
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      ...filters,
    });

    fetch(`/api/audit-log?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.logs) {
          setLogs(data.logs);
          setPagination(prev => ({
            ...prev,
            total: data.total,
            totalPages: data.totalPages,
          }));
        } else {
          setLogs([]);
        }
      })
      .catch((error) => {
        console.error('Error fetching audit logs:', error);
        setError('Failed to load audit logs');
      })
      .finally(() => setLoading(false));
  }

  function handleFilterChange(key: string, value: string) {
    let newValue = value;
    if (key === 'dateTo' && value) {
      // If the value is already in YYYY-MM-DD format, append T23:59:59.999
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        newValue = value + 'T23:59:59.999';
      }
    }
    if (key === 'dateFrom' && value) {
      // If the value is already in YYYY-MM-DD format, append T00:00:00.000
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        newValue = value + 'T00:00:00.000';
      }
    }
    setFilters(prev => ({ ...prev, [key]: newValue }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  function handlePageChange(page: number) {
    setPagination(prev => ({ ...prev, page }));
  }

  function handleViewDetails(log: any) {
    setSelectedLog(log);
    setShowModal(true);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  const actionTypes = ['CREATE', 'UPDATE', 'DELETE'];
  const tableNames = ['ProcedureLog', 'Procedure', 'Physician', 'User', 'WorkItem'];
  const tableDisplayNames: { [key: string]: string } = {
    'ProcedureLog': 'Procedure Log',
    'Procedure': 'Procedure',
    'Physician': 'Physician',
    'User': 'User',
    'WorkItem': 'Worklist',
  };

  if (!canView) {
    return (
      <div>
        <h3 className="mb-6" style={{ paddingLeft: 16, paddingTop: 16 }}>Data Log</h3>
        <div className="card">
          <div className="card-body">
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-4">🔒</div>
              <h4 className="text-lg font-medium mb-2">Access Denied</h4>
              <p>You don't have permission to view the audit trail. Contact your administrator for access.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-6" style={{ paddingLeft: 16, paddingTop: 16 }}>Data Log</h3>
      {/* Filters */}
      <div className="card mb-6">
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 className="text-lg font-medium">Filters</h4>
            <button
              onClick={() => {
                setFilters({
                  actionType: '',
                  affectedTable: '',
                  userID: '',
                  dateFrom: '',
                  dateTo: '',
                });
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="btn btn-secondary"
            >
              Clear Filters
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 180 }}>
              <label className="block text-sm font-medium mb-1">Action Type</label>
              <select
                className="form-input w-full"
                value={filters.actionType}
                onChange={(e) => handleFilterChange('actionType', e.target.value)}
              >
                <option value="">All Actions</option>
                {actionTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 180 }}>
              <label className="block text-sm font-medium mb-1">Table</label>
              <select
                className="form-input w-full"
                value={filters.affectedTable}
                onChange={(e) => handleFilterChange('affectedTable', e.target.value)}
              >
                <option value="">All Tables</option>
                {tableNames.map(table => (
                  <option key={table} value={table}>{tableDisplayNames[table] || table}</option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 180 }}>
              <label className="block text-sm font-medium mb-1">User</label>
              <select
                className="form-input w-full"
                value={filters.userID}
                onChange={e => handleFilterChange('userID', e.target.value)}
              >
                <option value="">All Users</option>
                {users.length === 0 ? (
                  <option value="" disabled>No users found</option>
                ) : (
                  users.map((u: any) => (
                    <option key={u.userID || u.id} value={u.userID || u.id}>{u.username || u.name || u.email}</option>
                  ))
                )}
              </select>
            </div>
            <div style={{ minWidth: 180 }}>
              <label className="block text-sm font-medium mb-1">Date From</label>
              <input
                type="date"
                className="form-input w-full"
                value={filters.dateFrom ? filters.dateFrom.slice(0, 10) : ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            <div style={{ minWidth: 180 }}>
              <label className="block text-sm font-medium mb-1">Date To</label>
              <input
                type="date"
                className="form-input w-full"
                value={filters.dateTo ? filters.dateTo.slice(0, 10) : ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 mb-6 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-4">Loading audit logs...</span>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Table</th>
                    <th>Identifier</th>
                    {/* Removed Actions column */}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.logID}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleViewDetails(log)}
                    >
                      <td>{formatDate(log.timestamp)}</td>
                      <td>{log.user?.username || 'Unknown'}</td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${log.actionType === 'CREATE' ? 'bg-green-100 text-green-800' :
                            log.actionType === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                              log.actionType === 'DELETE' ? 'bg-red-200' :
                                ''
                            }`}
                          style={log.actionType === 'DELETE' ? { color: '#b91c1c', fontWeight: 500 } : {}}
                        >
                          {log.actionType}
                        </span>
                      </td>
                      <td>{log.affectedTable}</td>
                      <td>{(() => {
                        const table = log.affectedTable;
                        const data = log.dataAfter || log.dataBefore || {};
                        if (table === 'ProcedureLog') return data.patientName || log.affectedRowID;
                        if (table === 'WorkItem') return data.patientName || log.affectedRowID;
                        if (table === 'Physician') return data.name || log.affectedRowID;
                        if (table === 'Procedure') return data.procedureName || log.affectedRowID;
                        if (table === 'User') return data.username || log.affectedRowID;
                        return log.affectedRowID;
                      })()}</td>
                      {/* Removed Actions cell */}
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No audit logs found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <span className="flex items-center px-4">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showModal && selectedLog && (
        <AuditLogModal
          open={showModal}
          onClose={() => setShowModal(false)}
          log={selectedLog}
          navbarHeight={navbarHeight}
        />
      )}
    </div>
  );
}

function AuditLogModal({ open, onClose, log, navbarHeight = 0 }: { open: boolean, onClose: () => void, log: any, navbarHeight?: number }) {
  if (!open) return null;

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  function getTableDisplayName(tableName: string): string {
    const tableNames: { [key: string]: string } = {
      'ProcedureLog': 'Procedure Log',
      'Procedure': 'Procedure',
      'Physician': 'Physician',
      'User': 'User',
      'Permission': 'Permission',
    };
    return tableNames[tableName] || tableName;
  }

  function getActionDisplayName(actionType: string): string {
    const actionNames: { [key: string]: string } = {
      'CREATE': 'Created',
      'UPDATE': 'Updated',
      'DELETE': 'Deleted',
    };
    return actionNames[actionType] || actionType;
  }

  // Function to format data for display based on the reference format
  function formatDataForDisplay(data: any, tableName: string) {
    if (!data) return null;
    if (tableName === 'ProcedureLog') {
      // Handle doneBy array properly
      let doneByDisplay = '';
      if (data.doneBy) {
        if (Array.isArray(data.doneBy)) {
          doneByDisplay = data.doneBy.map((d: any) => {
            if (typeof d === 'object' && d.physician) {
              return d.physician.name || d.physician.physicianName || '';
            } else if (typeof d === 'object' && d.name) {
              return d.name;
            } else if (typeof d === 'string') {
              return d;
            }
            return '';
          }).filter(Boolean).join(', ');
        } else if (typeof data.doneBy === 'string') {
          doneByDisplay = data.doneBy;
        }
      }
      let refPhysicianDisplay = '';
      if (data.refPhysicianObj) {
        if (typeof data.refPhysicianObj === 'object') {
          refPhysicianDisplay = data.refPhysicianObj.name || data.refPhysicianObj.physicianName || '';
        } else {
          refPhysicianDisplay = String(data.refPhysicianObj);
        }
      }
      let createdByDisplay = '';
      if (data.createdById) {
        if (typeof data.createdById === 'object' && data.createdById.username) {
          createdByDisplay = data.createdById.username;
        } else if (typeof data.createdById === 'object' && data.createdById.name) {
          createdByDisplay = data.createdById.name;
        } else {
          createdByDisplay = String(data.createdById);
        }
      }
      let updatedByDisplay = '';
      if (data.updatedById) {
        if (typeof data.updatedById === 'object' && data.updatedById.username) {
          updatedByDisplay = data.updatedById.username;
        } else if (typeof data.updatedById === 'object' && data.updatedById.name) {
          updatedByDisplay = data.updatedById.name;
        } else {
          updatedByDisplay = String(data.updatedById);
        }
      }
      return {
        notes: data.notes || null,
        doneBy: doneByDisplay,
        followUp: data.followUp || '',
        createdAt: data.createdAt,
        diagnosis: data.diagnosis || '',
        patientID: data.patientID || '',
        procedureName: data.procedureName || '',
        status: data.status || '',
        modality: data.modality || '',
        updatedAt: data.updatedAt,
        patientAge: data.patientAge || '',
        patientSex: data.patientSex || '',
        createdById: createdByDisplay,
        patientName: data.patientName || '',
        updatedById: updatedByDisplay,
        procedureCost: data.procedureCost || '',
        procedureDate: data.procedureDate || '',
        procedureTime: data.procedureTime || '',
        refPhysicianObj: refPhysicianDisplay,
        procedureNotesText: data.procedureNotesText || ''
      };
    }
    // For other tables, return the data as is but remove IDs
    const cleaned = { ...data };
    delete cleaned.id;
    delete cleaned.userID;
    delete cleaned.procedureID;
    delete cleaned.physicianID;
    delete cleaned.proID;
    return cleaned;
  }

  function renderSideBySideTable(before: any, after: any) {
    // Desired field order (including Created At, Created By Id, Updated At, Updated By Id)
    const fieldOrder = [
      'createdAt',
      'createdById',
      'patientID',
      'patientName',
      'patientAge',
      'patientSex',
      'procedureName',
      'status',
      'modality',
      'diagnosis',
      'doneBy',
      'refPhysicianObj',
      'procedureDate',
      'procedureTime',
      'procedureCost',
      'procedureNotesText',
      'followUp',
      'notes',
      'updatedAt',
      'updatedById',
    ];
    // Get all unique fields from both before and after
    const beforeFields = before ? Object.keys(formatDataForDisplay(before, log.affectedTable) || {}) : [];
    const afterFields = after ? Object.keys(formatDataForDisplay(after, log.affectedTable) || {}) : [];
    const allFieldsSet = new Set([...beforeFields, ...afterFields]);
    // Sort fields by desired order, then any extras
    const allFields = [
      ...fieldOrder.filter(f => allFieldsSet.has(f)),
      ...Array.from(allFieldsSet).filter(f => !fieldOrder.includes(f)),
    ];
    const beforeData = formatDataForDisplay(before, log.affectedTable) || {};
    const afterData = formatDataForDisplay(after, log.affectedTable) || {};
    return (
      <div className="bg-gray-50 dark:bg-gray-900 dark:text-gray-100 rounded p-4 border">
        <table className="table-fixed text-sm" style={{ width: '640px' }}>
          <thead>
            <tr>
              <td colSpan={3} className="text-xs text-gray-500 pb-2">
                Table: {getTableDisplayName(log.affectedTable)} &nbsp; | &nbsp; User: {log.user?.username || 'Unknown'}
              </td>
            </tr>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 px-2 font-semibold text-gray-700" style={{ width: '160px', minWidth: '160px', maxWidth: '160px' }}>Field</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700" style={{ width: '240px', minWidth: '240px', maxWidth: '240px' }}>Data Before</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-700" style={{ width: '240px', minWidth: '240px', maxWidth: '240px' }}>Data After</th>
            </tr>
          </thead>
          <tbody>
            {allFields.map((key) => {
              let beforeValue = beforeData[key];
              let afterValue = afterData[key];
              // Format values
              const formatValue = (value: any, field: string) => {
                if (value === null || value === undefined || value === '') return '';
                if (typeof value === 'object' && value !== null) {
                  // Special pretty print for 'procedure' and other objects
                  return (
                    <div className="whitespace-pre-line break-words">
                      {Object.entries(value).map(([k, v]) => (
                        <div key={k}>
                          <span className="font-semibold">{k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span> {String(v)}
                        </div>
                      ))}
                    </div>
                  );
                }
                if (typeof value === 'boolean') return value ? 'Yes' : 'No';
                if (field === 'createdAt' || field === 'updatedAt' || field === 'procedureDate') {
                  return new Date(value as string).toLocaleString();
                }
                return String(value);
              };
              // Compare for highlight
              const isChanged = JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
              // Inline style for highlight
              let highlightStyle = isChanged
                ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-contrast, #fff)' }
                : undefined;
              return (
                <tr
                  key={key}
                  className="border-b border-gray-200 hover:bg-gray-100"
                  style={highlightStyle}
                >
                  <td className="font-medium py-2 px-2 text-gray-700 break-words whitespace-pre-line align-top" style={{ width: '160px', minWidth: '160px', maxWidth: '160px' }}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase())}
                  </td>
                  <td className="py-2 px-2 text-gray-900 break-words whitespace-pre-line align-top" style={{ width: '240px', minWidth: '240px', maxWidth: '240px' }}>
                    {formatValue(beforeValue, key)}
                  </td>
                  <td className="py-2 px-2 text-gray-900 break-words whitespace-pre-line align-top" style={{ width: '240px', minWidth: '240px', maxWidth: '240px' }}>
                    {formatValue(afterValue, key)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (!open) return null;

  // Handler to close modal when clicking outside
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    onClose();
  }

  function handleModalContentClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-300 w-[50vw] max-w-[95vw] flex flex-col"
        style={{
          position: 'absolute',
          top: navbarHeight + 8,
          left: '50%',
          transform: 'translateX(-50%)',
          minWidth: '360px',
          maxWidth: '95vw',
          width: '56vw',
          maxHeight: `calc(100vh - ${navbarHeight + 16}px)`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1000
        }}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h4 className="font-medium text-lg" style={{ paddingTop: '16px', paddingLeft: '24px' }}>Log Information</h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-800 text-2xl font-bold focus:outline-none"
            style={{ lineHeight: 1, marginRight: '24px' }}
          >
            ×
          </button>
        </div>
        <div className="space-y-2 text-sm px-6 pt-4 pb-6 flex-shrink-0" style={{ paddingLeft: '24px', paddingBottom: '12px', paddingTop: '12px' }}>
          <div><span className="font-medium">Timestamp:</span> {formatDate(log.timestamp)}</div>
          <div><span className="font-medium">Action:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${log.actionType === 'CREATE' ? 'bg-green-100 text-green-800' :
              log.actionType === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                'bg-red-100 text-red-800'
              }`}>
              {getActionDisplayName(log.actionType)}
            </span>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingLeft: 24, paddingRight: 24, paddingBottom: navbarHeight }}>
          {renderSideBySideTable(log.dataBefore, log.dataAfter)}
        </div>
      </div>
    </div>
  );
}

function UserManagement({ navbarHeight = 0 }: { navbarHeight?: number }) {
  const { data: session } = useSession();
  const canEdit = (session?.user && (session.user as unknown as { permissions?: { manageUsers?: boolean } })?.permissions?.manageUsers);
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showModal, setShowModal] = React.useState(false);
  const [editData, setEditData] = React.useState<any>(null);

  React.useEffect(() => {
    fetchUsers();
  }, []);

  function fetchUsers() {
    setLoading(true);
    fetch('/api/procedures/user')
      .then(res => res.json())
      .then(setUsers)
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false));
  }

  function handleAdd() {
    setEditData(null);
    setShowModal(true);
  }

  async function handleEdit(row: any) {
    // Fetch the latest user data with permissions
    const res = await fetch(`/api/users/${row.userID}`);
    if (res.ok) {
      const user = await res.json();
      setEditData(user);
      setShowModal(true);
    } else {
      setError('Failed to load user details');
    }
  }

  async function handleDelete(userID: number) {
    if (!window.confirm('Delete this user?')) return;
    const res = await fetch('/api/procedures/user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userID }),
    });
    if (res.ok) fetchUsers();
    else setError('Failed to delete');
  }

  async function handleSave(form: any) {
    const isEdit = !!editData;
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    let res;
    if (isEdit) {
      // PATCH to /api/users/[id]
      res = await fetch(`/api/users/${editData.userID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      // POST to /api/procedures/user
      res = await fetch('/api/procedures/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    if (res.ok) {
      setShowModal(false);
      fetchUsers();
    } else {
      setError('Failed to save');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3>User Management</h3>
        {canEdit && (
          <button onClick={handleAdd} className="btn btn-primary">
            + Add User
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 mb-6 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <span className="ml-4">Loading users...</span>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Permissions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.userID}>
                      <td className="font-medium">{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {u.permissions && u.permissions.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(u.permissions[0])
                              .filter(([k, v]) =>
                                [
                                  'viewOnly',
                                  'createProcedureLog',
                                  'editProcedureLog',
                                  'editSettings',
                                  'manageUsers',
                                ].includes(k) && v === true
                              )
                              .map(([k]) => (
                                <span key={k} className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {k}
                                </span>
                              ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {canEdit && (
                            <button onClick={() => handleEdit(u)} className="btn btn-secondary btn-sm">
                              Edit
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => handleDelete(u.userID)} className="btn btn-danger btn-sm">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No users found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <UserModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          initialData={editData}
          navbarHeight={navbarHeight}
        />
      )}
    </div>
  );
}

function UserModal({ open, onClose, onSave, initialData, navbarHeight = 0 }: any) {
  const safeInitialData = initialData || {};
  const permissionsObj = (safeInitialData.permissions && safeInitialData.permissions[0])
    ? safeInitialData.permissions[0]
    : {};
  const [form, setForm] = React.useState<any>({
    username: '',
    email: '',
    password: '',
    role: '',
    permissions: {
      viewOnly: true,
      createProcedureLog: false,
      editProcedureLog: false,
      editSettings: false,
      manageUsers: false,
      ...permissionsObj,
    },
    ...safeInitialData,
  });

  React.useEffect(() => {
    if (open) {
      const permissionsObj = (safeInitialData.permissions && safeInitialData.permissions[0])
        ? safeInitialData.permissions[0]
        : {};
      setForm({
        username: '',
        email: '',
        password: '',
        role: '',
        permissions: {
          viewOnly: true,
          createProcedureLog: false,
          editProcedureLog: false,
          editSettings: false,
          manageUsers: false,
          ...permissionsObj,
        },
        ...safeInitialData,
      });
    }
  }, [open, initialData]);

  function handleChange(e: any) {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('perm_')) {
      setForm((f: any) => ({
        ...f,
        permissions: {
          ...f.permissions,
          [name.replace('perm_', '')]: type === 'checkbox' ? checked : value,
        },
      }));
    } else {
      setForm((f: any) => ({ ...f, [name]: value }));
    }
  }

  function handleSubmit(e: any) {
    e.preventDefault();
    onSave(form);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ position: 'absolute', top: navbarHeight + 8, left: 0, right: 0, margin: '0 auto' }}>
        <div className="card-header">
          <h3 className="text-lg font-semibold">
            {safeInitialData.userID ? 'Edit' : 'Add'} User
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="card-body">
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="form-input"
                type="email"
                placeholder="Enter email address"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Password
                {safeInitialData.userID && (
                  <span className="text-gray-500 text-sm ml-2">(leave blank to keep unchanged)</span>
                )}
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                className="form-input"
                placeholder="Enter password"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="">Select Role</option>
                <option value="Doctor">Doctor</option>
                <option value="PA">PA</option>
                <option value="Staff Nurse">Staff Nurse</option>
                <option value="Technician">Technician</option>
                <option value="Manager">Manager</option>
                <option value="Others">Others</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Permissions</label>
              <div className="bg-gray-50 rounded p-4 space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="perm_viewOnly"
                    checked={form.permissions.viewOnly}
                    onChange={handleChange}
                    className="rounded"
                  />
                  <span>View Only</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="perm_createProcedureLog"
                    checked={form.permissions.createProcedureLog}
                    onChange={handleChange}
                    className="rounded"
                  />
                  <span>Create Procedure Log</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="perm_editProcedureLog"
                    checked={form.permissions.editProcedureLog}
                    onChange={handleChange}
                    className="rounded"
                  />
                  <span>Edit Procedure Log</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="perm_editSettings"
                    checked={form.permissions.editSettings}
                    onChange={handleChange}
                    className="rounded"
                  />
                  <span>Edit Settings</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="perm_manageUsers"
                    checked={form.permissions.manageUsers}
                    onChange={handleChange}
                    className="rounded"
                  />
                  <span>Manage Users</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button type="submit" className="btn btn-primary flex-1">
              Save
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BackupRestore() {
  const [backupLoading, setBackupLoading] = React.useState(false);
  const [restoreLoading, setRestoreLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setBackupLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/backup');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Backup failed');
      }

      // Get the filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'irlog_backup.sql';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({ type: 'success', text: 'Backup downloaded successfully!' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Backup failed';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Confirm before restoring
    if (!window.confirm('Warning: This will overwrite all existing data in the database. Are you sure you want to restore from this backup?')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setRestoreLoading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/restore', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Restore failed');
      }

      setMessage({ type: 'success', text: 'Database restored successfully! Please refresh the page.' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Restore failed';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setRestoreLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-6">Backup & Restore</h3>

      {message && (
        <div className={`p-4 mb-6 rounded ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* Backup Section */}
        <div className="card">
          <div className="card-body">
            <h4 className="font-medium mb-2">Backup Database</h4>
            <p className="text-sm text-gray-600 mb-4">
              Download a complete backup of the database as a SQL file. This backup can be used to restore the database to this point in time.
            </p>
            <button
              onClick={handleBackup}
              disabled={backupLoading}
              className="btn btn-primary"
            >
              {backupLoading ? (
                <>
                  <span className="spinner mr-2" style={{ width: '1rem', height: '1rem' }}></span>
                  Creating Backup...
                </>
              ) : (
                '⬇ Download Backup'
              )}
            </button>
          </div>
        </div>

        {/* Restore Section */}
        <div className="card">
          <div className="card-body">
            <h4 className="font-medium mb-2">Restore Database</h4>
            <p className="text-sm text-gray-600 mb-4">
              Restore the database from a previously downloaded backup file.
              <strong className="text-red-600"> Warning: This will overwrite all existing data!</strong>
            </p>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.dump"
                onChange={handleRestore}
                disabled={restoreLoading}
                className="form-input"
                style={{ maxWidth: '300px' }}
              />
              {restoreLoading && (
                <div className="flex items-center text-gray-600">
                  <span className="spinner mr-2" style={{ width: '1rem', height: '1rem' }}></span>
                  Restoring...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 