import { ConsultationStatsPage, type StatsSearchParams } from '@/components/shared/consultation/lead-pages'

export default async function TeacherConsultationStatsPage({
  searchParams,
}: {
  searchParams: Promise<StatsSearchParams>
}) {
  return <ConsultationStatsPage role="TEACHER" searchParams={await searchParams} />
}
