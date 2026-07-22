'use client'

import { useState } from 'react'
import type { ClassWordStats } from '../_actions/class-report'

function accuracyColor(rate: number) {
  if (rate >= 80) return 'text-[#1FAF54]'
  if (rate >= 60) return 'text-[#FFB100]'
  return 'text-[#D92916]'
}

export function ClassWordReport({ stats }: { stats: ClassWordStats }) {
  const [tab, setTab] = useState<'students' | 'weak' | 'pending' | 'promo'>('students')

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-100">
        {([
          ['students', '학생 현황'],
          ['weak', `약점 단어 (${stats.weakWords.length})`],
          ['pending', `미응시 시험 (${stats.pendingTests.length})`],
          ['promo', `승급 후보 (${stats.promotionCandidates.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-[#1865F2] text-[#1865F2]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 학생 현황 테이블 */}
      {tab === 'students' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-xs">
                <th className="text-left px-4 py-3 font-medium">학생</th>
                <th className="text-right px-4 py-3 font-medium">학습</th>
                <th className="text-right px-4 py-3 font-medium">마스터</th>
                <th className="text-right px-4 py-3 font-medium">최근 학습</th>
                <th className="text-right px-4 py-3 font-medium">평균 정답률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.students.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400 text-sm">
                    등록된 학생이 없습니다.
                  </td>
                </tr>
              )}
              {stats.students.map((s) => (
                <tr key={s.studentId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{s.learned.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{s.mastered.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {s.lastStudiedAt ?? '없음'}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${accuracyColor(s.avgAccuracy)}`}>
                    {s.avgAccuracy}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 약점 단어 TOP20 */}
      {tab === 'weak' && (
        <div className="space-y-2">
          {stats.weakWords.length === 0 && (
            <p className="text-center py-10 text-gray-400 text-sm">약점 단어가 없습니다.</p>
          )}
          {stats.weakWords.map((w, i) => (
            <div key={w.word} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 bg-white">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: i < 3 ? '#FEF3EC' : '#F9FAFB', color: i < 3 ? '#E35C20' : '#9CA3AF' }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{w.word}</p>
                {w.meaning && <p className="text-xs text-gray-400 truncate">{w.meaning}</p>}
              </div>
              <div className="text-right text-xs flex-shrink-0">
                <p className="text-[#D92916] font-medium">오답 {w.totalWrong}회</p>
                <p className="text-gray-400">{w.affectedStudents}명 영향</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 미응시 시험 */}
      {tab === 'pending' && (
        <div className="space-y-2">
          {stats.pendingTests.length === 0 && (
            <p className="text-center py-10 text-gray-400 text-sm">미응시 시험이 없습니다.</p>
          )}
          {stats.pendingTests.map((t) => (
            <div key={t.assignmentId} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-100 bg-white">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{t.title}</p>
                {t.endsAt && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    마감: {new Date(t.endsAt).toLocaleDateString('ko-KR')}
                  </p>
                )}
              </div>
              <span className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-[#FEF3EC] text-[#E35C20]">
                미응시 {t.notSubmittedCount}/{t.totalAssigned}명
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 승급 후보 */}
      {tab === 'promo' && (
        <div className="space-y-2">
          {stats.promotionCandidates.length === 0 && (
            <p className="text-center py-10 text-gray-400 text-sm">
              마스터 30개 이상 & 평균 정답률 80% 이상 학생이 없습니다.
            </p>
          )}
          {stats.promotionCandidates.map((c) => (
            <div key={c.studentId} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#1FAF54]/20 bg-[#F0FDF4]">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">현재 레벨 {c.currentLevel}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#1FAF54] text-white">
                승급 후보
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
