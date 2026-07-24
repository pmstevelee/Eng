'use client'

import { Printer } from 'lucide-react'
import { LEVEL_TO_CEFR } from '@/lib/constants/levels'

type AcademyInfo = {
  name: string
  businessName: string | null
  address: string | null
  phone: string | null
} | null

type WordRow = {
  term: string
  partOfSpeech: string
  meaning: string | null
  definition: string | null
  example: string | null
}

type Props = {
  academy: AcademyInfo
  printedBy: { label: string; name: string }
  wordSet: {
    title: string
    description: string | null
    cefrLevel: number
  }
  words: WordRow[]
}

export function WordSetPrint({ academy, printedBy, wordSet, words }: Props) {
  const issuedAt = new Date().toLocaleDateString('ko-KR')
  const cefrLabel = LEVEL_TO_CEFR[wordSet.cefrLevel] ?? `Lv${wordSet.cefrLevel}`

  return (
    <div className="min-h-screen bg-white">
      {/* 인쇄 시 숨길 툴바 */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <span className="text-sm font-semibold text-gray-700">단어 학습 자료</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-[#1865F2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1558d6]"
        >
          <Printer className="h-4 w-4" />
          PDF 저장 / 인쇄
        </button>
      </div>

      {/* 문서 본문 */}
      <div className="mx-auto max-w-3xl px-8 py-10 print:px-6 print:py-8">
        {/* 헤더: 학원 레터헤드 */}
        <div className="mb-6 border-b-2 border-[#0C2340] pb-6">
          <div className="flex items-start justify-between">
            <div>
              {academy && (
                <p className="text-sm font-semibold text-[#0C2340]">
                  {academy.businessName ?? academy.name}
                </p>
              )}
              <h1 className="mt-1 text-2xl font-bold text-gray-900">단어 학습 자료</h1>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>발행일: {issuedAt}</p>
              {academy?.phone && <p>{academy.phone}</p>}
              {academy?.address && <p>{academy.address}</p>}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-400">{printedBy.label}</span>
              <span className="ml-2 font-semibold text-gray-800">{printedBy.name}</span>
            </div>
            <div>
              <span className="text-gray-400">단어 세트</span>
              <span className="ml-2 font-semibold text-gray-800">{wordSet.title}</span>
              <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {cefrLabel}
              </span>
            </div>
            <div>
              <span className="text-gray-400">단어 수</span>
              <span className="ml-2 font-semibold text-gray-800">{words.length}개</span>
            </div>
          </div>
          {wordSet.description && (
            <p className="mt-2 text-xs text-gray-500">{wordSet.description}</p>
          )}
        </div>

        {/* 단어 목록 */}
        <table className="w-full border-collapse text-sm">
          <thead className="table-header-group">
            <tr className="border-b-2 border-gray-300 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="w-10 px-2 py-2 font-semibold">No</th>
              <th className="w-32 px-2 py-2 font-semibold">영어단어</th>
              <th className="w-24 px-2 py-2 font-semibold">한국어 뜻</th>
              <th className="px-2 py-2 font-semibold">영영풀이</th>
              <th className="px-2 py-2 font-semibold">예문</th>
            </tr>
          </thead>
          <tbody>
            {words.map((w, i) => (
              <tr
                key={`${w.term}-${i}`}
                className="border-b border-gray-200 align-top print:break-inside-avoid"
              >
                <td className="px-2 py-2.5 text-xs text-gray-400">{i + 1}</td>
                <td className="px-2 py-2.5">
                  <p className="font-semibold text-gray-900">{w.term}</p>
                  <p className="text-xs text-gray-400">{w.partOfSpeech}</p>
                </td>
                <td className="px-2 py-2.5 text-gray-700">{w.meaning ?? '—'}</td>
                <td className="px-2 py-2.5 text-gray-600">{w.definition ?? '—'}</td>
                <td className="px-2 py-2.5 text-gray-600">{w.example ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 푸터 */}
        <div className="mt-10 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
          {academy && <span>{academy.businessName ?? academy.name} · </span>}
          EduLevel LMS · 단어 학습 자료
        </div>
      </div>

      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 15mm; }
          thead { display: table-header-group; }
        }
      `}</style>
    </div>
  )
}
