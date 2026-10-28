export type Category = 'Robotics & Fabrication' | 'Analytical Equipment' | 'Studios & Spaces'
export type Role = 'Student' | 'Researcher' | 'Faculty' | 'Lab Technician'
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
  location: string
  image: string
  description: string
  condition: string
  criteria: string[]
  bookedUntil: string | null
  queue: number
}

export type UserProfile = {
  username: string
  fullName: string
  email: string
  dob: string
  role: Role
  department: string
  credentials: string[]
  verificationFiles: string[]
}

export type BookingStatus = 'pending' | 'rejected' | 'approved' | 'signed' | 'active' | 'returned' | 'completed'

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

export const RESOURCES: Resource[] = [
  {
    id: 'cnc-5axis',
    name: '5-Axis CNC Mill',
    department: 'Mechanical Engineering',
    category: 'Robotics & Fabrication',
    owner: 'Dr. Mira Okafor',
    location: 'Fabrication Hall B, Bay 3',
    image: '/images/res-robotics.jpg',
    description: 'Haas UMC-750 with tool probing for aluminium, brass, and engineering plastics.',
    condition: 'Serviced Oct 2026',
    criteria: ['Lab Safety Level 2 Certification', 'CNC Operator Clearance'],
    bookedUntil: '2026-11-04',
    queue: 1,
  },
  {
    id: 'ur10-cobot',
    name: 'UR10e Collaborative Arm',
    department: 'Computer Science',
    category: 'Robotics & Fabrication',
    owner: 'Prof. Anders Halden',
    location: 'Robotics Wing, Cell 2',
    image: '/images/res-robotics.jpg',
    description: '12.5 kg payload cobot with force-torque sensing and ROS 2 integration.',
    condition: 'Excellent',
    criteria: ['Cobot Safety Certification'],
    bookedUntil: null,
    queue: 0,
  },
  {
    id: 'sla-printer',
    name: 'Industrial SLA Printer',
    department: 'Architecture & Design',
    category: 'Robotics & Fabrication',
    owner: 'Lena Varga',
    location: 'Makerspace Level 1',
    image: '/images/res-robotics.jpg',
    description: 'Large-format resin printing for architectural models and precision prototypes.',
    condition: 'Good — new resin vat',
    criteria: ['Lab Safety Level 2 Certification', '3D Fabrication Clearance'],
    bookedUntil: null,
    queue: 0,
  },
  {
    id: 'hplc',
    name: 'HPLC System',
    department: 'Chemistry',
    category: 'Analytical Equipment',
    owner: 'Dr. Sunil Mehta',
    location: 'Chem Block, Lab 214',
    image: '/images/res-analytical.jpg',
    description: 'Agilent 1260 Infinity II with diode-array detection and autosampler.',
    condition: 'Calibrated Sep 2026',
    criteria: ['Chemical Hygiene Training'],
    bookedUntil: '2026-11-09',
    queue: 2,
  },
  {
    id: 'confocal',
    name: 'Confocal Microscope',
    department: 'Biosciences',
    category: 'Analytical Equipment',
    owner: 'Prof. Hana Ito',
    location: 'Bio Imaging Core',
    image: '/images/res-analytical.jpg',
    description: 'Four-laser confocal with live-cell incubation chamber and spectral detection.',
    condition: 'Excellent',
    criteria: ['Biosafety Level 2 Training', 'Lab Safety Level 2 Certification'],
    bookedUntil: null,
    queue: 0,
  },
  {
    id: 'sound-stage',
    name: 'Sound Stage & Grid',
    department: 'Media & Film',
    category: 'Studios & Spaces',
    owner: 'Marco Bellini',
    location: 'Media House, Stage A',
    image: '/images/res-studio.jpg',
    description: 'Acoustically treated 200 m² stage with lighting grid, cyclorama, and control room.',
    condition: 'Good',
    criteria: ['Studio Induction'],
    bookedUntil: '2026-11-02',
    queue: 1,
  },
]

const seedPhotos = (image: string) =>
  Object.fromEntries(ANGLES.map((a) => [a, image])) as Record<Angle, string>

export const SEED_BOOKINGS: Booking[] = [
  {
    id: 'bk-seed-1',
    resourceId: 'cnc-5axis',
    applicant: { name: 'Priya Raman', role: 'Researcher', department: 'Mechanical Engineering', email: 'p.raman@inst.edu' },
    isMine: false,
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    purpose: 'Machining titanium test coupons for a fatigue study.',
    status: 'pending',
    proofFiles: ['cnc-operator-clearance.pdf', 'lab-safety-l2.pdf'],
  },
  {
    id: 'bk-seed-2',
    resourceId: 'sound-stage',
    applicant: { name: 'Tomás Reyes', role: 'Student', department: 'Media & Film', email: 't.reyes@inst.edu' },
    isMine: false,
    startDate: '2026-10-24',
    endDate: '2026-10-26',
    purpose: 'Final-year thesis short film shoot.',
    status: 'returned',
    proofFiles: ['studio-induction.pdf'],
    userSignature: 'signed',
    ownerSignature: 'signed',
    otp: '482913',
    pre: { photos: seedPhotos('/images/res-studio.jpg'), findings: ['Baseline recorded across 6 angles'], flagged: false, completedAt: '2026-10-24' },
    post: {
      photos: seedPhotos('/images/res-studio.jpg'),
      findings: ['Possible new scuff on floor — Bottom view (61% confidence)'],
      flagged: true,
      completedAt: '2026-10-26',
    },
  },
]

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
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
