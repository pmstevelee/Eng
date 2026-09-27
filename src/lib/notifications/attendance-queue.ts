import 'server-only'

import { prisma } from '@/lib/prisma/client'
import type { CreditChannelValue, CreditPricingMap, NotificationJobTypeValue } from '@/lib/credits/constants'
import { chargeNotificationJob, getCreditPricing } from '@/lib/credits/wallet'
import { getNotificationMode } from './send'
import { getSolapiConfig, getSolapiDeliveryResult, sendSolapiMessage, type SolapiMessage } from './solapi'
import { NOTIFICATION_TEMPLATES, renderTemplate, toKakaoVariables, type TemplateKey } from './templates'

// 출결 알림 발송 큐 처리 (/api/cron/notifications, 1분 주기)
// 1) 정산: 접수된(SENT) 작업의 SOLAPI 최종 결과를 확인해 성공 건만 실제 채널 단가로 차감
// 2) 발송: PENDING 작업을 최대 100건 잠그고 SOLAPI로 발송 (알림톡 실패 시 SOLAPI가 SMS 대체발송)

const BATCH_SIZE = 100
const MAX_ATTEMPTS = 3
const PARALLEL = 5
/** 처리 중 잠금 시간 — 크론이 겹쳐도 같은 작업을 두 번 보내지 않도록 */
const LOCK_MS = 3 * 60_000
/** 이보다 오래 대기한 알림은 뒤늦게 보내지 않는다 (예: 크론 중단 후 재개) */
const STALE_MS = 60 * 60_000
/** 접수 후 이 시간이 지나도 최종 결과를 모르면 접수 채널 기준으로 정산 */
const SETTLE_GIVE_UP_MS = 24 * 60 * 60_000

export type QueueSummary = {
  settled: number
  deliveryFailed: number
  claimed: number
  sent: number
  retried: number
  failed: number
  noCredit: number
  logged: number
}

/** 작업 종류·변수로 템플릿 선택 (지각이면 수업시작 포함, 학습요약이 있으면 요약 포함) */
export function templateKeyForJob(type: NotificationJobTypeValue, variables: Record<string, string>): TemplateKey {
  if (type === 'CHECK_IN') return variables['수업시작'] ? 'ATTENDANCE_CHECK_IN_LATE' : 'ATTENDANCE_CHECK_IN'
  if (type === 'CHECK_OUT') return variables['학습요약'] ? 'ATTENDANCE_CHECK_OUT_SUMMARY' : 'ATTENDANCE_CHECK_OUT'
  return 'ATTENDANCE_ABSENT'
}

function readVariables(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) if (typeof v === 'string') out[k] = v
  return out
}

/** SMS 90바이트(EUC-KR 기준, 한글 2바이트) 초과 시 LMS */
function textKind(text: string): 'SMS' | 'LMS' {
  let bytes = 0
  for (const ch of text) bytes += ch.charCodeAt(0) > 0x7f ? 2 : 1
  return bytes > 90 ? 'LMS' : 'SMS'
}

export async function processNotificationQueue(): Promise<QueueSummary> {
  const summary: QueueSummary = {
    settled: 0,
    deliveryFailed: 0,
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    noCredit: 0,
    logged: 0,
  }
  const pricing = await getCreditPricing()
  await settleSentJobs(pricing, summary)
  await sendPendingJobs(pricing, summary)
  return summary
}

// ─── 1) 정산 ───────────────────────────────────────────────────────────────────

async function settleSentJobs(pricing: CreditPricingMap, summary: QueueSummary): Promise<void> {
  const config = getSolapiConfig()
  const jobs = await prisma.notificationJob.findMany({
    where: { status: 'SENT', settledAt: null, providerMessageId: { not: null } },
    orderBy: { sentAt: 'asc' },
    take: BATCH_SIZE,
    select: {
      id: true,
      channel: true,
      sentAt: true,
      providerMessageId: true,
      academy: { select: { id: true, parentAcademyId: true } },
    },
  })

  for (let i = 0; i < jobs.length; i += PARALLEL) {
    await Promise.all(
      jobs.slice(i, i + PARALLEL).map(async (job) => {
        const walletAcademyId = job.academy.parentAcademyId ?? job.academy.id
        const charge = async (channel: CreditChannelValue) => {
          const r = await chargeNotificationJob({ jobId: job.id, walletAcademyId, channel, credits: pricing[channel] })
          if (r.ok) summary.settled++
        }

        const result = config
          ? await getSolapiDeliveryResult(config, job.providerMessageId!)
          : ({ state: 'ERROR', error: 'SOLAPI 설정 없음' } as const)

        if (result.state === 'DELIVERED') return charge(result.channel)
        if (result.state === 'FAILED') {
          // 최종 실패 — 차감하지 않음. 이미 SOLAPI가 대체발송까지 시도했으므로 재발송하지 않는다.
          await prisma.notificationJob.updateMany({
            where: { id: job.id, settledAt: null },
            data: { status: 'FAILED', settledAt: new Date(), errorMessage: result.error.slice(0, 500) },
          })
          summary.deliveryFailed++
          return
        }
        // 결과 대기 중 / 조회 오류 — 너무 오래되면 접수 채널 기준으로 정산
        if (job.sentAt && Date.now() - job.sentAt.getTime() > SETTLE_GIVE_UP_MS) {
          return charge(job.channel === 'SMS' ? 'SMS' : 'ALIMTALK')
        }
      }),
    )
  }
}

// ─── 2) 발송 ───────────────────────────────────────────────────────────────────

/** 대기 작업 선점 (FOR UPDATE SKIP LOCKED + 잠금 시각) */
async function claimPendingJobs(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE notification_jobs SET locked_until = now() + ($1::int * interval '1 millisecond')
     WHERE id IN (
       SELECT id FROM notification_jobs
       WHERE status = 'PENDING' AND (locked_until IS NULL OR locked_until < now())
       ORDER BY created_at
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id`,
    LOCK_MS,
    BATCH_SIZE,
  )
  return rows.map((r) => r.id)
}

/**
 * 지갑별 발송 가능 크레딧 = 잔액 − 접수됐지만 아직 정산 안 된 건의 예상 차감액.
 * 정산 전 발송분 때문에 잔액보다 많이 보내는 일을 막는다.
 */
async function loadAvailableCredits(walletIds: string[], pricing: CreditPricingMap): Promise<Map<string, number>> {
  const available = new Map<string, number>()
  if (walletIds.length === 0) return available
  const [wallets, reserved] = await Promise.all([
    prisma.creditWallet.findMany({ where: { academyId: { in: walletIds } }, select: { academyId: true, balance: true } }),
    prisma.$queryRawUnsafe<{ wallet_id: string; channel: CreditChannelValue | null; cnt: number }[]>(
      `SELECT COALESCE(a.parent_academy_id, a.id) AS wallet_id, j.channel::text AS channel, count(*)::int AS cnt
       FROM notification_jobs j JOIN academies a ON a.id = j.academy_id
       WHERE j.status = 'SENT' AND j.settled_at IS NULL AND j.provider_message_id IS NOT NULL
         AND COALESCE(a.parent_academy_id, a.id) = ANY($1::text[])
       GROUP BY 1, 2`,
      walletIds,
    ),
  ])
  for (const id of walletIds) available.set(id, 0)
  for (const w of wallets) available.set(w.academyId, w.balance)
  for (const r of reserved) {
    const price = pricing[r.channel ?? 'ALIMTALK'] ?? pricing.ALIMTALK
    available.set(r.wallet_id, (available.get(r.wallet_id) ?? 0) - price * r.cnt)
  }
  return available
}

async function sendPendingJobs(pricing: CreditPricingMap, summary: QueueSummary): Promise<void> {
  const ids = await claimPendingJobs()
  if (ids.length === 0) return
  summary.claimed = ids.length

  const jobs = await prisma.notificationJob.findMany({
    where: { id: { in: ids }, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      phone: true,
      variables: true,
      attempts: true,
      createdAt: true,
      academy: { select: { id: true, parentAcademyId: true } },
    },
  })

  const mode = getNotificationMode()
  const config = getSolapiConfig()
  const available = await loadAvailableCredits(
    Array.from(new Set(jobs.map((j) => j.academy.parentAcademyId ?? j.academy.id))),
    pricing,
  )

  // 크레딧 확인은 순서대로 (같은 지갑의 여러 건이 병렬로 잔액을 넘지 않게) → 발송만 병렬
  const toSend: { job: (typeof jobs)[number]; templateKey: TemplateKey; variables: Record<string, string> }[] = []
  for (const job of jobs) {
    const now = Date.now()
    if (now - job.createdAt.getTime() > STALE_MS) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', lockedUntil: null, errorMessage: '발송 대기 시간이 지나 보내지 않았습니다.' },
      })
      summary.failed++
      continue
    }
    const walletId = job.academy.parentAcademyId ?? job.academy.id
    const left = available.get(walletId) ?? 0
    if (mode === 'live' && left < pricing.ALIMTALK) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: { status: 'SKIPPED_NO_CREDIT', lockedUntil: null, errorMessage: `크레딧 부족 (발송 가능 ${Math.max(0, left)})` },
      })
      summary.noCredit++
      continue
    }
    // SMS 대체발송이면 단가가 더 높을 수 있어 넉넉히 SMS 단가로 예약
    available.set(walletId, left - Math.max(pricing.ALIMTALK, pricing.SMS))
    const variables = readVariables(job.variables)
    toSend.push({ job, templateKey: templateKeyForJob(job.type, variables), variables })
  }

  for (let i = 0; i < toSend.length; i += PARALLEL) {
    await Promise.all(
      toSend.slice(i, i + PARALLEL).map(({ job, templateKey, variables }) =>
        sendJob(job, templateKey, variables, mode, config, pricing, summary),
      ),
    )
  }
}

async function sendJob(
  job: { id: string; phone: string; attempts: number; academy: { id: string; parentAcademyId: string | null } },
  templateKey: TemplateKey,
  variables: Record<string, string>,
  mode: ReturnType<typeof getNotificationMode>,
  config: ReturnType<typeof getSolapiConfig>,
  pricing: CreditPricingMap,
  summary: QueueSummary,
): Promise<void> {
  const text = renderTemplate(templateKey, variables)
  const templateId = process.env[NOTIFICATION_TEMPLATES[templateKey].templateIdEnv] || null
  const useAlimtalk = !!templateId && !!config?.pfId
  const channel: CreditChannelValue = useAlimtalk ? 'ALIMTALK' : 'SMS'

  if (mode === 'log') {
    // 서버 로그에 연락처가 남지 않도록 뒤 4자리만. 실제 발송이 아니므로 차감하지 않는다.
    console.log(`[attendance-notify:log] ${templateKey} → ***${job.phone.slice(-4)} (${channel})\n${text}`)
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        settledAt: new Date(),
        lockedUntil: null,
        attempts: job.attempts + 1,
        errorMessage: 'log 모드: 실제로 발송하지 않았습니다. (크레딧 차감 없음)',
      },
    })
    summary.logged++
    return
  }

  const fail = async (error: string) => {
    const attempts = job.attempts + 1
    const final = attempts >= MAX_ATTEMPTS
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        attempts,
        status: final ? 'FAILED' : 'PENDING',
        // 재시도는 1분·2분 뒤로 미룸
        lockedUntil: final ? null : new Date(Date.now() + attempts * 60_000),
        errorMessage: error.slice(0, 500),
      },
    })
    if (final) summary.failed++
    else summary.retried++
  }

  if (!config) return fail('SOLAPI 환경변수(API 키·시크릿·발신번호)가 설정되지 않았습니다.')

  const phone = job.phone.replace(/\D/g, '')
  const message: SolapiMessage = useAlimtalk
    ? { kind: 'ALIMTALK', to: phone, templateId: templateId!, variables: toKakaoVariables(templateKey, variables) }
    : {
        kind: textKind(text),
        to: phone,
        text,
        subject: `[${variables['학원명'] ?? ''}] ${NOTIFICATION_TEMPLATES[templateKey].label}`.slice(0, 40),
      }

  const result = await sendSolapiMessage(config, message)
  if (!result.ok) return fail(result.error)

  await prisma.notificationJob.update({
    where: { id: job.id },
    data: {
      status: 'SENT',
      channel,
      sentAt: new Date(),
      providerMessageId: result.messageId,
      attempts: job.attempts + 1,
      lockedUntil: null,
      errorMessage: null,
    },
  })
  summary.sent++

  // 메시지 ID가 없으면 결과 조회가 불가능 → 접수 채널 기준으로 바로 정산
  if (!result.messageId) {
    await chargeNotificationJob({
      jobId: job.id,
      walletAcademyId: job.academy.parentAcademyId ?? job.academy.id,
      channel,
      credits: pricing[channel],
    })
  }
}
