import { LeadListPage, type LeadListSearchParams } from '@/components/shared/consultation/lead-pages'

export default async function OwnerConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<LeadListSearchParams>
}) {
  return <LeadListPage role="ACADEMY_OWNER" searchParams={await searchParams} />
}
