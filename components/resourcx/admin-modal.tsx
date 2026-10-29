'use client'

import { useState, useEffect } from 'react'
import { Shield, Users, Activity, AlertTriangle } from 'lucide-react'
import { Modal, btnPrimary, btnGhost, inputCls, labelCls } from './ui'
import { api, type SystemRole } from '@/lib/api'

type Props = {
  open: boolean
  onClose: () => void
}

export function AdminModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<'users' | 'audit' | 'flags'>('users')
  const [users, setUsers] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [suspiciousFlags, setSuspiciousFlags] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filterEntity, setFilterEntity] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [u, a, f] = await Promise.all([
        api.admin.listUsers(),
        api.admin.getAuditLogs(filterEntity || undefined),
        api.admin.getSuspiciousFlags(),
      ])
      setUsers(u || [])
      setAuditLogs(a || [])
      setSuspiciousFlags(f || [])
    } catch {
      // Ignored if offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadData()
  }, [open, filterEntity])

  const handleRoleChange = async (userId: string, newRole: SystemRole) => {
    try {
      await api.admin.updateRole(userId, newRole)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, system_role: newRole } : u))
      )
    } catch (err: any) {
      alert(`Role change failed: ${err.message}`)
    }
  }

  return (
    <Modal open={open} onClose={onClose} wide eyebrow="System Administration" title="Institutional Control Panel">
      <div className="flex border-b border-white/10 mb-4 gap-4">
        <button
          onClick={() => setTab('users')}
          className={`pb-2 text-sm font-medium transition ${
            tab === 'users' ? 'border-b-2 border-cream text-cream' : 'text-white/60 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="size-4" /> User Role Assignment ({users.length})
          </span>
        </button>
        <button
          onClick={() => setTab('audit')}
          className={`pb-2 text-sm font-medium transition ${
            tab === 'audit' ? 'border-b-2 border-cream text-cream' : 'text-white/60 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Activity className="size-4" /> Audit Logs ({auditLogs.length})
          </span>
        </button>
        <button
          onClick={() => setTab('flags')}
          className={`pb-2 text-sm font-medium transition ${
            tab === 'flags' ? 'border-b-2 border-cream text-cream' : 'text-white/60 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-4 text-amber-300" /> Suspicious Flags ({suspiciousFlags.length})
          </span>
        </button>
      </div>

      {tab === 'users' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-stone uppercase tracking-wider">
              <tr>
                <th className="py-2">Full Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Department</th>
                <th className="py-2">Current Role</th>
                <th className="py-2">Change System Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 font-medium text-white">{u.full_name}</td>
                  <td className="py-2.5 text-stone">{u.email}</td>
                  <td className="py-2.5 text-stone">{u.department}</td>
                  <td className="py-2.5">
                    <span className="rounded bg-white/10 px-2 py-0.5 font-semibold capitalize text-cream">
                      {u.system_role || 'user'}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <select
                      value={u.system_role || 'user'}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as SystemRole)}
                      className="rounded border border-white/20 bg-black/50 px-2 py-1 text-xs text-white"
                    >
                      <option value="user">User</option>
                      <option value="owner">Owner</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone">Filter Entity:</span>
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
            >
              <option value="">All Entities</option>
              <option value="booking">Booking</option>
              <option value="user">User</option>
              <option value="incident">Incident</option>
            </select>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs">
                <div className="flex items-center justify-between text-stone">
                  <span className="font-semibold text-cream">
                    {log.action} · {log.entity_type} ({log.entity_id})
                  </span>
                  <span>{log.created_at?.slice(0, 19).replace('T', ' ')}</span>
                </div>
                <p className="mt-1 text-stone">
                  Actor: <span className="text-white">{log.actor_role}</span> ({log.actor_id || 'System'}) | IP: {log.ip_address || '127.0.0.1'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'flags' && (
        <div className="space-y-3">
          <p className="text-xs text-stone">
            Suspicious usage heuristics flagged by automated audit rules (e.g., repeated no-shows, cancellation patterns).
          </p>
          {suspiciousFlags.length === 0 ? (
            <p className="text-sm text-stone py-4 text-center">No active flags. Platform usage is healthy.</p>
          ) : (
            suspiciousFlags.map((flag) => (
              <div key={flag.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
                <span className="font-semibold text-amber-300 capitalize">
                  {flag.flag_type?.replace(/_/g, ' ')}
                </span>
                <p className="text-white mt-1">{flag.reason}</p>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button onClick={onClose} className={btnGhost}>Close Panel</button>
      </div>
    </Modal>
  )
}

