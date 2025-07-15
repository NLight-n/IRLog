import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

const PERMISSIONS = [
  { key: 'viewOnly', label: 'View Only' },
  { key: 'createProcedureLog', label: 'Create Procedure Log' },
  { key: 'editProcedureLog', label: 'Edit Procedure Log' },
  { key: 'editSettings', label: 'Edit Settings' },
  { key: 'manageUsers', label: 'Manage Users' },
];

function UserManagementPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState<any>({ username: '', email: '', password: '', role: '', permissions: {} });
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (!(session.user && (session.user as any).permissions?.manageUsers)) return;
    fetch('/api/users', {
      headers: { Authorization: `Bearer not-needed` },
    })
      .then(async res => {
        if (res.status === 403 || res.status === 401) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        setUsers(data);
        setLoading(false);
      })
      .catch(() => setError('Failed to load users'));
  }, [session, status]);

  const openModal = (user: any = null) => {
    setEditUser(user);
    if (user) {
      const { password, ...rest } = user; // Omit password
      setForm({ ...rest, password: '', permissions: flattenPermissions(user.permissions) });
    } else {
      setForm({ username: '', email: '', password: '', role: '', permissions: {} });
    }
    setShowModal(true);
  };

  // Helper to flatten permissions (array or object) to plain object with only keys
  function flattenPermissions(perms: any) {
    if (!perms) return {};
    if (Array.isArray(perms)) perms = perms[0] || {};
    const out: any = {};
    for (const k in perms) {
      if (['id', 'userID', 'timestamp'].includes(k)) continue;
      out[k] = perms[k];
    }
    return out;
  }

  const closeModal = () => {
    setShowModal(false);
    setEditUser(null);
    setForm({ username: '', email: '', password: '', role: '', permissions: {} });
  };

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    if (PERMISSIONS.some(p => p.key === name)) {
      setForm((f: any) => ({ ...f, permissions: { ...f.permissions, [name]: checked } }));
    } else {
      setForm((f: any) => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const method = editUser ? 'PATCH' : 'POST';
    const url = editUser ? `/api/users/${editUser.userID}` : '/api/users';
    const body = { ...form };
    if (!body.password) delete body.password;
    // Only send permission keys
    body.permissions = flattenPermissions(body.permissions);
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      closeModal();
      location.reload();
    } else {
      setError('Failed to save user');
    }
  };

  const handleDelete = async (userID: number) => {
    if (!confirm('Delete this user?')) return;
    const res = await fetch(`/api/users/${userID}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      location.reload();
    } else {
      setError('Failed to delete user');
    }
  };

  if (status === 'loading' || loading) return <div>Loading...</div>;
  if (!session || !(session.user && (session.user as any).permissions?.manageUsers)) return <div>Forbidden</div>;

  console.log('TEST MODAL');
  return (
    <div style={{ padding: 32 }}>
      <h2>User Management</h2>
      <button onClick={() => openModal()}>Add User</button>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <table border={1} cellPadding={8} style={{ marginTop: 16, width: '100%', borderCollapse: 'collapse' }}>
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
          {users.map(u => (
            <tr key={u.userID}>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                {u.permissions &&
                  Object.entries(u.permissions)
                    .filter(([k, v]) => v && k !== 'id' && k !== 'userID' && k !== 'timestamp')
                    .map(([k]) => PERMISSIONS.find(p => p.key === k)?.label)
                    .join(', ')}
              </td>
              <td>
                <button onClick={() => openModal(u)}>Edit</button>
                <button onClick={() => handleDelete(u.userID)} style={{ color: 'red' }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form
            onSubmit={handleSubmit}
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 8,
              minWidth: 320,
              maxWidth: 500,
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
              width: '100%',
              boxSizing: 'border-box',
              paddingBottom: 32,
            }}
          >
                <h3>{editUser ? 'Edit User' : 'Add User'}</h3>
                <div style={{ marginBottom: 12 }}>
                  <label>Username</label>
                  <input name="username" value={form.username} onChange={handleChange} required />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>Email</label>
                  <input name="email" value={form.email} onChange={handleChange} required />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>Password</label>
                  <input name="password" type="password" value={form.password} onChange={handleChange} placeholder={editUser ? 'Leave blank to keep current' : ''} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label>Role</label>
                  <select name="role" value={form.role} onChange={handleChange} required>
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
                <div style={{ marginBottom: 12 }}>
                  <label>Permissions</label>
                  <div>
                    {PERMISSIONS.map(p => (
                      <label key={p.key} style={{ marginRight: 8 }}>
                        <input
                          type="checkbox"
                          name={p.key}
                          checked={!!form.permissions[p.key]}
                          onChange={handleChange}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit">Save</button>
                  <button type="button" onClick={closeModal} style={{ background: '#eee' }}>
                    Cancel
                  </button>
                </div>
              </form>
        </div>
      )}
    </div>
  );
}

export default UserManagementPage; 