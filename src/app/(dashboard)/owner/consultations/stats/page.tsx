import { ConsultationStatsPage, type StatsSearchParams } from '@/components/shared/consultation/lead-pages'

export default async function OwnerConsultationStatsPage({
  searchParams,
}: {
  searchParams: Promise<StatsSearchParams>
}) {
  return <ConsultationStatsPage role="ACADEMY_OWNER" searchParams={await searchParams} />
}
