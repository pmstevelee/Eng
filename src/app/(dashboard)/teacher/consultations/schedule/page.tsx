import { AppointmentSchedulePage, type ScheduleSearchParams } from '@/components/shared/consultation/lead-pages'

export default async function TeacherConsultationSchedulePage({
  searchParams,
}: {
  searchParams: Promise<ScheduleSearchParams>
}) {
  return <AppointmentSchedulePage role="TEACHER" searchParams={await searchParams} />
}
