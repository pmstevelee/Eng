'use client'

import { Printer } from 'lucide-react'

type AcademyInfo = {
  name: string
  businessName: string | null
  address: string | null
  phone: string | null
}

type TestInfo = {
  id: string
  title: string
  type: string
  status: string
  totalScore: number
  timeLimitMin: number | null
  questionCount: number
  creatorName: string
  className: string | null
  createdAt: string
}

type SessionInfo = {
  id: string
  studentName: string
  className: string | null
  status: string
  score: number | null
  grammarScore: number | null
  vocabularyScore: number | null
  readingScore: number | null
  writingScore: number | null
  listeningScore: number | null
  durationMin: number | null
}

type QuestionStat = {
  id: string
  index: number
  domain: string
  questionText: string
  totalAttempts: number
  correctCount: number
  correctRate: number
}

type Props = {
  academy: AcademyInfo
  test: TestInfo
  sessions: SessionInfo[]
  questionStats: QuestionStat[]
}

const TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안',
  PUBLISHED: '배포됨',
  GRADED: '채점완료',
}

const SESSION_LABEL: Record<string, string> = {
  NOT_STARTED: '미응시',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  GRADED: '채점완료',
}

const DOMAIN_LABEL: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
  LISTENING: '듣기',
}

const DOMAIN_COLOR: Record<string, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
  LISTENING: '#E91E8A',
}

export function TestReportPrint({ academy, test, sessions, questionStats }: Props) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const completedSessions = sessions.filter((s) =>
    ['COMPLETED', 'GRADED'].includes(s.status),
  )
  const totalSessions = sessions.length
  const completionRate =
    totalSessions > 0
      ? Math.round((completedSessions.length / totalSessions) * 100)
      : 0

  const scoredSessions = sessions.filter((s) => s.score !== null)
  const avgScore =
    scoredSessions.length > 0
      ? Math.round(
          scoredSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) /
            scoredSessions.length,
        )
      : null

  // 영역별 평균
  const domainKeys = [
    'grammarScore',
    'vocabularyScore',
    'readingScore',
    'writingScore',
    'listeningScore',
  ] as const
  const domainNames = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING', 'LISTENING']
  const domainAverages = domainKeys.map((key, i) => {
    const scored = sessions.filter((s) => s[key] !== null)
    const avg =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, s) => sum + (s[key] ?? 0), 0) / scored.length,
          )
        : null
    return {
      key: domainNames[i],
      label: DOMAIN_LABEL[domainNames[i]],
      avg,
      color: DOMAIN_COLOR[domainNames[i]],
    }
  })

  const createdDate = new Date(test.createdAt).toLocaleDateString('ko-KR')
  const notStartedCount = sessions.filter((s) => s.status === 'NOT_STARTED').length

  return (
    <div className="bg-white min-h-screen">
      {/* 상단 버튼 - 인쇄 시 숨김 */}
      <div className="print:hidden flex items-center justify-between px-8 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <button
          onClick={() => window.history.back()}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← 돌아가기
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 h-10 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Printer size={15} />
          인쇄 / PDF 저장
        </button>
      </div>

      {/* 리포트 본문 */}
      <div className="max-w-4xl mx-auto px-8 py-8 print:px-6 print:py-6">

        {/* 학원 헤더 */}
        <div className="border-b-2 border-gray-900 pb-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                {academy.businessName ?? academy.name}
              </p>
              <h1 className="text-2xl font-bold text-gray-900">테스트 결과 리포트</h1>
              <div className="mt-1.5 space-y-0.5">
                {academy.address && (
                  <p className="text-xs text-gray-400">{academy.address}</p>
                )}
                {academy.phone && (
                  <p className="text-xs text-gray-400">TEL. {academy.phone}</p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">발행일</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{today}</p>
            </div>
          </div>
        </div>

        {/* 테스트 정보 */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">{test.title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '유형', value: TYPE_LABEL[test.type] ?? test.type },
              { label: '출제 교사', value: test.creatorName },
              { label: '대상 반', value: test.className ?? '전체' },
              { label: '출제일', value: createdDate },
              { label: '총 문항 수', value: `${test.questionCount}문제` },
              {
                label: '시간 제한',
                value: test.timeLimitMin ? `${test.timeLimitMin}분` : '제한 없음',
              },
              { label: '만점', value: `${test.totalScore}점` },
              { label: '상태', value: STATUS_LABEL[test.status] ?? test.status },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 요약 통계 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: '총 대상', value: `${totalSessions}명`, color: '#21242C' },
            {
              label: '응시 완료',
              value: `${completedSessions.length}명 (${completionRate}%)`,
              color: '#1FAF54',
            },
            { label: '미응시', value: `${notStartedCount}명`, color: '#FFB100' },
            {
              label: '평균 점수',
              value: avgScore !== null ? `${avgScore}점` : '채점 전',
              color: '#1865F2',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border border-gray-200 rounded-xl p-4 text-center"
            >
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="text-xl font-bold" style={{ color: item.color }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* 영역별 평균 */}
        {domainAverages.some((d) => d.avg !== null) && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">영역별 평균 점수</h3>
            <div className="grid grid-cols-5 gap-3">
              {domainAverages.map((d) => (
                <div
                  key={d.key}
                  className="border border-gray-100 rounded-xl p-3 text-center"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full mx-auto mb-1.5"
                    style={{ backgroundColor: d.color }}
                  />
                  <p className="text-xs text-gray-500 mb-1">{d.label}</p>
                  <p
                    className="text-lg font-bold"
                    style={{ color: d.avg !== null ? d.color : '#9CA3AF' }}
                  >
                    {d.avg !== null ? d.avg : '-'}
                  </p>
                  <p className="text-xs text-gray-400">{d.avg !== null ? '점' : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 학생별 결과 테이블 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">학생별 결과</h3>
          {sessions.length === 0 ? (
            <div className="border border-gray-200 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">배포된 학생이 없습니다.</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                      학생명
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">
                      반
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">
                      상태
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">
                      총점
                    </th>
                    <th
                      className="text-center text-xs font-semibold px-3 py-3"
                      style={{ color: DOMAIN_COLOR.GRAMMAR }}
                    >
                      문법
                    </th>
                    <th
                      className="text-center text-xs font-semibold px-3 py-3"
                      style={{ color: DOMAIN_COLOR.VOCABULARY }}
                    >
                      어휘
                    </th>
                    <th
                      className="text-center text-xs font-semibold px-3 py-3"
                      style={{ color: DOMAIN_COLOR.READING }}
                    >
                      읽기
                    </th>
                    <th
                      className="text-center text-xs font-semibold px-3 py-3"
                      style={{ color: DOMAIN_COLOR.WRITING }}
                    >
                      쓰기
                    </th>
                    <th
                      className="text-center text-xs font-semibold px-3 py-3"
                      style={{ color: DOMAIN_COLOR.LISTENING }}
                    >
                      듣기
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">
                      소요시간
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {s.studentName}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">
                        {s.className ?? '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs font-medium text-gray-600">
                          {SESSION_LABEL[s.status] ?? s.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-gray-900">
                        {s.score !== null ? s.score : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 text-sm">
                        {s.grammarScore !== null ? s.grammarScore : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 text-sm">
                        {s.vocabularyScore !== null ? s.vocabularyScore : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 text-sm">
                        {s.readingScore !== null ? s.readingScore : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 text-sm">
                        {s.writingScore !== null ? s.writingScore : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 text-sm">
                        {s.listeningScore !== null ? s.listeningScore : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-400 text-xs">
                        {s.durationMin !== null ? `${s.durationMin}분` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 문제별 정답률 */}
        {questionStats.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">문제별 정답률</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-12">
                      번호
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 w-20">
                      영역
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">
                      문제
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 w-16">
                      응시
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 w-20">
                      정답률
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {questionStats.map((q) => {
                    const rateColor =
                      q.totalAttempts === 0
                        ? '#9CA3AF'
                        : q.correctRate >= 70
                          ? '#1FAF54'
                          : q.correctRate >= 40
                            ? '#FFB100'
                            : '#D92916'
                    return (
                      <tr key={q.id}>
                        <td className="px-4 py-2.5 text-xs text-gray-400">
                          #{q.index}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${DOMAIN_COLOR[q.domain] ?? '#9CA3AF'}18`,
                              color: DOMAIN_COLOR[q.domain] ?? '#6B7280',
                            }}
                          >
                            {DOMAIN_LABEL[q.domain] ?? q.domain}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 text-xs max-w-xs">
                          <span className="line-clamp-1">{q.questionText}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-gray-500">
                          {q.totalAttempts}명
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-sm font-semibold" style={{ color: rateColor }}>
                            {q.totalAttempts > 0 ? `${q.correctRate}%` : '-'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 리포트 푸터 */}
        <div className="pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400">
          <span>{academy.businessName ?? academy.name}</span>
          <span>EduLevel · {today}</span>
        </div>
      </div>
    </div>
  )
}
