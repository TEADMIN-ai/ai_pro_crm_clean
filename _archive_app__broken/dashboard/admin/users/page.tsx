'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(token => {
      fetch('/api/admin/users', {
        headers: { Authorization: \Bearer \\ },
      })
        .then(r => r.json())
        .then(setUsers);
    });
  }, []);

  const updateRole = async (userId: string, role: string) => {
    const token = await auth.currentUser?.getIdToken();
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: \Bearer \\,
      },
      body: JSON.stringify({ userId, role }),
    });

    setUsers(u =>
      u.map(x => (x.id === userId ? { ...x, role } : x))
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin — User Management</h1>

      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>
                <button
                  onClick={() =>
                    updateRole(u.id, u.role === 'admin' ? 'staff' : 'admin')
                  }
                >
                  Make {u.role === 'admin' ? 'Staff' : 'Admin'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


