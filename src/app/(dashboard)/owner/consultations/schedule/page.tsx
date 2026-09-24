import { AppointmentSchedulePage, type ScheduleSearchParams } from '@/components/shared/consultation/lead-pages'

export default async function OwnerConsultationSchedulePage({
  searchParams,
}: {
  searchParams: Promise<ScheduleSearchParams>
}) {
  return <AppointmentSchedulePage role="ACADEMY_OWNER" searchParams={await searchParams} />
}
