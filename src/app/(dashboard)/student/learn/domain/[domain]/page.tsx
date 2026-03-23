import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { getDomainQuestions } from '../../actions'
import { DomainClient } from './_components/domain-client'
import type { QuestionDomainType } from '@/components/shared/question-bank-client'

const DOMAIN_CONFIG = {
  GRAMMAR: {
    label: '문법',
    color: '#1865F2',
    bg: '#EEF4FF',
    border: '#BFDBFE',
    desc: '문법 규칙과 문장 구조를 연습합니다',
  },
  VOCABULARY: {
    label: '어휘',
    color: '#7854F7',
    bg: '#F3F0FF',
    border: '#DDD6FE',
    desc: '영어 단어와 표현을 확장합니다',
  },
  READING: {
    label: '독해',
    color: '#0FBFAD',
    bg: '#EFFAF9',
    border: '#A7F3D0',
    desc: '영어 지문을 읽고 이해하는 능력을 키웁니다',
  },
  WRITING: {
    label: '쓰기',
    color: '#E35C20',
    bg: '#FFF3EE',
    border: '#FDBA74',
    desc: '영어로 생각을 글로 표현하는 능력을 키웁니다',
  },
} as const

const VALID_DOMAINS = ['grammar', 'vocabulary', 'reading', 'writing']

export default async function DomainPracticePage({
  params,
}: {
  params: { domain: string }
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'STUDENT') redirect('/login')

  const domainParam = params.domain.toLowerCase()
  if (!VALID_DOMAINS.includes(domainParam)) notFound()

  const domainKey = domainParam.toUpperCase() as QuestionDomainType
  const cfg = DOMAIN_CONFIG[domainKey]

  // 학생 ID + 스킬 점수 가져오기
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { student: { select: { id: true } } },
  })
  if (!dbUser?.student) redirect('/login')

  const skillAssessment = await prisma.skillAssessment.findFirst({
    where: { studentId: dbUser.student.id, domain: domainKey },
    orderBy: { assessedAt: 'desc' },
    select: { score: true },
  })

  // 기본 난이도 2로 초기 문제 로드
  const initialQuestions = await getDomainQuestions(domainKey, 2)

  return (
    <div className="space-y-4">
      {/* 뒤로가기 + 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/student/learn"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{cfg.label} 연습</h1>
          <p className="text-xs text-gray-500">{cfg.desc}</p>
        </div>
      </div>

      {/* 현재 점수 배너 */}
      <div
        className="flex items-center justify-between rounded-xl border px-5 py-3.5"
        style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
      >
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cfg.color }} />
          <span className="text-sm font-semibold" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        {skillAssessment?.score !== null && skillAssessment?.score !== undefined ? (
          <div className="text-right">
            <span className="text-lg font-black" style={{ color: cfg.color }}>
              {skillAssessment.score}점
            </span>
            <span className="ml-1 text-xs text-gray-400">/ 100</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">테스트 완료 후 점수 측정</span>
        )}
      </div>

      {/* 도메인 클라이언트 (난이도 선택 + 풀이) */}
      <DomainClient
        domain={domainKey}
        domainColor={cfg.color}
        initialQuestions={initialQuestions}
      />
    </div>
  )
}
