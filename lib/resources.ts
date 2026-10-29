export type Category = 'Robotics & Fabrication' | 'Analytical Equipment' | 'Studios & Spaces'
export type Role = 'Student' | 'Researcher' | 'Faculty' | 'Lab Technician'
export type SystemRole = 'user' | 'owner' | 'manager' | 'admin'
export type Mode = 'user' | 'owner'

export const CATEGORIES: Category[] = ['Robotics & Fabrication', 'Analytical Equipment', 'Studios & Spaces']
export const ROLES: Role[] = ['Student', 'Researcher', 'Faculty', 'Lab Technician']
export const DEPARTMENTS = [
  'Mechanical Engineering',
  'Chemistry',
  'Biosciences',
  'Architecture & Design',
  'Media & Film',
  'Computer Science',
]
export const CERTIFICATIONS = [
  'Lab Safety Level 2 Certification',
  '3D Fabrication Clearance',
  'CNC Operator Clearance',
  'Cobot Safety Certification',
  'Chemical Hygiene Training',
  'Biosafety Level 2 Training',
  'Studio Induction',
]

export const ANGLES = ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom'] as const
export type Angle = (typeof ANGLES)[number]

export type Resource = {
  id: string
  name: string
  department: string
  category: Category
  owner: string
  owner_id?: string
  location: string
  building?: string
  floor?: string
  latitude?: number
  longitude?: number
  image: string
  description: string
  condition: string
  criteria: string[]
  rules?: string[]
  approval_mode?: 'manual' | 'auto'
  bookedUntil: string | null
  queue: number
  distance_km?: number | null
}

export type UserProfile = {
  id?: string
  username: string
  fullName: string
  email: string
  dob: string
  role: Role
  department: string
  systemRole?: SystemRole
  credentials: string[]
  verificationFiles?: string[]
  idDocumentPath?: string | null
  isVerified?: boolean
}

export type BookingStatus = 'pending' | 'rejected' | 'approved' | 'signed' | 'active' | 'returned' | 'completed' | 'waitlisted' | 'cancelled' | 'overdue'

export type InspectionSet = {
  photos: Record<Angle, string>
  findings: string[]
  flagged: boolean
  completedAt: string
}

export type Applicant = { name: string; role: Role; department: string; email: string }

export type Booking = {
  id: string
  resourceId: string
  resource_name?: string
  applicant: Applicant
  isMine: boolean
  startDate: string
  endDate: string
  purpose: string
  status: BookingStatus
  proofFiles: string[]
  rejectionReason?: string
  userSignature?: string
  ownerSignature?: string
  otp?: string
  pre?: InspectionSet
  post?: InspectionSet
  ownerVerified?: boolean
}

export type WaitlistEntry = { id: string; resourceId: string; position: number; eta: string; startDate: string }

export const RESOURCES: Resource[] = []
export const SEED_BOOKINGS: Booking[] = []

export function formatDate(iso: string) {
  if (!iso) return ''
  const clean = iso.includes('T') ? iso.split('T')[0] : iso
  return new Date(`${clean}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function addDays(iso: string, days: number) {
  const clean = iso.includes('T') ? iso.split('T')[0] : iso
  const d = new Date(`${clean}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function missingCriteria(user: UserProfile | null, resource: Resource) {
  if (!user) return resource.criteria
  return resource.criteria.filter((c) => !user.credentials.includes(c))
}

export function matchesQuery(r: Resource, q: string) {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [r.name, r.department, r.category, r.location, r.owner].some((v) => v.toLowerCase().includes(s))
}
