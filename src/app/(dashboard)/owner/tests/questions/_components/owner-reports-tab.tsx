'use client'

import { useState, useTransition } from 'react'
import { Flag, CheckCircle, XCircle, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { resolveQuestionReport } from '@/lib/questions/report-actions'
import type { QuestionReportRow } from '@/lib/questions/report-actions'

const REPORT_TYPE_LABEL: Record<string, string> = {
  WRONG_ANSWER: '정답 오류',
  TYPO: '오탈자',
  UNCLEAR: '문제 불명확',
  AUDIO_ERROR: '음원 오류',
  OTHER: '기타',
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

type Props = {
  reports: QuestionReportRow[]
  academyId: string
}

export default function OwnerReportsTab({ reports, academyId: _academyId }: Props) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED' | 'DISMISSED'>('PENDING')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [localReports, setLocalReports] = useState<QuestionReportRow[]>(reports)

  const filtered = localReports.filter((r) =>
    statusFilter === 'ALL' ? true : r.status === statusFilter,
  )

  const pendingCount = localReports.filter((r) => r.status === 'PENDING').length

  function handleResolve(reportId: string, action: 'RESOLVED' | 'DISMISSED') {
    const note = resolveNotes[reportId] || ''
    setProcessingId(reportId)
    startTransition(async () => {
      const res = await resolveQuestionReport(reportId, action, note)
      setProcessingId(null)
      if (!res.error) {
        setLocalReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? { ...r, status: action, resolvedAt: new Date().toISOString(), resolveNote: note || null }
              : r,
          ),
        )
        setExpandedId(null)
      } else {
        alert(res.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">학원 문제 오류 신고</h2>
          {pendingCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-[#D92916]">
              {pendingCount}건 대기
            </span>
          )}
        </div>

        {/* 상태 필터 */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['ALL', 'PENDING', 'RESOLVED', 'DISMISSED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary-700 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'ALL' ? '전체' : s === 'PENDING' ? '대기' : s === 'RESOLVED' ? '처리완료' : '반려'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Flag className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">신고 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">문제</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">영역</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-24">유형</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-20">신고자</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-20">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-28">신고일</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((report) => (
                <>
                  <tr
                    key={report.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  >
                    <td className="px-4 py-3 text-gray-900 max-w-xs">
                      <p className="truncate">{report.questionText}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: DOMAIN_COLOR[report.questionDomain] }}
                      >
                        {DOMAIN_LABEL[report.questionDomain]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {REPORT_TYPE_LABEL[report.reportType]}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{report.reporterName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(report.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {expandedId === report.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </td>
                  </tr>

                  {expandedId === report.id && (
                    <tr key={`${report.id}-detail`}>
                      <td colSpan={7} className="bg-gray-50 px-4 py-4">
                        <div className="space-y-3">
                          {/* 문제 본문 */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">문제 본문</p>
                            <p className="text-sm text-gray-800 bg-white rounded-lg border border-gray-200 px-3 py-2">
                              {report.questionText}
                            </p>
                          </div>

                          {/* 신고 내용 */}
                          {report.description && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">신고 내용</p>
                              <p className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 px-3 py-2">
                                {report.description}
                              </p>
                            </div>
                          )}

                          {/* 처리 완료 노트 */}
                          {report.resolveNote && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">처리 메모</p>
                              <p className="text-sm text-gray-600 italic">{report.resolveNote}</p>
                            </div>
                          )}

                          {/* 액션 버튼 */}
                          {report.status === 'PENDING' ? (
                            <div className="flex items-start gap-3 pt-1">
                              <div className="flex-1">
                                <textarea
                                  value={resolveNotes[report.id] || ''}
                                  onChange={(e) =>
                                    setResolveNotes((prev) => ({ ...prev, [report.id]: e.target.value }))
                                  }
                                  placeholder="처리 메모 (선택)"
                                  rows={2}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none outline-none focus:border-primary-700"
                                />
                              </div>
                              <div className="flex flex-col gap-2 shrink-0">
                                <a
                                  href={`/owner/tests/questions?tab=academy`}
                                  className="flex items-center gap-1 rounded-lg border border-primary-700 px-4 py-2 text-xs font-semibold text-primary-700 hover:bg-blue-50"
                                >
                                  <Pencil className="h-3 w-3" />
                                  문제 수정
                                </a>
                                <button
                                  onClick={() => handleResolve(report.id, 'RESOLVED')}
                                  disabled={isPending && processingId === report.id}
                                  className="flex items-center gap-1 rounded-lg bg-[#1FAF54] px-4 py-2 text-xs font-semibold text-white hover:bg-[#18a049] disabled:opacity-60"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  처리완료
                                </button>
                                <button
                                  onClick={() => handleResolve(report.id, 'DISMISSED')}
                                  disabled={isPending && processingId === report.id}
                                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-60"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  반려
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">
                              {new Date(report.resolvedAt!).toLocaleDateString('ko-KR')} 처리됨
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
        대기
      </span>
    )
  }
  if (status === 'RESOLVED') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-[#1FAF54]">
        처리완료
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
      반려
    </span>
  )
}
