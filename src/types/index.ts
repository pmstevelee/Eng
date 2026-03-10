export type Role = 'SUPER_ADMIN' | 'ACADEMY_OWNER' | 'TEACHER' | 'STUDENT'

export type UserProfile = {
  id: string
  authId: string
  email: string
  name: string
  role: Role
  academyId?: string | null
}

export type Academy = {
  id: string
  name: string
  code: string
  createdAt: Date
  updatedAt: Date
}
