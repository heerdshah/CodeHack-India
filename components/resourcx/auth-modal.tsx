'use client'

import { useState, type FormEvent } from 'react'
import { CERTIFICATIONS, DEPARTMENTS, ROLES, type Role, type UserProfile } from '@/lib/resources'
import { FileDrop, Modal, btnGhost, btnPrimary, inputCls, labelCls } from './ui'

const EMPTY = { username: '', password: '', fullName: '', email: '', dob: '', role: 'Student' as Role, department: DEPARTMENTS[0] }

export function AuthModal({ open, onClose, onRegister }: { open: boolean; onClose: () => void; onRegister: (u: UserProfile) => void }) {
  const [form, setForm] = useState(EMPTY)
  const [credentials, setCredentials] = useState<string[]>([])
  const [files, setFiles] = useState<string[]>([])
  const [error, setError] = useState('')

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.email.toLowerCase().endsWith('.edu')) return setError('Use your institutional email (ending in .edu).')
    if (files.length === 0) return setError('Upload a Student ID, Staff ID, or authorization letter to verify your account.')
    setError('')
    const { password: _password, ...rest } = form
    onRegister({ ...rest, credentials, verificationFiles: files })
    setForm(EMPTY)
    setCredentials([])
    setFiles([])
  }

  const fillDemo = () => {
    setForm({
      username: 'aisha.k',
      password: 'demo-password',
      fullName: 'Aisha Karimi',
      email: 'a.karimi@inst.edu',
      dob: '2001-04-17',
      role: 'Researcher',
      department: 'Mechanical Engineering',
    })
    setCredentials(['Lab Safety Level 2 Certification', 'Chemical Hygiene Training'])
    setFiles(['staff-id-karimi.pdf'])
  }

  return (
    <Modal open={open} onClose={onClose} eyebrow="Verification required" title="Create your institutional account">
      <p className="text-sm leading-relaxed text-white/70">
        Viewing and booking resources is limited to verified members. Your credentials are checked against each owner&apos;s
        eligibility rules.
      </p>
      <button type="button" onClick={fillDemo} className="mt-3 text-xs text-cream underline underline-offset-4">
        Fill demo profile
      </button>

      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="f-username" className={labelCls}>Username</label>
          <input id="f-username" required autoComplete="username" value={form.username} onChange={(e) => set('username', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="f-password" className={labelCls}>Password</label>
          <input id="f-password" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="f-name" className={labelCls}>Full name</label>
          <input id="f-name" required autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="f-email" className={labelCls}>Institutional email</label>
          <input id="f-email" type="email" required autoComplete="email" placeholder="name@institution.edu" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="f-dob" className={labelCls}>Date of birth</label>
          <input id="f-dob" type="date" required value={form.dob} onChange={(e) => set('dob', e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
        </div>
        <div>
          <label htmlFor="f-role" className={labelCls}>Institutional role</label>
          <select id="f-role" value={form.role} onChange={(e) => set('role', e.target.value as Role)} className={`${inputCls} [color-scheme:dark]`}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="f-dept" className={labelCls}>Department</label>
          <select id="f-dept" value={form.department} onChange={(e) => set('department', e.target.value)} className={`${inputCls} [color-scheme:dark]`}>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>

        <fieldset className="sm:col-span-2">
          <legend className={labelCls}>Certifications on file (optional)</legend>
          <div className="flex flex-wrap gap-1.5">
            {CERTIFICATIONS.map((c) => {
              const on = credentials.includes(c)
              return (
                <button
                  type="button"
                  key={c}
                  aria-pressed={on}
                  onClick={() => setCredentials((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${on ? 'bg-cream text-ink' : 'border border-white/15 text-white/70 hover:text-white'}`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="sm:col-span-2">
          <span className={labelCls}>Verification documents</span>
          <FileDrop
            label="Drop or choose files"
            hint="Student ID, Staff ID, or Institutional Authorization Letter"
            files={files}
            onFiles={(names) => setFiles((f) => Array.from(new Set([...f, ...names])))}
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:col-span-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" className={btnPrimary}>Create verified account</button>
        </div>
      </form>
    </Modal>
  )
}
