import { LeadDetailPage } from '@/components/shared/consultation/lead-pages'

export default async function OwnerConsultationDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>
}) {
  const { leadId } = await params
  return <LeadDetailPage role="ACADEMY_OWNER" leadId={leadId} />
}
