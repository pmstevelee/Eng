import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight, Download, Layers, Target, PenLine } from 'lucide-react'
import { getWordSetOverview } from '@/app/(dashboard)/student/words/_actions'
import { NavLinkWithLoading } from '@/components/shared/nav-link-with-loading'
import { ExamCategoryBadges } from '@/components/words/exam-category-badges'
import { getLevelInfo } from '@/lib/constants/levels'

interface Props {
  params: Promise<{ setId: string }>
}

const STUDY_TYPES = [
  {
    key: 'flashcard',
    title: '플래시카드',
    description: '카드를 넘기며 뜻을 먼저 익혀요',
    icon: Layers,
    color: '#7854F7',
  },
  {
    key: 'recall',
    title: '리콜 퀴즈',
    description: '객관식 문제로 기억을 확인해요',
    icon: Target,
    color: '#1865F2',
  },
  {
    key: 'spell',
    title: '스펠링 연습',
    description: '철자를 직접 입력해 완성해요',
    icon: PenLine,
    color: '#1FAF54',
  },
] as const

export default async function WordSetOverviewPage({ params }: Props) {
  const { setId } = await params

  // 신규 단어 진도 초기화는 실제로 문제 유형을 선택해 학습을 시작할 때 수행한다
  // (개요 화면은 조회만 하므로 무거운 초기화 쿼리를 반복 실행하지 않는다).
  const result = await getWordSetOverview(setId)

  if (!result.ok) {
    if (result.error.code === 'FORBIDDEN' || result.error.code === 'NOT_FOUND') {
      redirect('/student/words')
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
        <p className="text-gray-500">{result.error.message}</p>
        <Link href="/student/words" className="text-sm text-[#7854F7] underline underline-offset-4">
          단어 허브로 돌아가기
        </Link>
      </div>
    )
  }

  const set = result.data
  const levelInfo = getLevelInfo(set.cefrLevel)
  const progressPct = set.totalWords > 0 ? Math.round((set.masteredWords / set.totalWords) * 100) : 0
  const learningWords = set.startedWords - set.masteredWords

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-8">
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/student/words"
          className="flex items-center text-sm text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="단어 허브로 돌아가기"
        >
          <ChevronLeft className="w-4 h-4" />
          단어 허브
        </Link>
      </div>

      {/* 세트 정보 */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: '#F3F0FF', color: '#7854F7', border: '1px solid #DDD6FE' }}
          >
            {levelInfo.cefr}
          </span>
          <span className="text-xs text-gray-400">{set.totalWords}단어</span>
          {set.examCategory && <ExamCategoryBadges categories={[set.examCategory]} />}
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-1">{set.title}</h1>
        {set.description && <p className="text-sm text-gray-500 mb-3">{set.description}</p>}

        {/* 학습 진행 현황 */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">학습 진행</span>
            <span className="text-xs font-semibold text-[#7854F7]">
              {set.masteredWords} / {set.totalWords} 마스터
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1FAF54] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {(learningWords > 0 || set.startedWords === 0) && (
            <p className="text-xs text-gray-400 mt-1.5">
              {set.startedWords === 0
                ? '아직 학습을 시작하지 않았어요'
                : `${learningWords}개 학습 중 · ${set.totalWords - set.startedWords}개 학습 전`}
            </p>
          )}
        </div>
      </div>

      {/* 문제유형 선택 */}
      <div className="mb-2">
        <h2 className="text-sm font-bold text-gray-900 mb-3">문제 유형 선택</h2>
        <div className="flex flex-col gap-3">
          {STUDY_TYPES.map((type) => (
            <NavLinkWithLoading
              key={type.key}
              href={`/student/words/${setId}/${type.key}`}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-[#7854F7]/40 hover:shadow-sm transition-all"
              loadingLabel={`${type.title}로 이동 중...`}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${type.color}1A` }}
              >
                <type.icon className="h-5 w-5" style={{ color: type.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{type.title}</p>
                <p className="text-xs text-gray-500">{type.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
            </NavLinkWithLoading>
          ))}
        </div>
      </div>

      <Link
        href={`/words/${setId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-[#1865F2]"
      >
        <Download className="h-3.5 w-3.5" />
        단어 목록 다운로드
      </Link>
    </div>
  )
}
