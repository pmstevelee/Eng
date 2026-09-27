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
  GitBranch,
  Languages,
  Activity,
  MessagesSquare,
  CalendarCheck,
  ClipboardCheck,
  CalendarDays,
  SlidersHorizontal,
  Coins,
} from 'lucide-react'
import type { Role } from '@/types'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** 하위 메뉴 — 상위 메뉴 경로 안에 있을 때 펼쳐서 표시 */
  children?: NavItem[]
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
    { label: '결제 모니터링', href: '/admin/billing', icon: CreditCard },
    { label: '크레딧', href: '/admin/credits', icon: Coins },
    { label: '문제 뱅크', href: '/admin/question-bank', icon: Library },
    { label: '활동 로그', href: '/admin/activity-logs', icon: Activity },
  ],
  ACADEMY_OWNER: [
    { label: '대시보드', href: '/owner', icon: LayoutDashboard },
    { label: '학생관리', href: '/owner/students', icon: Users },
    {
      label: '출결관리',
      href: '/owner/attendance',
      icon: CalendarCheck,
      children: [
        { label: '오늘 출결', href: '/owner/attendance/today', icon: ClipboardCheck },
        { label: '월간 출석부', href: '/owner/attendance/monthly', icon: CalendarDays },
        { label: '출결 설정', href: '/owner/attendance/settings', icon: SlidersHorizontal },
      ],
    },
    { label: '크레딧', href: '/owner/credits', icon: Coins },
    { label: '상담관리', href: '/owner/consultations', icon: MessagesSquare },
    { label: '교사관리', href: '/owner/teachers', icon: UserCheck },
    { label: '반관리', href: '/owner/classes', icon: GraduationCap },
    { label: '테스트관리', href: '/owner/tests', icon: FileText },
    { label: '문제 뱅크', href: '/owner/tests/questions', icon: Library },
    { label: '분석통계', href: '/owner/analytics', icon: BarChart2 },
    { label: '단어학습 관리', href: '/owner/words', icon: Languages },
    { label: '일정', href: '/owner/schedule', icon: Calendar },
    { label: '지점관리', href: '/owner/branches', icon: GitBranch },
    { label: '설정', href: '/owner/settings', icon: Settings },
  ],
  TEACHER: [
    { label: '대시보드', href: '/teacher', icon: LayoutDashboard },
    { label: '테스트 출제/채점', href: '/teacher/tests', icon: FilePen },
    { label: '문제 뱅크', href: '/teacher/tests/questions', icon: Library },
    { label: '단어학습 관리', href: '/teacher/words', icon: Languages },
    { label: '학생학습관리', href: '/teacher/students', icon: Users },
    {
      label: '출결관리',
      href: '/teacher/attendance',
      icon: CalendarCheck,
      // 출결 설정은 학원장 전용
      children: [
        { label: '오늘 출결', href: '/teacher/attendance/today', icon: ClipboardCheck },
        { label: '월간 출석부', href: '/teacher/attendance/monthly', icon: CalendarDays },
      ],
    },
    { label: '상담관리', href: '/teacher/consultations', icon: MessagesSquare },
    { label: '커뮤니케이션', href: '/teacher/communication', icon: MessageSquare },
    { label: '일정', href: '/teacher/schedule', icon: Calendar },
    { label: '설정', href: '/teacher/settings', icon: Settings },
  ],
  STUDENT: [
    { label: '홈', href: '/student', icon: Home },
    { label: '오늘의 미션', href: '/student/daily-mission', icon: Target },
    { label: '테스트', href: '/student/tests', icon: FileText },
    { label: '학습공간', href: '/student/learn', icon: BookOpen },
    { label: '단어학습', href: '/student/words', icon: Languages },
    { label: '내 성적', href: '/student/grades', icon: BarChart2 },
    { label: '배지', href: '/student/badges', icon: Award },
    { label: '알림', href: '/student/notifications', icon: Bell },
    { label: '설정', href: '/student/settings', icon: Settings },
  ],
}
