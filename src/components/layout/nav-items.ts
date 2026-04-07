import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BookOpen,
  FileText,
  BarChart2,
  Settings,
  FilePen,
  MessageSquare,
  Calendar,
  Home,
  Award,
  GraduationCap,
  Building2,
  CreditCard,
  Library,
  Target,
  Bell,
} from 'lucide-react'
import type { Role } from '@/types'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: '관리자',
  ACADEMY_OWNER: '학원장',
  TEACHER: '교사',
  STUDENT: '학생',
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { label: '대시보드', href: '/admin', icon: LayoutDashboard },
    { label: '학원 관리', href: '/admin/academies', icon: Building2 },
    { label: '구독 관리', href: '/admin/subscriptions', icon: CreditCard },
    { label: '문제 뱅크', href: '/admin/question-bank', icon: Library },
  ],
  ACADEMY_OWNER: [
    { label: '대시보드', href: '/owner', icon: LayoutDashboard },
    { label: '학생관리', href: '/owner/students', icon: Users },
    { label: '교사관리', href: '/owner/teachers', icon: UserCheck },
    { label: '반관리', href: '/owner/classes', icon: GraduationCap },
    { label: '테스트관리', href: '/owner/tests', icon: FileText },
    { label: '문제 뱅크', href: '/owner/tests/questions', icon: Library },
    { label: '분석통계', href: '/owner/analytics', icon: BarChart2 },
    { label: '설정', href: '/owner/settings', icon: Settings },
  ],
  TEACHER: [
    { label: '대시보드', href: '/teacher', icon: LayoutDashboard },
    { label: '테스트 출제/채점', href: '/teacher/tests', icon: FilePen },
    { label: '문제 뱅크', href: '/teacher/tests/questions', icon: Library },
    { label: '학생학습관리', href: '/teacher/students', icon: Users },
    { label: '커뮤니케이션', href: '/teacher/communication', icon: MessageSquare },
    { label: '일정', href: '/teacher/schedule', icon: Calendar },
    { label: '설정', href: '/teacher/settings', icon: Settings },
  ],
  STUDENT: [
    { label: '홈', href: '/student', icon: Home },
    { label: '오늘의 미션', href: '/student/daily-mission', icon: Target },
    { label: '테스트', href: '/student/tests', icon: FileText },
    { label: '학습공간', href: '/student/learn', icon: BookOpen },
    { label: '내 성적', href: '/student/grades', icon: BarChart2 },
    { label: '배지', href: '/student/badges', icon: Award },
    { label: '알림', href: '/student/notifications', icon: Bell },
    { label: '설정', href: '/student/settings', icon: Settings },
  ],
}
