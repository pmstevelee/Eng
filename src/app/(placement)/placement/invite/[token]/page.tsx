import { CheckCircle2, Clock, Link2Off, ShieldAlert } from 'lucide-react'
import { getInviteState } from '@/lib/placement/runner'
import { NoticeScreen, isPageRateLimited } from '../../public-page-utils'
import { PlacementTestShell } from './_components/placement-test-shell'

export const dynamic = 'force-dynamic'
// 마지막 쓰기 제출 시 AI 채점(GPT-4o-mini)까지 한 요청에서 처리
export const maxDuration = 60

/** 비회원 레벨테스트 응시 페이지 — 로그인 없이 토큰으로만 접근 */
export default async function PlacementInvitePage({ params }: { params: { token: string } }) {
  if (isPageRateLimited('invite')) {
    return (
      <NoticeScreen
        icon={ShieldAlert}
        iconClassName="bg-accent-gold-light text-accent-gold"
        title="잠시 후 다시 시도해주세요"
        description="짧은 시간에 요청이 너무 많았습니다."
      />
    )
  }

  const state = await getInviteState(params.token)

  if (state.kind === 'not_found') {
    return (
      <NoticeScreen
        icon={Link2Off}
        iconClassName="bg-gray-100 text-gray-500"
        title="유효하지 않은 링크입니다"
        description={'링크 주소를 다시 확인해주세요.\n문제가 계속되면 학원으로 문의해주세요.'}
      />
    )
  }
  if (state.kind === 'expired') {
    return (
      <NoticeScreen
        icon={Clock}
        iconClassName="bg-gray-100 text-gray-500"
        title="응시 기간이 지난 링크입니다"
        description={'레벨테스트 응시 기간이 끝났습니다.\n다시 응시하려면 학원에 새 링크를 요청해주세요.'}
      />
    )
  }
  if (state.kind === 'completed') {
    return (
      <NoticeScreen
        icon={CheckCircle2}
        iconClassName="bg-accent-green-light text-accent-green"
        academyName={state.academyName}
        title="이미 응시를 완료했습니다"
        description={`${state.studentName} 학생의 레벨테스트가 완료되었습니다.\n결과는 학원에서 확인 후 안내드립니다.`}
      />
    )
  }

  return (
    <PlacementTestShell
      token={params.token}
      inviteId={state.inviteId}
      studentName={state.studentName}
      academyName={state.academyName}
      started={state.started}
    />
  )
}
