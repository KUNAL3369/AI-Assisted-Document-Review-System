'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import type { UserProfile } from '@/lib/types';

export default function TeamPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadUsers();
  }, [supabase]);

  async function loadUsers() {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const res = await fetch('/api/team');
    if (res.ok) {
      const json = await res.json();
      setUsers(json.data);
    }
    setLoading(false);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    const res = await fetch('/api/team', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    });
    if (res.ok) {
      await loadUsers();
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Team Management</h1>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-3 text-left font-medium text-gray-600">Email</th>
              <th className="p-3 text-left font-medium text-gray-600">Role</th>
              <th className="p-3 text-left font-medium text-gray-600">Joined</th>
              <th className="p-3 text-left font-medium text-gray-600">Last Sign In</th>
              <th className="p-3 text-left font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-900">{user.email}</td>
                <td className="p-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                    {user.role.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-3 text-gray-500 text-xs">{formatDate(user.created_at)}</td>
                <td className="p-3 text-gray-500 text-xs">
                  {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'}
                </td>
                <td className="p-3">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="text-xs rounded border border-gray-300 px-2 py-1"
                  >
                    <option value="operations_executive">Operations Executive</option>
                    <option value="team_lead">Team Lead</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
