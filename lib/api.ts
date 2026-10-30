/**
 * ResourcX Typed API Client
 * Wraps all backend endpoints with cookie-based credentials and typed responses.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const headers = new Headers(options.headers || {})

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Ensures httpOnly session cookies are transmitted
  })

  if (!response.ok) {
    let errorDetail = 'Request failed'
    try {
      const errJson = await response.json()
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson)
    } catch {
      errorDetail = response.statusText || `${response.status}`
    }
    throw new Error(errorDetail)
  }

  // If response is empty or 204
  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

// =============================================================================
// DOMAIN TYPES
// =============================================================================

export type Role = 'Student' | 'Researcher' | 'Faculty' | 'Lab Technician'
export type SystemRole = 'user' | 'owner' | 'manager' | 'admin'
export type Category = 'Robotics & Fabrication' | 'Analytical Equipment' | 'Studios & Spaces'
export type Angle = 'Front' | 'Back' | 'Left' | 'Right' | 'Top' | 'Bottom'
export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'signed' | 'active' | 'returned' | 'completed' | 'cancelled' | 'overdue'

export type UserProfile = {
  id: string
  email: string
  username: string
  fullName: string
  dob: string
  role: Role
  department: string
  systemRole: SystemRole
  idDocumentPath?: string | null
  isVerified: boolean
  credentials: string[]
}

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
  latitude: number
  longitude: number
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

export type InspectionSet = {
  photos: Record<Angle, string>
  findings: string[]
  flagged: boolean
  completedAt: string
}

export type Applicant = {
  name: string
  role: Role
  department: string
  email: string
}

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

export type Agreement = {
  id: string
  booking_id: string
  document_path: string
  document_hash: string
  content_clauses: {
    mandatory: string[]
    tailored: string[]
  }
  user_signed_at?: string
  owner_signed_at?: string
  is_fully_signed: boolean
}

export type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  data?: any
  is_read: boolean
  created_at: string
}

export type Incident = {
  id: string
  booking_id?: string
  resource_id: string
  reported_by: string
  angle?: Angle
  status: 'reported' | 'under_review' | 'confirmed' | 'dismissed' | 'resolved'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  ai_summary?: string
  photos: string[]
  review_notes?: string
}

// =============================================================================
// API CLIENT IMPLEMENTATION
// =============================================================================

export const api = {
  // Authentication
  auth: {
    async register(data: {
      email: string
      username: string
      password: string
      full_name: string
      dob: string
      academic_role: string
      department: string
      id_document_path?: string
    }): Promise<UserProfile> {
      const res = await request<any>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return {
        id: res.id,
        email: res.email,
        username: res.username,
        fullName: res.full_name,
        dob: res.dob,
        role: res.academic_role as Role,
        department: res.department,
        systemRole: res.system_role as SystemRole,
        idDocumentPath: res.id_document_path,
        isVerified: res.is_verified,
        credentials: res.credentials || [],
      }
    },

    async login(data: { identifier: string; password: string }): Promise<UserProfile> {
      const res = await request<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return {
        id: res.id,
        email: res.email,
        username: res.username,
        fullName: res.full_name,
        dob: res.dob,
        role: res.academic_role as Role,
        department: res.department,
        systemRole: res.system_role as SystemRole,
        idDocumentPath: res.id_document_path,
        isVerified: res.is_verified,
        credentials: res.credentials || [],
      }
    },

    async logout(): Promise<void> {
      await request('/auth/logout', { method: 'POST' })
    },

    async getMe(): Promise<UserProfile> {
      const res = await request<any>('/auth/me')
      return {
        id: res.id,
        email: res.email,
        username: res.username,
        fullName: res.full_name,
        dob: res.dob,
        role: res.academic_role as Role,
        department: res.department,
        systemRole: res.system_role as SystemRole,
        idDocumentPath: res.id_document_path,
        isVerified: res.is_verified,
        credentials: res.credentials || [],
      }
    },
  },

  // Users & Profiles
  users: {
    async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
      const res = await request<any>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: updates.fullName,
          dob: updates.dob,
          department: updates.department,
          academic_role: updates.role,
        }),
      })
      return {
        id: res.id,
        email: res.email,
        username: res.username,
        fullName: res.full_name,
        dob: res.dob,
        role: res.academic_role as Role,
        department: res.department,
        systemRole: res.system_role as SystemRole,
        idDocumentPath: res.id_document_path,
        isVerified: res.is_verified,
        credentials: res.credentials || [],
      }
    },

    async getMyBookings(): Promise<Booking[]> {
      return request<Booking[]>('/users/me/bookings')
    },

    async getMyCredentials(): Promise<any[]> {
      return request<any[]>('/users/me/credentials')
    },
  },

  // Resources
  resources: {
    async list(params: {
      lat?: number | null
      lng?: number | null
      q?: string
      category?: string
      radius_km?: number
    } = {}): Promise<Resource[]> {
      const sp = new URLSearchParams()
      if (params.lat != null) sp.append('lat', params.lat.toString())
      if (params.lng != null) sp.append('lng', params.lng.toString())
      if (params.q) sp.append('q', params.q)
      if (params.category && params.category !== 'All') sp.append('category', params.category)
      if (params.radius_km) sp.append('radius_km', params.radius_km.toString())

      const res = await request<any[]>(`/resources?${sp.toString()}`)
      return res.map((r) => ({
        id: r.id,
        name: r.name,
        department: r.department,
        category: r.category as Category,
        owner: r.owner_name || 'Facility Owner',
        owner_id: r.owner_id,
        location: r.location,
        building: r.building,
        floor: r.floor,
        latitude: r.latitude,
        longitude: r.longitude,
        image: r.image,
        description: r.description,
        condition: r.condition,
        criteria: r.criteria || [],
        rules: r.rules || [],
        approval_mode: r.approval_mode,
        bookedUntil: r.bookedUntil,
        queue: r.queue || 0,
        distance_km: r.distance_km,
      }))
    },

    async get(id: string): Promise<Resource> {
      const r = await request<any>(`/resources/${id}`)
      return {
        id: r.id,
        name: r.name,
        department: r.department,
        category: r.category as Category,
        owner: r.owner_name || 'Facility Owner',
        owner_id: r.owner_id,
        location: r.location,
        building: r.building,
        floor: r.floor,
        latitude: r.latitude,
        longitude: r.longitude,
        image: r.image,
        description: r.description,
        condition: r.condition,
        criteria: r.criteria || [],
        rules: r.rules || [],
        approval_mode: r.approval_mode,
        bookedUntil: r.bookedUntil,
        queue: r.queue || 0,
        distance_km: r.distance_km,
      }
    },

    async create(data: any): Promise<Resource> {
      return request<Resource>('/resources', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    async update(id: string, updates: any): Promise<Resource> {
      return request<Resource>(`/resources/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
    },
  },

  // Bookings
  bookings: {
    async list(status?: string): Promise<Booking[]> {
      const url = status ? `/bookings?status=${status}` : '/bookings'
      return request<Booking[]>(url)
    },

    async create(data: {
      resource_id: string
      start_date: string
      end_date: string
      purpose: string
      proof_files?: string[]
    }): Promise<any> {
      return request<any>('/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    async updateStatus(id: string, status: string, rejectionReason?: string): Promise<any> {
      return request<any>(`/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejection_reason: rejectionReason }),
      })
    },

    async requestOtp(id: string): Promise<{ otp: string; expires_in_minutes: number }> {
      return request<{ otp: string; expires_in_minutes: number }>(`/bookings/${id}/otp`, {
        method: 'POST',
      })
    },

    async checkin(id: string, otp: string): Promise<any> {
      return request<any>(`/bookings/${id}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ otp }),
      })
    },

    async sign(id: string, data: {
      signer_role: 'user' | 'owner'
      signature_data: string
      document_hash: string
    }): Promise<any> {
      return request<any>(`/bookings/${id}/sign`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
  },

  // Agreements
  agreements: {
    async get(bookingId: string): Promise<Agreement> {
      return request<Agreement>(`/agreements/${bookingId}`)
    },

    getPdfUrl(bookingId: string): string {
      return `${API_BASE}/agreements/${bookingId}/pdf`
    },
  },

  // Verification & Credentials
  verification: {
    async upload(formData: FormData): Promise<any> {
      return request<any>('/verification/upload', {
        method: 'POST',
        body: formData,
      })
    },

    async getReviewQueue(): Promise<any[]> {
      return request<any[]>('/verification/review-queue')
    },

    async confirm(docId: string, approved: boolean, reason?: string): Promise<any> {
      return request<any>(`/verification/${docId}/confirm?approved=${approved}&rejection_reason=${encodeURIComponent(reason || '')}`, {
        method: 'POST',
      })
    },
  },

  // Inspections
  inspections: {
    async submit(data: {
      booking_id: string
      phase: 'pre' | 'post'
      photos: Record<Angle, string>
    }): Promise<any> {
      return request<any>('/inspections/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
  },

  // Incidents
  incidents: {
    async list(status?: string): Promise<Incident[]> {
      const url = status ? `/incidents?status=${status}` : '/incidents'
      return request<Incident[]>(url)
    },

    async report(data: {
      resource_id: string
      booking_id?: string
      angle?: Angle
      title: string
      description: string
      photos?: string[]
    }): Promise<Incident> {
      return request<Incident>('/incidents', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },

    async review(incidentId: string, status: string, notes: string): Promise<any> {
      return request<any>(`/incidents/${incidentId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, review_notes: notes }),
      })
    },
  },

  // Notifications
  notifications: {
    async list(): Promise<NotificationItem[]> {
      return request<NotificationItem[]>('/notifications')
    },

    async markAsRead(id: string): Promise<void> {
      await request(`/notifications/${id}/read`, { method: 'PATCH' })
    },

    async markAllAsRead(): Promise<void> {
      await request('/notifications/read-all', { method: 'POST' })
    },
  },

  // Admin & Operations
  admin: {
    async listUsers(): Promise<any[]> {
      return request<any[]>('/admin/users')
    },

    async updateRole(userId: string, systemRole: SystemRole): Promise<any> {
      return request<any>(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ system_role: systemRole }),
      })
    },

    async getAuditLogs(entityType?: string, actorId?: string): Promise<any[]> {
      const sp = new URLSearchParams()
      if (entityType) sp.append('entity_type', entityType)
      if (actorId) sp.append('actor_id', actorId)
      return request<any[]>(`/admin/audit-logs?${sp.toString()}`)
    },

    async getSuspiciousFlags(): Promise<any[]> {
      return request<any[]>('/admin/suspicious-flags')
    },
  },
}

