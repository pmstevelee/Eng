'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Printer, Clock, FileText } from 'lucide-react'
import type { TestPreviewData } from '../actions'
import { getTestForPreview } from '../actions'
import type { QuestionContentJson } from '@/components/shared/question-bank-client'

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
  LISTENING: '#0EA5E9',
}

const TYPE_LABEL: Record<string, string> = {
  LEVEL_TEST: '레벨 테스트',
  UNIT_TEST: '단원 테스트',
  PRACTICE: '연습',
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: '객관식',
  fill_blank: '빈칸 채우기',
  short_answer: '단답형',
  essay: '서술형',
  word_bank: '단어박스형',
  question_set: '복합 문제',
  sentence_order: '순서맞추기',
}

function QuestionBody({
  content,
  no,
  showAnswer,
}: {
  content: QuestionContentJson
  no: number
  showAnswer: boolean
}) {
  const domainColor = '#1865F2'

  return (
    <div className="question-item mb-6 break-inside-avoid">
      {/* 지문 */}
      {content.passage && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase block mb-1">지문</span>
          {content.passage}
        </div>
      )}

      {/* 문제 본문 */}
      <p className="font-medium text-gray-900 leading-relaxed text-sm">
        <span className="font-bold text-base mr-1.5" style={{ color: domainColor }}>{no}.</span>
        {content.question_text || ''}
      </p>
      {content.question_text_ko && (
        <p className="text-xs text-gray-500 mt-0.5 ml-5">{content.question_text_ko}</p>
      )}

      {/* 객관식 선택지 */}
      {content.type === 'multiple_choice' && content.options && (
        <div className="mt-2 space-y-1 ml-5">
          {content.options.filter(Boolean).map((opt, i) => {
            const label = String.fromCharCode(65 + i)
            const isCorrect = showAnswer && content.correct_answer === label
            return (
              <div
                key={i}
                className={`flex items-start gap-2 text-sm py-1 px-2 rounded ${isCorrect ? 'bg-green-50 text-green-800 font-semibold' : 'text-gray-700'}`}
              >
                <span className="font-semibold shrink-0" style={{ color: domainColor }}>{label}.</span>
                <span>{opt}</span>
                {isCorrect && <span className="text-green-600 text-xs shrink-0">✓ 정답</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* 빈칸 */}
      {content.type === 'fill_blank' && (
        <div className="mt-2 ml-5">
          <div className="inline-block h-8 min-w-32 border-b-2 border-gray-400 px-2" />
          {showAnswer && content.correct_answer && (
            <span className="ml-3 text-xs text-green-700 font-semibold">정답: {content.correct_answer}</span>
          )}
        </div>
      )}

      {/* 단답형 */}
      {content.type === 'short_answer' && (
        <div className="mt-2 ml-5">
          <div className="h-10 border-b border-gray-300 rounded" />
          {showAnswer && content.correct_answer && (
            <p className="text-xs text-green-700 font-semibold mt-1">정답: {content.correct_answer}</p>
          )}
        </div>
      )}

      {/* 서술형 */}
      {content.type === 'essay' && (
        <div className="mt-2 ml-5">
          <div className="border border-gray-300 rounded-lg h-20" />
          {content.word_limit && (
            <p className="text-xs text-gray-400 mt-1">단어 수 제한: {content.word_limit}단어</p>
          )}
        </div>
      )}

      {/* 단어박스형 */}
      {content.type === 'word_bank' && (
        <div className="mt-2 ml-5 space-y-2">
          {content.word_bank && content.word_bank.length > 0 && (
            <div className="border border-gray-300 rounded-lg p-3 flex flex-wrap gap-2">
              {content.word_bank.map((word, i) => (
                <span key={i} className="px-2 py-0.5 text-sm font-semibold text-gray-700 border-b-2 border-gray-400">
                  {word}
                </span>
              ))}
            </div>
          )}
          {content.sentences && content.sentences.map((s) => {
            const parts = s.text.split('____')
            return (
              <div key={s.label} className="flex items-center gap-1 flex-wrap text-sm">
                <span className="font-bold text-gray-700 shrink-0">{s.label}.</span>
                <span>{parts[0]}</span>
                {showAnswer ? (
                  <span className="font-semibold text-green-700 border-b-2 border-green-400 px-1">{s.correct_answer}</span>
                ) : (
                  <span className="inline-block min-w-16 border-b-2 border-gray-400 px-2">&nbsp;</span>
                )}
                {parts[1] && <span>{parts[1]}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* 문장 순서 맞추기 */}
      {content.type === 'sentence_order' && content.order_sentences && (
        <div className="mt-2 ml-5 space-y-2">
          {content.order_sentences.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-sm text-gray-700">{item.display_text}</p>
              <div className="flex flex-wrap gap-1.5">
                {item.words.map((word, wi) => (
                  <span key={wi} className="px-2 py-1 rounded border border-gray-300 text-xs font-medium text-gray-700">
                    {word}
                  </span>
                ))}
              </div>
              {showAnswer && (
                <p className="text-xs text-green-700 font-semibold">정답: {item.correct_answer}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 복합 문제 */}
      {content.type === 'question_set' && (
        <div className="mt-2 ml-5 space-y-3">
          {content.sub_questions && content.sub_questions.map((sq) => (
            <div key={sq.label} className="space-y-1.5">
              <p className="text-sm font-semibold text-gray-800">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-1.5">
                  {sq.label}
                </span>
                {sq.question_text}
              </p>
              <div className="space-y-1 ml-6">
                {sq.options.map((opt, oi) => {
                  const letter = String.fromCharCode(65 + oi)
                  const isCorrect = showAnswer && sq.correct_answer === letter
                  return (
                    <div key={oi} className={`flex items-start gap-2 text-sm ${isCorrect ? 'text-green-800 font-semibold' : 'text-gray-700'}`}>
                      <span className="font-semibold shrink-0">{letter}.</span>
                      <span>{opt}</span>
                      {isCorrect && <span className="text-green-600 text-xs shrink-0">✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Props = {
  testId: string
  testTitle: string
  onClose: () => void
}

export default function TestPreviewModal({ testId, testTitle, onClose }: Props) {
  const [data, setData] = useState<TestPreviewData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAnswer, setShowAnswer] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    getTestForPreview(testId)
      .then((result) => {
        if (result.error) {
          setError(result.error)
        } else if (result.data) {
          setData(result.data)
        }
      })
      .catch(() => setError('미리보기를 불러오는 데 실패했습니다.'))
      .finally(() => setLoading(false))
  }, [testId])

  function handlePrint() {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) return

    const styles = `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 12pt; color: #21242C; background: white; padding: 0; }
        .print-page { padding: 20mm 20mm 20mm 20mm; max-width: 210mm; margin: 0 auto; }
        .print-header { border-bottom: 2px solid #21242C; padding-bottom: 12px; margin-bottom: 20px; }
        .print-title { font-size: 18pt; font-weight: 700; margin-bottom: 6px; }
        .print-meta { display: flex; gap: 20px; font-size: 9pt; color: #6B7280; flex-wrap: wrap; }
        .print-meta span { display: flex; align-items: center; gap: 4px; }
        .print-instructions { margin-bottom: 16px; padding: 10px 14px; border: 1px solid #E5E7EB; border-left: 3px solid #1865F2; background: #F9FAFB; font-size: 10pt; line-height: 1.6; color: #374151; }
        .student-info { display: flex; gap: 24px; margin-bottom: 20px; padding: 10px 0; border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; }
        .student-info-field { display: flex; align-items: center; gap: 6px; font-size: 10pt; }
        .student-info-field label { color: #6B7280; font-weight: 600; white-space: nowrap; }
        .student-info-field .line { display: inline-block; width: 100px; border-bottom: 1px solid #374151; height: 1.4em; }
        .domain-section { margin-bottom: 24px; }
        .domain-header { font-size: 10pt; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; background: #F3F4F6; border-radius: 4px; margin-bottom: 14px; }
        .question-item { margin-bottom: 18px; page-break-inside: avoid; }
        .question-no { font-size: 13pt; font-weight: 700; color: #1865F2; display: inline; margin-right: 6px; }
        .question-text { font-size: 11pt; font-weight: 500; line-height: 1.6; color: #21242C; display: inline; }
        .question-text-ko { font-size: 9pt; color: #6B7280; margin-top: 2px; margin-left: 22px; }
        .passage { margin-bottom: 10px; padding: 10px 12px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 10pt; line-height: 1.7; color: #374151; white-space: pre-wrap; }
        .passage-label { font-size: 8pt; font-weight: 700; color: #9CA3AF; text-transform: uppercase; display: block; margin-bottom: 4px; }
        .options { margin-top: 8px; margin-left: 22px; display: flex; flex-direction: column; gap: 4px; }
        .option { display: flex; align-items: flex-start; gap: 6px; font-size: 10pt; line-height: 1.5; padding: 2px 6px; border-radius: 4px; }
        .option.correct { background: #F0FDF4; color: #166534; font-weight: 600; }
        .option-label { font-weight: 700; color: #1865F2; flex-shrink: 0; }
        .option.correct .option-label { color: #166534; }
        .correct-mark { font-size: 9pt; color: #16A34A; flex-shrink: 0; }
        .answer-blank { display: inline-block; min-width: 80px; border-bottom: 1.5px solid #9CA3AF; height: 1.4em; margin: 0 4px; }
        .answer-line { height: 32px; border-bottom: 1px solid #D1D5DB; margin-top: 8px; margin-left: 22px; }
        .essay-box { height: 70px; border: 1px solid #D1D5DB; border-radius: 4px; margin-top: 8px; margin-left: 22px; }
        .word-bank-box { border: 1px solid #D1D5DB; border-radius: 6px; padding: 8px 12px; margin-top: 8px; margin-left: 22px; display: flex; flex-wrap: wrap; gap: 8px; }
        .word-chip { font-size: 10pt; font-weight: 600; border-bottom: 1.5px solid #9CA3AF; padding: 0 6px; }
        .wb-sentence { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 10pt; margin-top: 6px; margin-left: 22px; line-height: 1.8; }
        .order-words { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; margin-left: 22px; }
        .order-word { font-size: 10pt; border: 1px solid #D1D5DB; border-radius: 4px; padding: 2px 8px; }
        .sub-question { margin-left: 22px; margin-top: 8px; }
        .sub-q-label { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: #DBEAFE; color: #1D4ED8; font-size: 9pt; font-weight: 700; margin-right: 6px; }
        .sub-options { margin-left: 28px; margin-top: 4px; display: flex; flex-direction: column; gap: 3px; }
        .answer-key { page-break-before: always; padding-top: 16px; }
        .answer-key-title { font-size: 14pt; font-weight: 700; border-bottom: 2px solid #21242C; padding-bottom: 8px; margin-bottom: 16px; }
        .answer-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
        .answer-table th { background: #F3F4F6; border: 1px solid #E5E7EB; padding: 6px 10px; font-weight: 600; text-align: center; }
        .answer-table td { border: 1px solid #E5E7EB; padding: 6px 10px; text-align: center; }
        .answer-table tr:nth-child(even) td { background: #F9FAFB; }
        .correct-answer { color: #166534; font-weight: 700; }
        @media print {
          body { padding: 0; }
          .print-page { padding: 15mm; }
          .no-print { display: none !important; }
        }
      </style>
    `

    const testData = data!
    const createdDate = new Date(testData.createdAt).toLocaleDateString('ko-KR')

    // 영역별 그룹화
    const domainGroups: Record<string, typeof testData.questions> = {}
    for (const q of testData.questions) {
      if (!domainGroups[q.domain]) domainGroups[q.domain] = []
      domainGroups[q.domain].push(q)
    }

    function renderQuestion(q: (typeof testData.questions)[number]): string {
      const c = q.contentJson
      let html = `<div class="question-item">`

      if (c.passage) {
        html += `<div class="passage"><span class="passage-label">지문</span>${escHtml(c.passage)}</div>`
      }

      html += `<p><span class="question-no">${q.no}.</span><span class="question-text">${escHtml(c.question_text ?? '')}</span></p>`
      if (c.question_text_ko) {
        html += `<p class="question-text-ko">${escHtml(c.question_text_ko)}</p>`
      }

      if (c.type === 'multiple_choice' && c.options) {
        html += `<div class="options">`
        c.options.filter(Boolean).forEach((opt, i) => {
          const label = String.fromCharCode(65 + i)
          const isCorrect = showAnswer && c.correct_answer === label
          html += `<div class="option${isCorrect ? ' correct' : ''}"><span class="option-label">${label}.</span><span>${escHtml(opt)}</span>${isCorrect ? '<span class="correct-mark">✓ 정답</span>' : ''}</div>`
        })
        html += `</div>`
      } else if (c.type === 'fill_blank') {
        html += `<div style="margin-top:8px;margin-left:22px;"><span class="answer-blank"></span>${showAnswer && c.correct_answer ? `<span style="color:#166534;font-weight:600;font-size:9pt;margin-left:6px;">정답: ${escHtml(c.correct_answer)}</span>` : ''}</div>`
      } else if (c.type === 'short_answer') {
        html += `<div class="answer-line"></div>${showAnswer && c.correct_answer ? `<p style="font-size:9pt;color:#166534;font-weight:600;margin-left:22px;margin-top:2px;">정답: ${escHtml(c.correct_answer)}</p>` : ''}`
      } else if (c.type === 'essay') {
        html += `<div class="essay-box"></div>${c.word_limit ? `<p style="font-size:9pt;color:#9CA3AF;margin-left:22px;margin-top:2px;">단어 수 제한: ${c.word_limit}단어</p>` : ''}`
      } else if (c.type === 'word_bank' && c.word_bank) {
        html += `<div class="word-bank-box">${c.word_bank.map((w) => `<span class="word-chip">${escHtml(w)}</span>`).join('')}</div>`
        if (c.sentences) {
          c.sentences.forEach((s) => {
            const parts = s.text.split('____')
            html += `<div class="wb-sentence"><span style="font-weight:700;">${s.label}.</span><span>${escHtml(parts[0] ?? '')}</span>`
            if (showAnswer) {
              html += `<span style="border-bottom:1.5px solid #16A34A;color:#166534;font-weight:600;padding:0 4px;">${escHtml(s.correct_answer)}</span>`
            } else {
              html += `<span class="answer-blank"></span>`
            }
            if (parts[1]) html += `<span>${escHtml(parts[1])}</span>`
            html += `</div>`
          })
        }
      } else if (c.type === 'sentence_order' && c.order_sentences) {
        c.order_sentences.forEach((item) => {
          html += `<p style="font-size:10pt;color:#374151;margin-top:8px;margin-left:22px;">${escHtml(item.display_text)}</p>`
          html += `<div class="order-words">${item.words.map((w) => `<span class="order-word">${escHtml(w)}</span>`).join('')}</div>`
          if (showAnswer) {
            html += `<p style="font-size:9pt;color:#166534;font-weight:600;margin-left:22px;margin-top:2px;">정답: ${escHtml(item.correct_answer)}</p>`
          }
        })
      } else if (c.type === 'question_set' && c.sub_questions) {
        c.sub_questions.forEach((sq) => {
          html += `<div class="sub-question"><p style="font-size:10pt;font-weight:600;"><span class="sub-q-label">${escHtml(String(sq.label))}</span>${escHtml(sq.question_text)}</p>`
          html += `<div class="sub-options">`
          sq.options.forEach((opt, oi) => {
            const letter = String.fromCharCode(65 + oi)
            const isCorrect = showAnswer && sq.correct_answer === letter
            html += `<div class="option${isCorrect ? ' correct' : ''}"><span class="option-label">${letter}.</span><span>${escHtml(opt)}</span>${isCorrect ? '<span class="correct-mark">✓</span>' : ''}</div>`
          })
          html += `</div></div>`
        })
      }

      html += `</div>`
      return html
    }

    // 정답표 생성
    function renderAnswerKey(): string {
      const answerable = testData.questions.filter((q) => {
        const c = q.contentJson
        return ['multiple_choice', 'fill_blank', 'short_answer', 'word_bank', 'sentence_order'].includes(c.type ?? '')
      })
      if (answerable.length === 0) return ''

      let html = `<div class="answer-key"><p class="answer-key-title">정답표</p><table class="answer-table"><thead><tr><th>번호</th><th>영역</th><th>유형</th><th>정답</th></tr></thead><tbody>`
      for (const q of answerable) {
        const c = q.contentJson
        let ans = ''
        if (c.type === 'multiple_choice') ans = c.correct_answer ?? ''
        else if (c.type === 'fill_blank' || c.type === 'short_answer') ans = c.correct_answer ?? ''
        else if (c.type === 'word_bank' && c.sentences) ans = c.sentences.map((s) => `${s.label}: ${s.correct_answer}`).join(', ')
        else if (c.type === 'sentence_order' && c.order_sentences) ans = c.order_sentences.map((s) => `${s.label}: ${s.correct_answer}`).join(' / ')
        html += `<tr><td>${q.no}</td><td>${DOMAIN_LABEL[q.domain] ?? q.domain}</td><td>${QUESTION_TYPE_LABEL[c.type ?? ''] ?? c.type}</td><td class="correct-answer">${escHtml(ans)}</td></tr>`
      }
      html += `</tbody></table></div>`
      return html
    }

    let questionsHtml = ''
    const domainOrder = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING', 'LISTENING']
    for (const domain of domainOrder) {
      const qs = domainGroups[domain]
      if (!qs || qs.length === 0) continue
      questionsHtml += `<div class="domain-section"><div class="domain-header">${DOMAIN_LABEL[domain] ?? domain}</div>${qs.map(renderQuestion).join('')}</div>`
    }
    // 기타 영역
    for (const domain of Object.keys(domainGroups)) {
      if (!domainOrder.includes(domain)) {
        const qs = domainGroups[domain]
        questionsHtml += `<div class="domain-section"><div class="domain-header">${DOMAIN_LABEL[domain] ?? domain}</div>${qs.map(renderQuestion).join('')}</div>`
      }
    }

    const bodyHtml = `
      <!DOCTYPE html>
      <html lang="ko">
      <head><meta charset="UTF-8"><title>${escHtml(testData.title)}</title>${styles}</head>
      <body>
        <div class="print-page">
          <div class="print-header">
            <p class="print-title">${escHtml(testData.title)}</p>
            <div class="print-meta">
              <span>${escHtml(testData.academyName)}</span>
              <span>출제자: ${escHtml(testData.creatorName)}</span>
              <span>유형: ${TYPE_LABEL[testData.type] ?? testData.type}</span>
              <span>문항 수: ${testData.questions.length}문제</span>
              ${testData.timeLimitMin ? `<span>제한 시간: ${testData.timeLimitMin}분</span>` : ''}
              <span>출제일: ${createdDate}</span>
            </div>
          </div>
          ${testData.instructions ? `<div class="print-instructions">${escHtml(testData.instructions)}</div>` : ''}
          <div class="student-info">
            <div class="student-info-field"><label>이름</label><span class="line"></span></div>
            <div class="student-info-field"><label>학년/반</label><span class="line"></span></div>
            <div class="student-info-field"><label>날짜</label><span class="line" style="width:80px;"></span></div>
            <div class="student-info-field"><label>점수</label><span class="line" style="width:60px;"></span></div>
          </div>
          ${questionsHtml}
          ${renderAnswerKey()}
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `

    printWindow.document.write(bodyHtml)
    printWindow.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-gray-500" />
          <div>
            <h2 className="font-bold text-gray-900 text-base leading-tight">{testTitle}</h2>
            {data && (
              <p className="text-xs text-gray-400 mt-0.5">
                {data.questions.length}문제
                {data.timeLimitMin ? ` · ${data.timeLimitMin}분` : ''}
                {' · '}
                {TYPE_LABEL[data.type] ?? data.type}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && data.questions.length > 0 && (
            <>
              <button
                onClick={() => setShowAnswer((v) => !v)}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${
                  showAnswer
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {showAnswer ? '정답 숨기기' : '정답 표시'}
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-primary-700 text-white hover:bg-primary-800 transition-colors"
              >
                <Printer size={15} />
                PDF 출력
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="ml-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            불러오는 중...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm">
            {error}
          </div>
        ) : !data ? null : data.questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <FileText size={36} className="mb-3 opacity-50" />
            <p className="text-sm">등록된 문제가 없습니다.</p>
            <p className="text-xs mt-1">테스트 수정에서 문제를 추가해 주세요.</p>
          </div>
        ) : (
          <div ref={printRef} className="max-w-3xl mx-auto p-8">
            {/* 테스트 헤더 */}
            <div className="border-b-2 border-gray-900 pb-5 mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{data.title}</h1>
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <span>{data.academyName}</span>
                <span>출제자: {data.creatorName}</span>
                <span>{TYPE_LABEL[data.type] ?? data.type}</span>
                <span>{data.questions.length}문제</span>
                {data.timeLimitMin && (
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {data.timeLimitMin}분
                  </span>
                )}
                <span>{new Date(data.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>

            {/* 학습자 정보 */}
            <div className="flex gap-6 mb-6 pb-4 border-b border-gray-200">
              {['이름', '학년/반', '날짜', '점수'].map((label) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500 font-semibold">{label}</span>
                  <span className="inline-block w-20 border-b border-gray-400" />
                </div>
              ))}
            </div>

            {/* 안내 사항 */}
            {data.instructions && (
              <div className="mb-6 p-4 border border-gray-200 border-l-4 border-l-primary-700 bg-blue-50 rounded-r-lg text-sm text-gray-700 leading-relaxed">
                {data.instructions}
              </div>
            )}

            {/* 문제 목록 (영역별) */}
            {(() => {
              const domainOrder = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING', 'LISTENING']
              const groups: Record<string, typeof data.questions> = {}
              for (const q of data.questions) {
                if (!groups[q.domain]) groups[q.domain] = []
                groups[q.domain].push(q)
              }
              const orderedDomains = [
                ...domainOrder.filter((d) => groups[d]?.length),
                ...Object.keys(groups).filter((d) => !domainOrder.includes(d)),
              ]
              return orderedDomains.map((domain) => (
                <div key={domain} className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className="w-1 h-5 rounded-full shrink-0"
                      style={{ backgroundColor: DOMAIN_COLOR[domain] ?? '#6B7280' }}
                    />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                      {DOMAIN_LABEL[domain] ?? domain}
                    </span>
                    <span className="text-xs text-gray-400">({groups[domain].length}문제)</span>
                  </div>
                  <div className="space-y-5">
                    {groups[domain].map((q) => (
                      <QuestionBody
                        key={q.id}
                        content={q.contentJson}
                        no={q.no}
                        showAnswer={showAnswer}
                      />
                    ))}
                  </div>
                </div>
              ))
            })()}

            {/* 정답표 (정답 보기 ON 시) */}
            {showAnswer && (
              <div className="mt-10 pt-8 border-t-2 border-gray-900">
                <h2 className="text-lg font-bold text-gray-900 mb-4">정답표</h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-3 py-2 text-center text-gray-600 font-semibold">번호</th>
                      <th className="border border-gray-200 px-3 py-2 text-center text-gray-600 font-semibold">영역</th>
                      <th className="border border-gray-200 px-3 py-2 text-center text-gray-600 font-semibold">유형</th>
                      <th className="border border-gray-200 px-3 py-2 text-center text-gray-600 font-semibold">정답</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.questions
                      .filter((q) =>
                        ['multiple_choice', 'fill_blank', 'short_answer', 'word_bank', 'sentence_order'].includes(
                          q.contentJson.type ?? '',
                        ),
                      )
                      .map((q) => {
                        const c = q.contentJson
                        let ans = ''
                        if (c.type === 'multiple_choice' || c.type === 'fill_blank' || c.type === 'short_answer') {
                          ans = c.correct_answer ?? ''
                        } else if (c.type === 'word_bank' && c.sentences) {
                          ans = c.sentences.map((s) => `${s.label}: ${s.correct_answer}`).join(', ')
                        } else if (c.type === 'sentence_order' && c.order_sentences) {
                          ans = c.order_sentences.map((s) => `${s.label}: ${s.correct_answer}`).join(' / ')
                        }
                        return (
                          <tr key={q.id} className="even:bg-gray-50">
                            <td className="border border-gray-200 px-3 py-2 text-center">{q.no}</td>
                            <td className="border border-gray-200 px-3 py-2 text-center">{DOMAIN_LABEL[q.domain] ?? q.domain}</td>
                            <td className="border border-gray-200 px-3 py-2 text-center">{QUESTION_TYPE_LABEL[c.type ?? ''] ?? c.type}</td>
                            <td className="border border-gray-200 px-3 py-2 text-center font-semibold text-green-700">{ans}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>')
}
