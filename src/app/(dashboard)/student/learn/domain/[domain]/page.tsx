import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma/client'
import { getDomainProfileData } from '../../actions'
import { DomainClient } from './_components/domain-client'
import type { QuestionDomainType } from '@/components/shared/question-bank-client'

const DOMAIN_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; desc: string }> = {
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
  LISTENING: {
    label: '듣기',
    color: '#0EA5E9',
    bg: '#E0F2FE',
    border: '#BAE6FD',
    desc: '영어 음성을 듣고 이해하는 능력을 키웁니다',
  },
}

const VALID_DOMAINS = ['grammar', 'vocabulary', 'reading', 'writing', 'listening']

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

  // 도메인 프로필 데이터 (카테고리별 정확도 포함)
  const profileData = await getDomainProfileData(domainKey)

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

      {/* 도메인 클라이언트 (모드 선택 + 풀이) */}
      <DomainClient
        domain={domainKey}
        domainLabel={cfg.label}
        domainColor={cfg.color}
        domainBg={cfg.bg}
        domainBorder={cfg.border}
        profileData={profileData}
      />
    </div>
  )
}
