'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { Plus, Search, Eye, Pencil, Trash2, X, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── 타입 정의 ─────────────────────────────────────────────────────────────────

export type QuestionDomainType = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING'
export type QuestionType = 'multiple_choice' | 'fill_blank' | 'short_answer' | 'essay'

export type QuestionContentJson = {
  type: QuestionType
  question_text: string
  question_text_ko?: string
  options?: string[]
  correct_answer?: string
  explanation?: string
  passage?: string
  word_limit?: number
}

export type QuestionRow = {
  id: string
  domain: QuestionDomainType
  subCategory: string | null
  difficulty: number
  cefrLevel: string | null
  contentJson: QuestionContentJson
  statsJson: { attempt_count: number; correct_count: number; correct_rate: number } | null
  createdAt: string
  creator: { name: string } | null
}

type CreateInput = {
  domain: QuestionDomainType
  subCategory?: string
  difficulty: number
  cefrLevel?: string
  contentJson: QuestionContentJson
}

type UpdateInput = CreateInput & { id: string }

// ── 상수 ──────────────────────────────────────────────────────────────────────

const DOMAIN_LABEL: Record<QuestionDomainType, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
}

const DOMAIN_COLOR: Record<QuestionDomainType, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
}

const DOMAIN_BG: Record<QuestionDomainType, string> = {
  GRAMMAR: '#EEF4FF',
  VOCABULARY: '#F3EFFF',
  READING: '#E6FAF8',
  WRITING: '#FEF0E8',
}

const TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: '객관식',
  fill_blank: '빈칸 채우기',
  short_answer: '단답형',
  essay: '서술형',
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// ── 헬퍼 컴포넌트 ──────────────────────────────────────────────────────────────

function DomainBadge({ domain }: { domain: QuestionDomainType }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: DOMAIN_BG[domain], color: DOMAIN_COLOR[domain] }}
    >
      {DOMAIN_LABEL[domain]}
    </span>
  )
}

function DifficultyStars({ value }: { value: number }) {
  return (
    <span className="text-sm text-accent-gold tracking-tight">
      {'★'.repeat(value)}
      <span className="text-gray-200">{'★'.repeat(5 - value)}</span>
    </span>
  )
}

function CorrectRateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-gray-300 text-sm">–</span>
  const color = rate >= 70 ? '#1FAF54' : rate >= 40 ? '#FFB100' : '#D92916'
  return (
    <span className="text-sm font-medium" style={{ color }}>
      {rate.toFixed(0)}%
    </span>
  )
}

function StyledSelect({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100 ${className}`}
    >
      {children}
    </select>
  )
}

function StyledTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  className?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none ${className}`}
    />
  )
}

// ── 미리보기 모달 ─────────────────────────────────────────────────────────────

function PreviewModal({ question, onClose }: { question: QuestionRow; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const content = question.contentJson
  const domainColor = DOMAIN_COLOR[question.domain]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-sm">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Eye size={18} className="text-gray-500" />
            <span className="font-semibold text-gray-900">문제 미리보기</span>
            <DomainBadge domain={question.domain} />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* 문제 카드 */}
        <div className="p-6">
          <div className="rounded-xl border border-gray-200 p-8 relative overflow-hidden">
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ backgroundColor: domainColor }}
            />

            {content.passage && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 tracking-wide">지문</p>
                <p className="whitespace-pre-wrap">{content.passage}</p>
              </div>
            )}

            <p className="text-base font-medium text-gray-900 leading-relaxed mb-1">
              {content.question_text || '문제 본문이 없습니다.'}
            </p>
            {content.question_text_ko && (
              <p className="text-sm text-gray-500 mb-6">{content.question_text_ko}</p>
            )}

            {content.type === 'multiple_choice' && content.options && (
              <div className="mt-6 space-y-3">
                {content.options.map((opt, i) => {
                  const label = String.fromCharCode(65 + i)
                  const isSelected = selected === label
                  const isCorrect = content.correct_answer === label
                  return (
                    <button
                      key={i}
                      onClick={() => setSelected(label)}
                      className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                        isSelected
                          ? 'border-primary-700 bg-primary-100'
                          : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-semibold mr-3" style={{ color: domainColor }}>
                        {label}.
                      </span>
                      <span className="text-gray-900 text-sm">{opt || `선택지 ${label}`}</span>
                      {selected && isCorrect && (
                        <span className="ml-2 text-xs text-accent-green font-semibold">✓ 정답</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {content.type === 'fill_blank' && (
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="정답을 입력하세요"
                  className="h-11 rounded-xl border-2 border-gray-200 px-4 text-sm w-full max-w-xs focus:border-primary-700 focus:outline-none"
                />
              </div>
            )}

            {content.type === 'short_answer' && (
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="답변을 입력하세요"
                  className="h-11 rounded-xl border-2 border-gray-200 px-4 text-sm w-full focus:border-primary-700 focus:outline-none"
                />
              </div>
            )}

            {content.type === 'essay' && (
              <div className="mt-4">
                <textarea
                  placeholder="서술형 답변을 작성하세요"
                  rows={5}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-primary-700 focus:outline-none resize-none"
                />
                {content.word_limit && (
                  <p className="mt-1 text-xs text-gray-500">최대 {content.word_limit}단어</p>
                )}
              </div>
            )}

            {selected && content.explanation && (
              <div className="mt-6 p-4 rounded-xl bg-[#E6F7ED] border border-[#1FAF54]/20">
                <p className="text-xs font-semibold text-[#1FAF54] mb-1">해설</p>
                <p className="text-sm text-gray-700">{content.explanation}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>난이도: <DifficultyStars value={question.difficulty} /></span>
            {question.cefrLevel && <span>CEFR: <strong>{question.cefrLevel}</strong></span>}
            <span>유형: {TYPE_LABEL[content.type]}</span>
            {question.statsJson && (
              <span>정답률: <CorrectRateBadge rate={question.statsJson.correct_rate} /></span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 문제 폼 모달 ──────────────────────────────────────────────────────────────

function QuestionFormModal({
  initial,
  onClose,
  onSaved,
  actCreate,
  actUpdate,
}: {
  initial: QuestionRow | null
  onClose: () => void
  onSaved: () => void
  actCreate: (input: CreateInput) => Promise<{ error?: string; id?: string }>
  actUpdate: (input: UpdateInput) => Promise<{ error?: string }>
}) {
  const isEdit = !!initial
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [domain, setDomain] = useState<QuestionDomainType>(initial?.domain ?? 'GRAMMAR')
  const [subCategory, setSubCategory] = useState(initial?.subCategory ?? '')
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 3)
  const [cefrLevel, setCefrLevel] = useState(initial?.cefrLevel ?? 'B1')
  const [qType, setQType] = useState<QuestionType>(initial?.contentJson.type ?? 'multiple_choice')
  const [questionText, setQuestionText] = useState(initial?.contentJson.question_text ?? '')
  const [questionTextKo, setQuestionTextKo] = useState(initial?.contentJson.question_text_ko ?? '')
  const [options, setOptions] = useState<string[]>(initial?.contentJson.options ?? ['', '', '', ''])
  const [correctAnswer, setCorrectAnswer] = useState(initial?.contentJson.correct_answer ?? '')
  const [explanation, setExplanation] = useState(initial?.contentJson.explanation ?? '')
  const [passage, setPassage] = useState(initial?.contentJson.passage ?? '')
  const [wordLimit, setWordLimit] = useState<number>(initial?.contentJson.word_limit ?? 200)

  const TABS: { key: QuestionType; label: string }[] = [
    { key: 'multiple_choice', label: '객관식' },
    { key: 'fill_blank', label: '빈칸' },
    { key: 'short_answer', label: '단답형' },
    { key: 'essay', label: '서술형' },
  ]

  const updateOption = (i: number, val: string) => {
    const next = [...options]
    next[i] = val
    setOptions(next)
  }

  const buildContentJson = (): QuestionContentJson => {
    const base = {
      type: qType,
      question_text: questionText,
      question_text_ko: questionTextKo || undefined,
      explanation: explanation || undefined,
    }
    if (qType === 'multiple_choice') return { ...base, options, correct_answer: correctAnswer }
    if (qType === 'fill_blank') return { ...base, correct_answer: correctAnswer }
    if (qType === 'short_answer') return { ...base, correct_answer: correctAnswer }
    return { ...base, passage: passage || undefined, word_limit: wordLimit }
  }

  const handleSubmit = () => {
    if (!questionText.trim()) { setError('문제 본문을 입력해주세요.'); return }
    if (qType !== 'essay' && !correctAnswer.trim()) { setError('정답을 입력해주세요.'); return }

    setError('')
    const contentJson = buildContentJson()

    startTransition(async () => {
      let result
      if (isEdit) {
        result = await actUpdate({
          id: initial!.id,
          domain,
          subCategory: subCategory || undefined,
          difficulty,
          cefrLevel: cefrLevel || undefined,
          contentJson,
        })
      } else {
        result = await actCreate({
          domain,
          subCategory: subCategory || undefined,
          difficulty,
          cefrLevel: cefrLevel || undefined,
          contentJson,
        })
      }
      if (result.error) setError(result.error)
      else onSaved()
    })
  }

  const domainColor = DOMAIN_COLOR[domain]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">{isEdit ? '문제 수정' : '새 문제 추가'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* 기본 정보 */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">기본 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">영역</label>
                <StyledSelect value={domain} onChange={(v) => setDomain(v as QuestionDomainType)} className="w-full">
                  <option value="GRAMMAR">문법 (Grammar)</option>
                  <option value="VOCABULARY">어휘 (Vocabulary)</option>
                  <option value="READING">읽기 (Reading)</option>
                  <option value="WRITING">쓰기 (Writing)</option>
                </StyledSelect>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CEFR 수준</label>
                <StyledSelect value={cefrLevel} onChange={setCefrLevel} className="w-full">
                  {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </StyledSelect>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">세부 카테고리 (선택)</label>
                <Input
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  placeholder="예: 현재완료, 관계대명사..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  난이도 <DifficultyStars value={difficulty} />
                </label>
                <div className="flex items-center gap-3 h-11">
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                    className="w-full accent-primary-700"
                  />
                  <span className="text-sm font-bold text-gray-700 w-4">{difficulty}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 유형 탭 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">문제 유형</h3>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setQType(tab.key)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    qType === tab.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {/* 지문 (읽기) */}
          {domain === 'READING' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지문 (선택)</label>
              <StyledTextarea value={passage} onChange={setPassage} placeholder="읽기 지문을 입력하세요..." rows={5} />
            </div>
          )}

          {/* 문제 본문 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              문제 본문 <span className="text-[#D92916]">*</span>
            </label>
            {qType === 'fill_blank' && (
              <p className="text-xs text-gray-400 mb-1">빈칸은 ____로 표시하세요 (예: I ____ to school.)</p>
            )}
            <StyledTextarea value={questionText} onChange={setQuestionText} placeholder="문제를 입력하세요..." rows={3} />
          </div>

          {/* 한국어 번역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">한국어 번역 (선택)</label>
            <Input
              value={questionTextKo}
              onChange={(e) => setQuestionTextKo(e.target.value)}
              placeholder="학생에게 보여줄 한국어 해석"
            />
          </div>

          {/* 선택지 (객관식) */}
          {qType === 'multiple_choice' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">선택지 (A~D)</label>
              <div className="space-y-2">
                {options.map((opt, i) => {
                  const label = String.fromCharCode(65 + i)
                  const isCorrect = correctAnswer === label
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectAnswer(isCorrect ? '' : label)}
                        className={`w-8 h-8 rounded-full text-sm font-bold border-2 shrink-0 transition-all ${
                          isCorrect
                            ? 'border-[#1FAF54] bg-[#1FAF54] text-white'
                            : 'border-gray-200 text-gray-400 hover:border-[#1FAF54] hover:text-[#1FAF54]'
                        }`}
                        title="클릭하여 정답 선택"
                      >
                        {label}
                      </button>
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`선택지 ${label}`}
                        className="flex-1"
                      />
                    </div>
                  )
                })}
                <p className="text-xs text-gray-400">
                  {correctAnswer ? `정답: ${correctAnswer}` : '정답을 선택하려면 원 버튼을 클릭하세요.'}
                </p>
              </div>
            </div>
          )}

          {/* 정답 (빈칸/단답형) */}
          {(qType === 'fill_blank' || qType === 'short_answer') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                정답 <span className="text-[#D92916]">*</span>
              </label>
              <Input
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder={qType === 'fill_blank' ? '정확한 정답' : '키워드 (쉼표로 구분)'}
              />
            </div>
          )}

          {/* 단어 수 제한 (서술형) */}
          {qType === 'essay' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최대 단어 수</label>
              <div className="flex items-center gap-3 h-11">
                <input
                  type="range" min={50} max={500} step={50} value={wordLimit}
                  onChange={(e) => setWordLimit(Number(e.target.value))}
                  className="w-full accent-primary-700"
                />
                <span className="text-sm font-bold text-gray-700 w-12">{wordLimit}자</span>
              </div>
            </div>
          )}

          {/* 해설 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">해설 (선택)</label>
            <StyledTextarea value={explanation} onChange={setExplanation} placeholder="정답에 대한 해설을 입력하세요..." rows={3} />
          </div>

          {/* 도메인 색상 인디케이터 */}
          <div className="h-1 rounded-full w-full" style={{ backgroundColor: domainColor }} />

          {error && <p className="text-sm text-[#D92916] font-medium">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isPending}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            style={{ backgroundColor: domainColor, borderColor: domainColor }}
          >
            {isPending ? '저장 중...' : isEdit ? '수정 완료' : '문제 추가'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── 삭제 확인 모달 ────────────────────────────────────────────────────────────

function DeleteModal({
  question,
  onClose,
  onDeleted,
  actDelete,
}: {
  question: QuestionRow
  onClose: () => void
  onDeleted: () => void
  actDelete: (id: string) => Promise<{ error?: string }>
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleDelete = () => {
    startTransition(async () => {
      const result = await actDelete(question.id)
      if (result.error) setError(result.error)
      else onDeleted()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-sm p-6 space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[#FFF0EE] flex items-center justify-center mx-auto mb-3">
            <Trash2 size={22} className="text-[#D92916]" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">문제 삭제</h2>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            이 문제를 삭제하면 관련 응시 데이터도 함께 삭제됩니다.<br />
            이 작업은 되돌릴 수 없습니다.
          </p>
        </div>
        {error && <p className="text-sm text-[#D92916] text-center">{error}</p>}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">취소</Button>
          <Button
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1 text-white border-0"
            style={{ backgroundColor: '#D92916' }}
          >
            {isPending ? '삭제 중...' : '삭제'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 내보내기 ─────────────────────────────────────────────────────────────

export default function QuestionBankClient({
  questions: initialQuestions,
  actCreate,
  actUpdate,
  actDelete,
}: {
  questions: QuestionRow[]
  actCreate: (input: CreateInput) => Promise<{ error?: string; id?: string }>
  actUpdate: (input: UpdateInput) => Promise<{ error?: string }>
  actDelete: (id: string) => Promise<{ error?: string }>
}) {
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState<QuestionDomainType | 'ALL'>('ALL')
  const [filterType, setFilterType] = useState<QuestionType | 'ALL'>('ALL')
  const [filterCefr, setFilterCefr] = useState<string>('ALL')
  const [filterDifficulty, setFilterDifficulty] = useState<number>(0)

  const [formModal, setFormModal] = useState<{ open: boolean; question: QuestionRow | null }>({
    open: false,
    question: null,
  })
  const [previewQuestion, setPreviewQuestion] = useState<QuestionRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<QuestionRow | null>(null)

  const filtered = useMemo(() => {
    return initialQuestions.filter((q) => {
      if (filterDomain !== 'ALL' && q.domain !== filterDomain) return false
      if (filterType !== 'ALL' && q.contentJson.type !== filterType) return false
      if (filterCefr !== 'ALL' && q.cefrLevel !== filterCefr) return false
      if (filterDifficulty > 0 && q.difficulty !== filterDifficulty) return false
      if (search) {
        const s = search.toLowerCase()
        return (
          q.contentJson.question_text.toLowerCase().includes(s) ||
          (q.subCategory ?? '').toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [initialQuestions, filterDomain, filterType, filterCefr, filterDifficulty, search])

  const openAdd = useCallback(() => setFormModal({ open: true, question: null }), [])
  const openEdit = useCallback((q: QuestionRow) => setFormModal({ open: true, question: q }), [])

  const handleSaved = useCallback(() => {
    setFormModal({ open: false, question: null })
    window.location.reload()
  }, [])

  const handleDeleted = useCallback(() => {
    setDeleteTarget(null)
    window.location.reload()
  }, [])

  return (
    <div className="space-y-6">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="문제 본문 검색..."
            className="pl-9"
          />
        </div>

        <StyledSelect value={filterDomain} onChange={(v) => setFilterDomain(v as QuestionDomainType | 'ALL')}>
          <option value="ALL">전체 영역</option>
          <option value="GRAMMAR">문법</option>
          <option value="VOCABULARY">어휘</option>
          <option value="READING">읽기</option>
          <option value="WRITING">쓰기</option>
        </StyledSelect>

        <StyledSelect value={filterType} onChange={(v) => setFilterType(v as QuestionType | 'ALL')}>
          <option value="ALL">전체 유형</option>
          <option value="multiple_choice">객관식</option>
          <option value="fill_blank">빈칸 채우기</option>
          <option value="short_answer">단답형</option>
          <option value="essay">서술형</option>
        </StyledSelect>

        <StyledSelect value={filterCefr} onChange={setFilterCefr}>
          <option value="ALL">전체 CEFR</option>
          {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </StyledSelect>

        <StyledSelect value={String(filterDifficulty)} onChange={(v) => setFilterDifficulty(Number(v))}>
          <option value="0">전체 난이도</option>
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>{'★'.repeat(d)} ({d})</option>
          ))}
        </StyledSelect>

        <div className="ml-auto">
          <Button onClick={openAdd} className="gap-2">
            <Plus size={16} />
            문제 추가
          </Button>
        </div>
      </div>

      {/* 결과 카운트 */}
      <p className="text-sm text-gray-500">
        전체 <strong className="text-gray-900">{initialQuestions.length}</strong>개 중{' '}
        <strong className="text-gray-900">{filtered.length}</strong>개 표시
      </p>

      {/* 문제 목록 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">문제가 없습니다</p>
          <p className="text-sm text-gray-300 mt-1">새 문제를 추가하거나 필터를 조정해보세요.</p>
          <Button onClick={openAdd} className="mt-4 gap-2">
            <Plus size={16} />
            첫 문제 추가
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="bg-gray-50 px-5 py-3 grid gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide"
            style={{ gridTemplateColumns: '1fr 100px 90px 70px 70px 80px 100px' }}>
            <span>문제</span>
            <span>영역</span>
            <span>유형</span>
            <span>난이도</span>
            <span>CEFR</span>
            <span>정답률</span>
            <span className="text-right">관리</span>
          </div>

          {/* 바디 */}
          <div className="divide-y divide-gray-200">
            {filtered.map((q) => {
              const content = q.contentJson
              const domainColor = DOMAIN_COLOR[q.domain]
              return (
                <div key={q.id} className="flex items-center hover:bg-gray-50/50 transition-colors">
                  {/* 도메인 바 */}
                  <div className="w-1 self-stretch shrink-0" style={{ backgroundColor: domainColor }} />

                  {/* 그리드 컨테이너 */}
                  <div
                    className="flex-1 grid gap-4 px-4 py-4 items-center"
                    style={{ gridTemplateColumns: '1fr 100px 90px 70px 70px 80px 100px' }}
                  >
                    {/* 문제 본문 */}
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 font-medium truncate leading-snug">
                        {content.question_text || '(본문 없음)'}
                      </p>
                      {q.subCategory && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{q.subCategory}</p>
                      )}
                    </div>

                    <DomainBadge domain={q.domain} />

                    <span className="text-xs text-gray-500">{TYPE_LABEL[content.type]}</span>

                    <DifficultyStars value={q.difficulty} />

                    <span>
                      {q.cefrLevel ? (
                        <span className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600">
                          {q.cefrLevel}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">–</span>
                      )}
                    </span>

                    <CorrectRateBadge rate={q.statsJson?.correct_rate ?? null} />

                    {/* 액션 버튼 */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPreviewQuestion(q)}
                        className="p-2 rounded-lg text-gray-400 hover:text-primary-700 hover:bg-primary-100 transition-colors"
                        title="미리보기"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => openEdit(q)}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="수정"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(q)}
                        className="p-2 rounded-lg text-gray-400 hover:text-[#D92916] hover:bg-[#FFF0EE] transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 모달 */}
      {formModal.open && (
        <QuestionFormModal
          initial={formModal.question}
          onClose={() => setFormModal({ open: false, question: null })}
          onSaved={handleSaved}
          actCreate={actCreate}
          actUpdate={actUpdate}
        />
      )}
      {previewQuestion && (
        <PreviewModal question={previewQuestion} onClose={() => setPreviewQuestion(null)} />
      )}
      {deleteTarget && (
        <DeleteModal
          question={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
          actDelete={actDelete}
        />
      )}
    </div>
  )
}
