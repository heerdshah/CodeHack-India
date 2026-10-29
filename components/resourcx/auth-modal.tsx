'use client'

import { useState, type FormEvent } from 'react'
import { DEPARTMENTS, ROLES, type Role, type UserProfile } from '@/lib/resources'
import { FileDrop, Modal, btnGhost, btnPrimary, inputCls, labelCls } from './ui'
import { api } from '@/lib/api'

const EMPTY_REG = {
  username: '',
  password: '',
  fullName: '',
  email: '',
  dob: '',
  role: 'Student' as Role,
  department: DEPARTMENTS[0],
}

export function AuthModal({
  open,
  onClose,
  onRegister,
}: {
  open: boolean
  onClose: () => void
  onRegister: (u: UserProfile) => void
}) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  
  // Login form
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form
  const [form, setForm] = useState(EMPTY_REG)
  const [files, setFiles] = useState<string[]>([])
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const setReg = <K extends keyof typeof EMPTY_REG>(k: K, v: (typeof EMPTY_REG)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await api.auth.login({
        identifier: loginIdentifier,
        password: loginPassword,
      })
      onRegister(user)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const emailLower = form.email.toLowerCase().trim()
    if (!emailLower.endsWith('.edu') && !emailLower.endsWith('.ac.in')) {
      return setError('Institutional email must end in .edu or .ac.in')
    }
    if (files.length === 0) {
      return setError('Upload a Student ID, Staff ID, or authorization letter to verify your account.')
    }
    setError('')
    setLoading(true)
    try {
      const user = await api.auth.register({
        email: form.email,
        username: form.username,
        password: form.password,
        full_name: form.fullName,
        dob: form.dob,
        academic_role: form.role,
        department: form.department,
        id_document_path: files[0],
      })
      onRegister(user)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const fillDemoAccount = (identifier: string, pass: string) => {
    setLoginIdentifier(identifier)
    setLoginPassword(pass)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="ResourcX Identity & Access"
      title={tab === 'login' ? 'Sign in to your account' : 'Create institutional account'}
    >
      {/* Tabs */}
      <div className="flex border-b border-white/10 mb-4">
        <button
          type="button"
          onClick={() => { setTab('login'); setError('') }}
          className={`pb-2 px-4 text-sm font-medium transition ${
            tab === 'login'
              ? 'border-b-2 border-cream text-cream'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setTab('register'); setError('') }}
          className={`pb-2 px-4 text-sm font-medium transition ${
            tab === 'register'
              ? 'border-b-2 border-cream text-cream'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Register New Account
        </button>
      </div>

      {tab === 'login' ? (
        <div>
          <p className="text-xs text-white/70 mb-3">
            Sign in with your campus credentials to access lab bookings and manage facility clearances.
          </p>

          {/* Quick Demo Fills */}
          <div className="mb-4 rounded border border-white/10 bg-white/5 p-3">
            <span className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-1.5">
              Quick demo accounts:
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillDemoAccount('mira.okafor@inst.edu', 'OwnerPass123!')}
                className="rounded bg-white/10 px-2 py-1 text-cream hover:bg-white/20"
              >
                Owner: Dr. Mira (Fab)
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('p.raman@inst.edu', 'UserPass123!')}
                className="rounded bg-white/10 px-2 py-1 text-cream hover:bg-white/20"
              >
                Researcher: Priya
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('t.reyes@inst.edu', 'UserPass123!')}
                className="rounded bg-white/10 px-2 py-1 text-cream hover:bg-white/20"
              >
                Student: Tomás
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('admin@inst.edu', 'AdminPass123!')}
                className="rounded bg-white/10 px-2 py-1 text-cream hover:bg-white/20"
              >
                Administrator
              </button>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="grid gap-4">
            <div>
              <label htmlFor="login-id" className={labelCls}>Username or Email</label>
              <input
                id="login-id"
                required
                autoComplete="username"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="username or name@institution.edu"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="login-pass" className={labelCls}>Password</label>
              <input
                id="login-pass"
                type="password"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className={inputCls}
              />
            </div>

            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div>
          <p className="text-xs leading-relaxed text-white/70 mb-3">
            Registration requires an institutional email ending in <strong className="text-cream">.edu</strong> or <strong className="text-cream">.ac.in</strong> and document verification.
          </p>

          <form onSubmit={handleRegisterSubmit} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="f-username" className={labelCls}>Username</label>
              <input
                id="f-username"
                required
                autoComplete="username"
                value={form.username}
                onChange={(e) => setReg('username', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="f-password" className={labelCls}>Password</label>
              <input
                id="f-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setReg('password', e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="f-name" className={labelCls}>Full name</label>
              <input
                id="f-name"
                required
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => setReg('fullName', e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="f-email" className={labelCls}>Institutional email (.edu or .ac.in)</label>
              <input
                id="f-email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@institution.edu or name@univ.ac.in"
                value={form.email}
                onChange={(e) => setReg('email', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="f-dob" className={labelCls}>Date of birth</label>
              <input
                id="f-dob"
                type="date"
                required
                value={form.dob}
                onChange={(e) => setReg('dob', e.target.value)}
                className={`${inputCls} [color-scheme:dark]`}
              />
            </div>
            <div>
              <label htmlFor="f-role" className={labelCls}>Institutional role</label>
              <select
                id="f-role"
                value={form.role}
                onChange={(e) => setReg('role', e.target.value as Role)}
                className={`${inputCls} [color-scheme:dark]`}
              >
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="f-dept" className={labelCls}>Department</label>
              <select
                id="f-dept"
                value={form.department}
                onChange={(e) => setReg('department', e.target.value)}
                className={`${inputCls} [color-scheme:dark]`}
              >
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2">
              <span className={labelCls}>Verification document (Required)</span>
              <FileDrop
                label="Drop or choose identity proof"
                hint="Student ID, Faculty/Staff ID, or Institutional Authorization Letter"
                files={files}
                onFiles={(names) => setFiles((f) => Array.from(new Set([...f, ...names])))}
              />
            </div>

            {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:col-span-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? 'Creating...' : 'Create verified account'}
              </button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  )
}
