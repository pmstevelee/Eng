'use client'

import { useState, useMemo, useTransition, useCallback, useRef } from 'react'
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  X,
  BookOpen,
  ImagePlus,
  Loader2,
  Sparkles,
  Volume2,
  Mic,
  CheckSquare,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image'

// ── 타입 정의 ─────────────────────────────────────────────────────────────────

export type QuestionDomainType = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING' | 'LISTENING'
export type QuestionType = 'multiple_choice' | 'fill_blank' | 'short_answer' | 'essay'

export type QuestionContentJson = {
  type: QuestionType
  question_text: string
  question_text_ko?: string
  options?: string[]
  option_images?: (string | null)[]
  correct_answer?: string
  explanation?: string
  passage?: string
  passage_image_url?: string
  question_image_url?: string
  word_limit?: number
  audio_url?: string
  audio_script?: string
}

export type QuestionRow = {
  id: string
  domain: QuestionDomainType
  subCategory: string | null
  difficulty: number
  cefrLevel: string | null
  questionType: QuestionType
  questionText: string
  statsJson: { attempt_count: number; correct_count: number; correct_rate: number } | null
  createdAt: string
  creator: { name: string } | null
}

type QuestionDetailRow = QuestionRow & { contentJson: QuestionContentJson }

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
  LISTENING: '듣기',
}

const DOMAIN_COLOR: Record<QuestionDomainType, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
  LISTENING: '#0EA5E9',
}

const DOMAIN_BG: Record<QuestionDomainType, string> = {
  GRAMMAR: '#EEF4FF',
  VOCABULARY: '#F3EFFF',
  READING: '#E6FAF8',
  WRITING: '#FEF0E8',
  LISTENING: '#E0F2FE',
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

function CorrectRateBadge({ rate }: { rate: number | null | undefined }) {
  if (rate == null) return <span className="text-gray-300 text-sm">–</span>
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

// ── 이미지 업로드 컴포넌트 ──────────────────────────────────────────────────────

function ImageUploadField({
  imageUrl,
  onChange,
  label = '이미지 추가',
}: {
  imageUrl: string | null | undefined
  onChange: (url: string | null) => void
  label?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload-image', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) setUploadError(data.error ?? '업로드 실패')
      else onChange(data.url)
    } catch {
      setUploadError('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="mt-2">
      {imageUrl ? (
        <div className="relative inline-block">
          <Image
            src={imageUrl}
            alt="첨부 이미지"
            width={320}
            height={200}
            className="rounded-xl border border-gray-200 object-contain max-h-48 w-auto"
            unoptimized
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#D92916] text-white flex items-center justify-center shadow-sm hover:bg-red-700 transition-colors"
            title="이미지 삭제"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-500 hover:border-primary-700 hover:text-primary-700 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 size={13} className="animate-spin" />업로드 중...</>
          ) : (
            <><ImagePlus size={13} />{label}</>
          )}
        </button>
      )}
      {uploadError && <p className="text-xs text-[#D92916] mt-1">{uploadError}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

// ── 오디오 업로드 컴포넌트 ─────────────────────────────────────────────────────

function AudioUploadField({
  audioUrl,
  onChange,
  label = '음성 파일 업로드',
}: {
  audioUrl: string | null | undefined
  onChange: (url: string | null) => void
  label?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload-audio', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) setUploadError(data.error ?? '업로드 실패')
      else onChange(data.url)
    } catch {
      setUploadError('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {audioUrl ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-[#0EA5E9]/30 bg-[#E0F2FE]">
          <div className="w-8 h-8 rounded-full bg-[#0EA5E9] flex items-center justify-center shrink-0">
            <Volume2 size={15} className="text-white" />
          </div>
          <audio controls className="flex-1 h-8" style={{ minWidth: 0 }}>
            <source src={audioUrl} />
            브라우저가 오디오를 지원하지 않습니다.
          </audio>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="w-6 h-6 rounded-full bg-[#D92916] text-white flex items-center justify-center shrink-0 hover:bg-red-700 transition-colors"
            title="오디오 삭제"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-[#0EA5E9]/40 bg-[#E0F2FE]/30 text-[#0EA5E9] hover:border-[#0EA5E9] hover:bg-[#E0F2FE]/60 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 size={22} className="animate-spin" /><span className="text-sm">업로드 중...</span></>
          ) : (
            <><Mic size={22} /><span className="text-sm font-medium">{label}</span><span className="text-xs text-gray-400">MP3, WAV, M4A, OGG, AAC · 최대 30MB</span></>
          )}
        </button>
      )}
      {uploadError && <p className="text-xs text-[#D92916]">{uploadError}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/mp4,audio/m4a,audio/x-m4a,audio/ogg,audio/aac"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

// ── 미리보기 모달 ─────────────────────────────────────────────────────────────

function PreviewModal({ question, onClose }: { question: QuestionDetailRow; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showScript, setShowScript] = useState(false)
  const content = question.contentJson
  const domainColor = DOMAIN_COLOR[question.domain]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-sm">
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

        <div className="p-6">
          <div className="rounded-xl border border-gray-200 p-8 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: domainColor }} />

            {/* 리스닝: 오디오 플레이어 */}
            {question.domain === 'LISTENING' && content.audio_url && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 tracking-wide">음성 파일</p>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-[#0EA5E9]/30 bg-[#E0F2FE]">
                  <div className="w-8 h-8 rounded-full bg-[#0EA5E9] flex items-center justify-center shrink-0">
                    <Volume2 size={15} className="text-white" />
                  </div>
                  <audio controls className="flex-1">
                    <source src={content.audio_url} />
                  </audio>
                </div>
                {content.audio_script && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowScript(!showScript)}
                      className="text-xs text-[#0EA5E9] hover:underline"
                    >
                      {showScript ? '스크립트 숨기기' : '스크립트 보기'}
                    </button>
                    {showScript && (
                      <div className="mt-2 p-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {content.audio_script}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 읽기: 지문 */}
            {content.passage && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 tracking-wide">지문</p>
                <p className="whitespace-pre-wrap">{content.passage}</p>
                {content.passage_image_url && (
                  <Image
                    src={content.passage_image_url}
                    alt="지문 이미지"
                    width={480}
                    height={300}
                    className="mt-3 rounded-xl border border-gray-200 object-contain max-h-64 w-auto"
                    unoptimized
                  />
                )}
              </div>
            )}

            <p className="text-base font-medium text-gray-900 leading-relaxed mb-1">
              {content.question_text || '문제 본문이 없습니다.'}
            </p>
            {content.question_text_ko && (
              <p className="text-sm text-gray-500 mb-2">{content.question_text_ko}</p>
            )}
            {content.question_image_url && (
              <Image
                src={content.question_image_url}
                alt="문제 이미지"
                width={480}
                height={300}
                className="mt-2 mb-4 rounded-xl border border-gray-200 object-contain max-h-64 w-auto"
                unoptimized
              />
            )}

            {content.type === 'multiple_choice' && content.options && (
              <div className="mt-4 space-y-3">
                {content.options.map((opt, i) => {
                  const label = String.fromCharCode(65 + i)
                  const isSelected = selected === label
                  const isCorrect = content.correct_answer === label
                  const optImage = content.option_images?.[i]
                  return (
                    <button
                      key={i}
                      onClick={() => setSelected(label)}
                      className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                        isSelected ? 'border-primary-700 bg-primary-100' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-semibold mr-3" style={{ color: domainColor }}>{label}.</span>
                      <span className="text-gray-900 text-sm">{opt || `선택지 ${label}`}</span>
                      {selected && isCorrect && (
                        <span className="ml-2 text-xs text-accent-green font-semibold">✓ 정답</span>
                      )}
                      {optImage && (
                        <div className="mt-2">
                          <Image
                            src={optImage}
                            alt={`선택지 ${label} 이미지`}
                            width={240}
                            height={150}
                            className="rounded-lg border border-gray-200 object-contain max-h-36 w-auto"
                            unoptimized
                          />
                        </div>
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
  initial: QuestionDetailRow | null
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
  const [optionImages, setOptionImages] = useState<(string | null)[]>(
    initial?.contentJson.option_images ?? [null, null, null, null],
  )
  const [correctAnswer, setCorrectAnswer] = useState(initial?.contentJson.correct_answer ?? '')
  const [explanation, setExplanation] = useState(initial?.contentJson.explanation ?? '')
  const [passage, setPassage] = useState(initial?.contentJson.passage ?? '')
  const [passageImageUrl, setPassageImageUrl] = useState<string | null>(
    initial?.contentJson.passage_image_url ?? null,
  )
  const [questionImageUrl, setQuestionImageUrl] = useState<string | null>(
    initial?.contentJson.question_image_url ?? null,
  )
  const [wordLimit, setWordLimit] = useState<number>(initial?.contentJson.word_limit ?? 200)
  const [audioUrl, setAudioUrl] = useState<string | null>(initial?.contentJson.audio_url ?? null)
  const [audioScript, setAudioScript] = useState(initial?.contentJson.audio_script ?? '')

  const TABS: { key: QuestionType; label: string }[] = [
    { key: 'multiple_choice', label: '객관식' },
    { key: 'fill_blank', label: '빈칸' },
    { key: 'short_answer', label: '단답형' },
    { key: 'essay', label: '서술형' },
  ]

  const updateOption = (i: number, val: string) => {
    const next = [...options]; next[i] = val; setOptions(next)
  }
  const updateOptionImage = (i: number, url: string | null) => {
    const next = [...optionImages]; next[i] = url; setOptionImages(next)
  }

  const buildContentJson = (): QuestionContentJson => {
    const base = {
      type: qType,
      question_text: questionText,
      question_text_ko: questionTextKo || undefined,
      explanation: explanation || undefined,
      question_image_url: questionImageUrl || undefined,
    }
    if (domain === 'LISTENING') {
      const result: QuestionContentJson = {
        ...base,
        audio_url: audioUrl || undefined,
        audio_script: audioScript || undefined,
      }
      if (qType === 'multiple_choice') {
        const hasOptionImages = optionImages.some((img) => img !== null)
        return { ...result, options, option_images: hasOptionImages ? optionImages : undefined, correct_answer: correctAnswer }
      }
      if (qType === 'fill_blank' || qType === 'short_answer') return { ...result, correct_answer: correctAnswer }
      return result
    }
    if (qType === 'multiple_choice') {
      const hasOptionImages = optionImages.some((img) => img !== null)
      return { ...base, options, option_images: hasOptionImages ? optionImages : undefined, correct_answer: correctAnswer }
    }
    if (qType === 'fill_blank') return { ...base, correct_answer: correctAnswer }
    if (qType === 'short_answer') return { ...base, correct_answer: correctAnswer }
    return {
      ...base,
      passage: passage || undefined,
      passage_image_url: passageImageUrl || undefined,
      word_limit: wordLimit,
    }
  }

  const handleSubmit = () => {
    if (!questionText.trim()) { setError('문제 본문을 입력해주세요.'); return }
    if (domain === 'LISTENING' && !audioUrl) { setError('음성 파일을 업로드해주세요.'); return }
    if (qType !== 'essay' && domain !== 'LISTENING' && !correctAnswer.trim()) { setError('정답을 입력해주세요.'); return }
    if (qType !== 'essay' && domain === 'LISTENING' && qType !== 'multiple_choice' && !correctAnswer.trim()) {
      setError('정답을 입력해주세요.'); return
    }
    setError('')
    const contentJson = buildContentJson()
    startTransition(async () => {
      let result
      if (isEdit) {
        result = await actUpdate({ id: initial!.id, domain, subCategory: subCategory || undefined, difficulty, cefrLevel: cefrLevel || undefined, contentJson })
      } else {
        result = await actCreate({ domain, subCategory: subCategory || undefined, difficulty, cefrLevel: cefrLevel || undefined, contentJson })
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
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
                  <option value="LISTENING">듣기 (Listening)</option>
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
                <Input value={subCategory} onChange={(e) => setSubCategory(e.target.value)} placeholder="예: 현재완료, 관계대명사..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  난이도 <DifficultyStars value={difficulty} />
                </label>
                <div className="flex items-center gap-3 h-11">
                  <input type="range" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="w-full accent-primary-700" />
                  <span className="text-sm font-bold text-gray-700 w-4">{difficulty}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 리스닝: 음성 파일 */}
          {domain === 'LISTENING' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Volume2 size={14} />음성 파일
              </h3>
              <AudioUploadField audioUrl={audioUrl} onChange={setAudioUrl} label="음성 파일 업로드 (MP3, WAV 등)" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">스크립트 (선택)</label>
                <StyledTextarea value={audioScript} onChange={setAudioScript} placeholder="오디오 스크립트/대본을 입력하세요 (학생에게 숨김)..." rows={4} />
              </div>
            </section>
          )}

          {/* 문제 유형 */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">문제 유형</h3>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setQType(tab.key)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    qType === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {/* 지문 (읽기만) */}
          {domain === 'READING' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지문 (선택)</label>
              <StyledTextarea value={passage} onChange={setPassage} placeholder="읽기 지문을 입력하세요..." rows={5} />
              <ImageUploadField imageUrl={passageImageUrl} onChange={setPassageImageUrl} label="지문 이미지 추가" />
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
            <ImageUploadField imageUrl={questionImageUrl} onChange={setQuestionImageUrl} label="문제 이미지 추가" />
          </div>

          {/* 한국어 번역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">한국어 번역 (선택)</label>
            <Input value={questionTextKo} onChange={(e) => setQuestionTextKo(e.target.value)} placeholder="학생에게 보여줄 한국어 해석" />
          </div>

          {/* 선택지 (객관식) */}
          {qType === 'multiple_choice' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">선택지 (A~D)</label>
              <div className="space-y-3">
                {options.map((opt, i) => {
                  const label = String.fromCharCode(65 + i)
                  const isCorrect = correctAnswer === label
                  return (
                    <div key={i} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCorrectAnswer(isCorrect ? '' : label)}
                          className={`w-8 h-8 rounded-full text-sm font-bold border-2 shrink-0 transition-all ${
                            isCorrect ? 'border-[#1FAF54] bg-[#1FAF54] text-white' : 'border-gray-200 text-gray-400 hover:border-[#1FAF54] hover:text-[#1FAF54]'
                          }`}
                          title="클릭하여 정답 선택"
                        >
                          {label}
                        </button>
                        <Input value={opt} onChange={(e) => updateOption(i, e.target.value)} placeholder={`선택지 ${label}`} className="flex-1" />
                      </div>
                      <ImageUploadField imageUrl={optionImages[i]} onChange={(url) => updateOptionImage(i, url)} label={`선택지 ${label} 이미지`} />
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
          {qType === 'essay' && domain !== 'LISTENING' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">최대 단어 수</label>
              <div className="flex items-center gap-3 h-11">
                <input type="range" min={50} max={500} step={50} value={wordLimit} onChange={(e) => setWordLimit(Number(e.target.value))} className="w-full accent-primary-700" />
                <span className="text-sm font-bold text-gray-700 w-12">{wordLimit}자</span>
              </div>
            </div>
          )}

          {/* 해설 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">해설 (선택)</label>
            <StyledTextarea value={explanation} onChange={setExplanation} placeholder="정답에 대한 해설을 입력하세요..." rows={3} />
          </div>

          <div className="h-1 rounded-full w-full" style={{ backgroundColor: domainColor }} />
          {error && <p className="text-sm text-[#D92916] font-medium">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isPending}>취소</Button>
          <Button onClick={handleSubmit} disabled={isPending} style={{ backgroundColor: domainColor, borderColor: domainColor }}>
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
          <Button onClick={handleDelete} disabled={isPending} className="flex-1 text-white border-0" style={{ backgroundColor: '#D92916' }}>
            {isPending ? '삭제 중...' : '삭제'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── AI 유사문제 생성 모달 ─────────────────────────────────────────────────────

type GeneratedSimilarQuestion = {
  domain: string
  subCategory?: string
  difficulty: number
  cefrLevel: string
  contentJson: QuestionContentJson
}

function SimilarQuestionsModal({
  question,
  onClose,
  onSaved,
  actCreate,
}: {
  question: QuestionDetailRow
  onClose: () => void
  onSaved: () => void
  actCreate: (input: CreateInput) => Promise<{ error?: string; id?: string }>
}) {
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState<GeneratedSimilarQuestion[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [savedCount, setSavedCount] = useState(0)

  const generate = useCallback(async () => {
    setLoading(true)
    setError('')
    setGenerated([])
    setSelected(new Set())
    setSavedCount(0)
    try {
      const res = await fetch('/api/ai/generate-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: question.domain,
          difficulty: question.difficulty,
          cefrLevel: question.cefrLevel ?? 'B1',
          contentJson: question.contentJson,
          count: 3,
        }),
      })
      let data: { success?: boolean; questions?: GeneratedSimilarQuestion[]; error?: string } = {}
      try {
        data = await res.json()
      } catch {
        setError(`서버 오류가 발생했습니다. (HTTP ${res.status})`)
        return
      }
      if (!res.ok || !data.success) {
        setError(data.error ?? `AI 생성 중 오류가 발생했습니다. (HTTP ${res.status})`)
      } else {
        setGenerated(data.questions ?? [])
        setSelected(new Set((data.questions ?? []).map((_: unknown, i: number) => i)))
      }
    } catch {
      setError('네트워크 연결을 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }, [question])

  const toggleSelect = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const handleSave = async () => {
    const toSave = generated.filter((_, i) => selected.has(i))
    if (toSave.length === 0) { setSaveError('저장할 문제를 선택해주세요.'); return }
    setSaving(true)
    setSaveError('')
    let count = 0
    for (const q of toSave) {
      const result = await actCreate({
        domain: q.domain as QuestionDomainType,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        cefrLevel: q.cefrLevel,
        contentJson: q.contentJson,
      })
      if (!result.error) count++
    }
    setSaving(false)
    setSavedCount(count)
    if (count > 0) {
      setTimeout(() => onSaved(), 1200)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-sm">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#F3EFFF] flex items-center justify-center">
              <Sparkles size={16} className="text-[#7854F7]" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">AI 유사문제 생성</h2>
              <p className="text-xs text-gray-400">선택한 문제와 유사한 문제를 AI가 생성합니다</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        {/* 원본 문제 요약 */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
          <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">원본 문제</p>
          <div className="flex items-center gap-2 flex-wrap">
            <DomainBadge domain={question.domain} />
            <span className="text-xs text-gray-500">CEFR: {question.cefrLevel ?? '–'}</span>
            <span className="text-xs text-gray-500">난이도: {question.difficulty}/5</span>
            <span className="text-xs text-gray-900 font-medium truncate max-w-xs">{question.questionText || '(본문 없음)'}</span>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!loading && generated.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-[#F3EFFF] flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-[#7854F7]" />
              </div>
              <p className="text-gray-700 font-medium">AI 유사문제 생성</p>
              <p className="text-sm text-gray-400 mt-1">같은 영역·난이도의 유사한 문제 3개를 생성합니다</p>
              <Button
                onClick={generate}
                className="mt-5 gap-2"
                style={{ backgroundColor: '#7854F7', borderColor: '#7854F7' }}
              >
                <Sparkles size={15} />
                유사문제 생성하기
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 size={32} className="text-[#7854F7] animate-spin mb-3" />
              <p className="text-sm text-gray-500">AI가 유사문제를 생성하고 있습니다...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-[#FFF0EE] border border-[#D92916]/20 text-center">
              <p className="text-sm text-[#D92916]">{error}</p>
              <Button variant="outline" onClick={generate} className="mt-3 text-xs">다시 시도</Button>
            </div>
          )}

          {savedCount > 0 && (
            <div className="p-4 rounded-xl bg-[#E6F7ED] border border-[#1FAF54]/20 text-center">
              <p className="text-sm text-[#1FAF54] font-semibold">{savedCount}개 문제가 문제 뱅크에 저장되었습니다!</p>
            </div>
          )}

          {generated.length > 0 && savedCount === 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">{generated.length}개 문제 생성됨</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelected(new Set(generated.map((_, i) => i)))} className="text-xs text-primary-700 hover:underline">전체 선택</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:underline">선택 해제</button>
                  <Button variant="outline" onClick={generate} className="text-xs h-8 gap-1">
                    <Sparkles size={12} />다시 생성
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {generated.map((q, i) => {
                  const isSelected = selected.has(i)
                  return (
                    <div
                      key={i}
                      onClick={() => toggleSelect(i)}
                      className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                        isSelected ? 'border-[#7854F7] bg-[#F3EFFF]/50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {isSelected
                            ? <CheckSquare size={18} className="text-[#7854F7]" />
                            : <Square size={18} className="text-gray-300" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <DomainBadge domain={q.domain as QuestionDomainType} />
                            {q.subCategory && <span className="text-xs text-gray-500">{q.subCategory}</span>}
                            <span className="text-xs text-gray-400">CEFR: {q.cefrLevel}</span>
                            <DifficultyStars value={q.difficulty} />
                            <span className="text-xs text-gray-400">{TYPE_LABEL[q.contentJson.type]}</span>
                          </div>
                          <p className="text-sm text-gray-900 font-medium leading-snug">{q.contentJson.question_text}</p>
                          {q.contentJson.options && (
                            <div className="mt-2 space-y-1">
                              {q.contentJson.options.map((opt, j) => (
                                <p key={j} className={`text-xs ${q.contentJson.correct_answer === String.fromCharCode(65 + j) ? 'text-[#1FAF54] font-semibold' : 'text-gray-500'}`}>
                                  {String.fromCharCode(65 + j)}. {opt}
                                  {q.contentJson.correct_answer === String.fromCharCode(65 + j) && ' ✓'}
                                </p>
                              ))}
                            </div>
                          )}
                          {q.contentJson.correct_answer && !q.contentJson.options && (
                            <p className="text-xs text-[#1FAF54] mt-1 font-medium">정답: {q.contentJson.correct_answer}</p>
                          )}
                          {q.contentJson.explanation && (
                            <p className="text-xs text-gray-400 mt-1.5 italic">{q.contentJson.explanation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {saveError && <p className="text-sm text-[#D92916]">{saveError}</p>}
            </>
          )}
        </div>

        {/* 푸터 */}
        {generated.length > 0 && savedCount === 0 && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
            <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
            <Button
              onClick={handleSave}
              disabled={saving || selected.size === 0}
              style={{ backgroundColor: '#7854F7', borderColor: '#7854F7' }}
              className="gap-2"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" />저장 중...</> : `선택한 ${selected.size}개 문제 저장`}
            </Button>
          </div>
        )}
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
  actGetDetail,
}: {
  questions: QuestionRow[]
  actCreate: (input: CreateInput) => Promise<{ error?: string; id?: string }>
  actUpdate: (input: UpdateInput) => Promise<{ error?: string }>
  actDelete: (id: string) => Promise<{ error?: string }>
  actGetDetail: (id: string) => Promise<QuestionContentJson | null>
}) {
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState<QuestionDomainType | 'ALL'>('ALL')
  const [filterType, setFilterType] = useState<QuestionType | 'ALL'>('ALL')
  const [filterCefr, setFilterCefr] = useState<string>('ALL')
  const [filterDifficulty, setFilterDifficulty] = useState<number>(0)

  const [formModal, setFormModal] = useState<{ open: boolean; question: QuestionDetailRow | null }>({ open: false, question: null })
  const [previewQuestion, setPreviewQuestion] = useState<QuestionDetailRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<QuestionRow | null>(null)
  const [similarTarget, setSimilarTarget] = useState<QuestionDetailRow | null>(null)

  const filtered = useMemo(() => {
    return initialQuestions.filter((q) => {
      if (filterDomain !== 'ALL' && q.domain !== filterDomain) return false
      if (filterType !== 'ALL' && q.questionType !== filterType) return false
      if (filterCefr !== 'ALL' && q.cefrLevel !== filterCefr) return false
      if (filterDifficulty > 0 && q.difficulty !== filterDifficulty) return false
      if (search) {
        const s = search.toLowerCase()
        return q.questionText.toLowerCase().includes(s) || (q.subCategory ?? '').toLowerCase().includes(s)
      }
      return true
    })
  }, [initialQuestions, filterDomain, filterType, filterCefr, filterDifficulty, search])

  const detailCacheRef = useRef<Record<string, QuestionContentJson>>({})
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null)

  const loadDetail = useCallback(async (id: string): Promise<QuestionContentJson | null> => {
    if (detailCacheRef.current[id]) return detailCacheRef.current[id]
    const data = await actGetDetail(id)
    if (data) detailCacheRef.current[id] = data
    return data
  }, [actGetDetail])

  const openAdd = useCallback(() => setFormModal({ open: true, question: null }), [])

  const openPreview = useCallback(async (q: QuestionRow) => {
    setLoadingDetailId(q.id)
    const contentJson = await loadDetail(q.id)
    setLoadingDetailId(null)
    if (contentJson) setPreviewQuestion({ ...q, contentJson })
  }, [loadDetail])

  const openEdit = useCallback(async (q: QuestionRow) => {
    setLoadingDetailId(q.id)
    const contentJson = await loadDetail(q.id)
    setLoadingDetailId(null)
    if (contentJson) setFormModal({ open: true, question: { ...q, contentJson } })
  }, [loadDetail])

  const openSimilar = useCallback(async (q: QuestionRow) => {
    setLoadingDetailId(q.id)
    const contentJson = await loadDetail(q.id)
    setLoadingDetailId(null)
    if (contentJson) setSimilarTarget({ ...q, contentJson })
  }, [loadDetail])

  const handleSaved = useCallback(() => {
    setFormModal({ open: false, question: null })
    window.location.reload()
  }, [])

  const handleDeleted = useCallback(() => {
    setDeleteTarget(null)
    window.location.reload()
  }, [])

  const handleSimilarSaved = useCallback(() => {
    setSimilarTarget(null)
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
          <option value="LISTENING">듣기</option>
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
          <div
            className="bg-gray-50 px-5 py-3 grid gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide"
            style={{ gridTemplateColumns: '1fr 100px 90px 70px 70px 80px 130px' }}
          >
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
              const domainColor = DOMAIN_COLOR[q.domain]
              const isLoadingThis = loadingDetailId === q.id
              return (
                <div key={q.id} className="flex items-center hover:bg-gray-50/50 transition-colors">
                  <div className="w-1 self-stretch shrink-0" style={{ backgroundColor: domainColor }} />
                  <div
                    className="flex-1 grid gap-4 px-4 py-4 items-center"
                    style={{ gridTemplateColumns: '1fr 100px 90px 70px 70px 80px 130px' }}
                  >
                    {/* 문제 본문 */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {q.domain === 'LISTENING' && (
                          <Volume2 size={13} className="text-[#0EA5E9] shrink-0" />
                        )}
                        <p className="text-sm text-gray-900 font-medium truncate leading-snug">
                          {q.questionText || '(본문 없음)'}
                        </p>
                      </div>
                      {q.subCategory && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{q.subCategory}</p>
                      )}
                    </div>

                    <DomainBadge domain={q.domain} />
                    <span className="text-xs text-gray-500">{TYPE_LABEL[q.questionType]}</span>
                    <DifficultyStars value={q.difficulty} />
                    <span>
                      {q.cefrLevel ? (
                        <span className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600">{q.cefrLevel}</span>
                      ) : (
                        <span className="text-gray-300 text-xs">–</span>
                      )}
                    </span>
                    <CorrectRateBadge rate={q.statsJson?.correct_rate ?? null} />

                    {/* 액션 버튼 */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openPreview(q)}
                        disabled={isLoadingThis}
                        className="p-2 rounded-lg text-gray-400 hover:text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-40"
                        title="미리보기"
                      >
                        {isLoadingThis ? <span className="block w-[15px] h-[15px] border-2 border-gray-300 border-t-primary-700 rounded-full animate-spin" /> : <Eye size={15} />}
                      </button>
                      <button
                        onClick={() => openSimilar(q)}
                        disabled={isLoadingThis}
                        className="p-2 rounded-lg text-gray-400 hover:text-[#7854F7] hover:bg-[#F3EFFF] transition-colors disabled:opacity-40"
                        title="AI 유사문제 생성"
                      >
                        <Sparkles size={15} />
                      </button>
                      <button
                        onClick={() => openEdit(q)}
                        disabled={isLoadingThis}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
                        title="수정"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(q)}
                        disabled={isLoadingThis}
                        className="p-2 rounded-lg text-gray-400 hover:text-[#D92916] hover:bg-[#FFF0EE] transition-colors disabled:opacity-40"
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
      {similarTarget && (
        <SimilarQuestionsModal
          question={similarTarget}
          onClose={() => setSimilarTarget(null)}
          onSaved={handleSimilarSaved}
          actCreate={actCreate}
        />
      )}
    </div>
  )
}
