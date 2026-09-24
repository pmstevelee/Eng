import { LeadListPage, type LeadListSearchParams } from '@/components/shared/consultation/lead-pages'

export default async function TeacherConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<LeadListSearchParams>
}) {
  return <LeadListPage role="TEACHER" searchParams={await searchParams} />
}
