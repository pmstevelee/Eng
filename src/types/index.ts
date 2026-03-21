export type Role = 'SUPER_ADMIN' | 'ACADEMY_OWNER' | 'TEACHER' | 'STUDENT'

// User.id = Supabase Auth UUID (schema.prisma 참고)
export type UserProfile = {
  id: string
  email: string
  name: string
  role: Role
  academyId: string | null
  academy: { id: string; name: string; businessName?: string | null } | null
}

export type Academy = {
  id: string
  name: string
  address?: string | null
  phone?: string | null
  createdAt: Date
  updatedAt: Date
}

export type ReportResult = {
  overallEvaluation: string
  domainAnalysis: {
    grammar: string
    vocabulary: string
    reading: string
    writing: string
  }
  growthPoints: string[]
  studySuggestions: string[]
}
