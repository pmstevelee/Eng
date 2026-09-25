import { redirect } from 'next/navigation'
import { getConsultationActor } from '@/lib/consultation/access'
import { appBaseUrl } from '@/lib/consultation/app-url'
import {
  DEFAULT_REGULAR_CYCLE,
  DEFAULT_RETENTION_MONTHS,
  DEFAULT_STALE_DAYS,
  readConsultationNotifications,
  readDefaultAssigneeId,
  readRegularCycle,
  readRetentionMonths,
  readStaleDays,
  readWebFormSettings,
} from '@/lib/consultation/constants'
import { getPurgeSchedule } from '@/lib/consultation/purge'
import { getAssigneeOptions } from '@/lib/consultation/queries'
import { readRiskSettings } from '@/lib/consultation/risk-constants'
import { prisma } from '@/lib/prisma/client'
import { ConsultationSettingsClient, type AcademyConsultationSettings } from './_components/consultation-settings-client'

export default async function ConsultationSettingsPage() {
  const actor = await getConsultationActor()
  if (!actor || actor.role !== 'ACADEMY_OWNER') redirect('/login')

  const academies = await prisma.academy.findMany({
    where: { id: { in: actor.academyIds }, isDeleted: false },
    select: { id: true, name: true, branchName: true, parentAcademyId: true, branchOrder: true, slug: true, settingsJson: true },
    orderBy: { branchOrder: 'asc' },
  })
  // 본원 먼저, 지점은 순서대로
  academies.sort((a, b) => (a.parentAcademyId ? 1 : 0) - (b.parentAcademyId ? 1 : 0))

  const [assigneeOptions, purgeSchedule] = await Promise.all([
    Promise.all(academies.map((a) => getAssigneeOptions(actor, a.id))),
    getPurgeSchedule(actor),
  ])
  const main = academies.find((a) => a.id === actor.academyId) ?? academies[0]

  const items: AcademyConsultationSettings[] = academies.map((a, i) => ({
    id: a.id,
    label: a.parentAcademyId ? (a.branchName ?? a.name) : '본원',
    slug: a.slug ?? '',
    defaultAssigneeId: readDefaultAssigneeId(a.settingsJson) ?? '',
    regularCycle: readRegularCycle(a.settingsJson) ?? DEFAULT_REGULAR_CYCLE,
    webForm: readWebFormSettings(a.settingsJson),
    assigneeOptions: assigneeOptions[i],
  }))

  return (
    <ConsultationSettingsClient
      baseUrl={appBaseUrl()}
      general={{
        staleDays: readStaleDays(main?.settingsJson) ?? DEFAULT_STALE_DAYS,
        retentionMonths: readRetentionMonths(main?.settingsJson) ?? DEFAULT_RETENTION_MONTHS,
      }}
      risk={readRiskSettings(main?.settingsJson)}
      notifications={readConsultationNotifications(main?.settingsJson)}
      purgeSchedule={purgeSchedule}
      showAcademyLabel={academies.length > 1}
      academies={items}
    />
  )
}
