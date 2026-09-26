import { AttendanceComingSoon } from '@/components/shared/attendance/coming-soon'

export default function AttendanceTodayPage() {
  return (
    <AttendanceComingSoon
      title="오늘 출결"
      description="오늘 학생들의 등원·하원과 수업별 출석을 확인하고 체크합니다."
      settingsHref="/owner/attendance/settings"
    />
  )
}
