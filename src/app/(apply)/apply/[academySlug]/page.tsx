import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { CalendarOff, SearchX, ShieldAlert } from 'lucide-react'
import { NoticeScreen } from '@/app/(placement)/placement/public-page-utils'
import { getApplyPageData } from '@/lib/consultation/web-inquiry'
import { sanitizeSource } from '@/lib/consultation/constants'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { ApplyForm } from './_components/apply-form'

// 요청마다 제출 간격 검사용 토큰을 새로 발급해야 하므로 캐시하지 않음
export const dynamic = 'force-dynamic'

type Props = {
  params: { academySlug: string }
  searchParams: { src?: string | string[] }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getApplyPageData(params.academySlug.toLowerCase())
  return { title: data.kind === 'not_found' ? '상담 신청' : `${data.academyName} 상담 신청` }
}

function isRateLimited(): boolean {
  const h = headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  return !checkRateLimit(`apply:view:${ip}`, { max: 60 }).allowed
}

export default async function ApplyPage({ params, searchParams }: Props) {
  if (isRateLimited()) {
    return (
      <NoticeScreen
        icon={ShieldAlert}
        iconClassName="bg-accent-gold-light text-[#9A6B00]"
        title="잠시 후 다시 접속해주세요"
        description="짧은 시간에 요청이 많아 잠시 접속이 제한되었습니다."
      />
    )
  }

  const data = await getApplyPageData(params.academySlug.toLowerCase())

  if (data.kind === 'not_found') {
    return (
      <NoticeScreen
        icon={SearchX}
        iconClassName="bg-gray-100 text-gray-500"
        title="신청 페이지를 찾을 수 없습니다"
        description={'주소가 정확한지 확인해주세요.\n학원에서 받은 링크나 QR 코드로 다시 접속해주세요.'}
      />
    )
  }

  if (data.kind === 'disabled') {
    return (
      <NoticeScreen
        icon={CalendarOff}
        iconClassName="bg-gray-100 text-gray-500"
        title="현재 온라인 상담 신청을 받고 있지 않습니다"
        description="상담을 원하시면 학원으로 직접 연락 부탁드립니다."
        academyName={data.academyName}
      />
    )
  }

  const src = Array.isArray(searchParams.src) ? searchParams.src[0] : searchParams.src

  return (
    <ApplyForm
      slug={params.academySlug.toLowerCase()}
      source={sanitizeSource(src) ?? ''}
      academyName={data.academyName}
      academyPhone={data.academyPhone}
      intro={data.intro}
      fields={data.fields}
      retentionMonths={data.retentionMonths}
      formToken={data.formToken}
    />
  )
}
