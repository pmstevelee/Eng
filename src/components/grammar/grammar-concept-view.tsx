// 문법 포인트 개념 정리 — 학생 화면과 관리자 미리보기가 같이 쓴다 (훅 없음)

import { CheckCircle2, XCircle } from 'lucide-react'
import type { GrammarCommonError, GrammarExample, GrammarRule } from '@/types/grammar'

export interface GrammarConceptViewProps {
  title: string
  summary: string | null
  rules: GrammarRule[]
  examples: GrammarExample[]
  commonErrors: GrammarCommonError[]
  /** 학생 화면: 예문 해석을 접어 두고 눌러서 펼치기 (기본값 false = 항상 보임) */
  foldTranslations?: boolean
  /** 제목 숨기기 (페이지 머리글에 제목이 이미 있을 때) */
  hideTitle?: boolean
}

function HighlightedSentence({ text, highlight }: { text: string; highlight?: string }) {
  const idx = highlight ? text.indexOf(highlight) : -1
  if (!highlight || idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-[#EEF4FF] px-0.5 font-semibold text-[#1865F2]">{highlight}</mark>
      {text.slice(idx + highlight.length)}
    </>
  )
}

export function GrammarConceptView({
  title,
  summary,
  rules,
  examples,
  commonErrors,
  foldTranslations = false,
  hideTitle = false,
}: GrammarConceptViewProps) {
  const empty = !summary && rules.length === 0 && examples.length === 0 && commonErrors.length === 0

  return (
    <article className="space-y-6">
      <header>
        {!hideTitle && <h2 className="text-xl font-bold text-gray-900">{title || '제목 없음'}</h2>}
        {summary && <p className="mt-2 text-base leading-relaxed text-gray-700">{summary}</p>}
      </header>

      {empty && <p className="text-sm text-gray-400">아직 개념 정리 내용이 없습니다.</p>}

      {rules.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-[#1865F2]">핵심 규칙</h3>
          <ol className="space-y-2">
            {rules.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-lg bg-gray-50 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1865F2] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">{r.text}</p>
                  {r.formula && (
                    <p className="mt-1 inline-block rounded bg-white px-2 py-0.5 font-mono text-sm text-gray-700 ring-1 ring-gray-200">
                      {r.formula}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {examples.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-[#1865F2]">예문</h3>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {examples.map((e, i) => (
              <li key={i} className="px-4 py-3">
                <p className="text-base text-gray-900">
                  <HighlightedSentence text={e.en} highlight={e.highlight} />
                </p>
                {foldTranslations ? (
                  <details className="group mt-1">
                    <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center text-sm font-medium text-[#1865F2] [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">해석 보기</span>
                      <span className="hidden group-open:inline">해석 접기</span>
                    </summary>
                    <p className="text-sm text-gray-500">{e.ko}</p>
                  </details>
                ) : (
                  <p className="mt-0.5 text-sm text-gray-500">{e.ko}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {commonErrors.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-[#1865F2]">자주 하는 실수</h3>
          <ul className="space-y-3">
            {commonErrors.map((e, i) => (
              <li key={i} className="rounded-lg border border-gray-200 px-4 py-3">
                <p className="flex items-start gap-2 text-sm text-[#B42318]">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-label="틀린 문장" />
                  <span className="line-through decoration-[#D92916]/50">{e.wrong}</span>
                </p>
                <p className="mt-1 flex items-start gap-2 text-sm font-medium text-[#15803D]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-label="고친 문장" />
                  <span>{e.correct}</span>
                </p>
                <p className="mt-2 text-sm text-gray-600">{e.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
