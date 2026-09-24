import { LeadDetailPage } from '@/components/shared/consultation/lead-pages'

export default async function TeacherConsultationDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>
}) {
  const { leadId } = await params
  return <LeadDetailPage role="TEACHER" leadId={leadId} />
}
