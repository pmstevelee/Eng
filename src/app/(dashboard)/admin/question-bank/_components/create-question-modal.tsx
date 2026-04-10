'use client'

import { useState, useTransition, useCallback, useRef } from 'react'
import {
  X,
  ImagePlus,
  Loader2,
  Sparkles,
  Volume2,
  Mic,
  CheckCircle2,
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createQuestion, analyzeQuestionWithAI } from '../actions'
import type { CreateQuestionPayload, QuestionContentJson, AIAnalysisResult } from '../actions'
import type { QuestionDomain } from '@/generated/prisma'

// ── 타입 ──────────────────────────────────────────────────────────────────────

type QuestionType = 'multiple_choice' | 'fill_blank' | 'short_answer' | 'essay'
type DomainType = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING' | 'LISTENING'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const DOMAIN_COLOR: Record<DomainType, string> = {
  GRAMMAR: '#1865F2',
  VOCABULARY: '#7854F7',
  READING: '#0FBFAD',
  WRITING: '#E35C20',
  LISTENING: '#E91E8A',
}

const CEFR_LEVELS = [
  'Pre-A1', 'A1 하', 'A1 상', 'A2 하', 'A2 상',
  'B1 하', 'B1 상', 'B2 하', 'B2 상', 'C1+',
]

const CEFR_TO_DIFFICULTY: Record<string, number> = {
  'Pre-A1': 1, 'A1 하': 2, 'A1 상': 3, 'A2 하': 4, 'A2 상': 5,
  'B1 하': 6, 'B1 상': 7, 'B2 하': 8, 'B2 상': 9, 'C1+': 10,
}

// ── 헬퍼 컴포넌트 ─────────────────────────────────────────────────────────────

function DifficultyStars({ value }: { value: number }) {
  return (
    <span className="text-xs text-amber-400 tracking-tight">
      {'★'.repeat(Math.min(value, 10))}
      <span className="text-gray-200">{'★'.repeat(Math.max(0, 10 - value))}</span>
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
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none"
    />
  )
}

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

function AudioUploadField({
  audioUrl,
  onChange,
}: {
  audioUrl: string | null | undefined
  onChange: (url: string | null) => void
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
        <div className="flex items-center gap-3 p-3 rounded-xl border border-[#E91E8A]/30 bg-[#FDE7F3]">
          <div className="w-8 h-8 rounded-full bg-[#E91E8A] flex items-center justify-center shrink-0">
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
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-[#E91E8A]/40 bg-[#FDE7F3]/30 text-[#E91E8A] hover:border-[#E91E8A] hover:bg-[#FDE7F3]/60 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 size={22} className="animate-spin" /><span className="text-sm">업로드 중...</span></>
          ) : (
            <>
              <Mic size={22} />
              <span className="text-sm font-medium">음성 파일 업로드</span>
              <span className="text-xs text-gray-400">MP3, WAV, M4A, OGG, AAC · 최대 30MB</span>
            </>
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

// ── 메인 모달 컴포넌트 ────────────────────────────────────────────────────────

type Props = {
  onClose: () => void
  onCreated: () => void
}

const TABS: { key: QuestionType; label: string }[] = [
  { key: 'multiple_choice', label: '객관식' },
  { key: 'fill_blank', label: '빈칸' },
  { key: 'short_answer', label: '단답형' },
  { key: 'essay', label: '서술형' },
]

export default function CreateQuestionModal({ onClose, onCreated }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // 기본 정보
  const [domain, setDomain] = useState<DomainType>('GRAMMAR')
  const [subCategory, setSubCategory] = useState('')
  const [difficulty, setDifficulty] = useState(3)
  const [cefrLevel, setCefrLevel] = useState('A1 상')

  // 문제 유형
  const [qType, setQType] = useState<QuestionType>('multiple_choice')

  // 문제 내용
  const [questionText, setQuestionText] = useState('')
  const [questionTextKo, setQuestionTextKo] = useState('')
  const [questionImageUrl, setQuestionImageUrl] = useState<string | null>(null)

  // 지문 (읽기)
  const [passage, setPassage] = useState('')
  const [passageImageUrl, setPassageImageUrl] = useState<string | null>(null)

  // 오디오 (듣기)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioScript, setAudioScript] = useState('')

  // 선택지
  const [options, setOptions] = useState(['', '', '', ''])
  const [optionImages, setOptionImages] = useState<(string | null)[]>([null, null, null, null])
  const [correctAnswer, setCorrectAnswer] = useState('')

  // 서술형
  const [wordLimit, setWordLimit] = useState(200)

  // 해설
  const [explanation, setExplanation] = useState('')

  // AI 분석
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null)
  const [aiError, setAiError] = useState('')
  const [analyzing, startAnalysis] = useTransition()

  const updateOption = (i: number, val: string) => {
    const next = [...options]; next[i] = val; setOptions(next)
  }
  const updateOptionImage = (i: number, url: string | null) => {
    const next = [...optionImages]; next[i] = url; setOptionImages(next)
  }

  const handleAnalyze = useCallback(() => {
    setAiError('')
    setAiResult(null)
    startAnalysis(async () => {
      const res = await analyzeQuestionWithAI(questionText, domain)
      if (res.error) { setAiError(res.error); return }
      if (res.result) setAiResult(res.result)
    })
  }, [questionText, domain])

  function handleApplyAI() {
    if (!aiResult) return
    setDomain(aiResult.domain as DomainType)
    setCefrLevel(aiResult.cefrLevel)
    setDifficulty(aiResult.difficulty)
    if (aiResult.subCategory) setSubCategory(aiResult.subCategory)
  }

  function buildContentJson(): QuestionContentJson {
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

  function handleSubmit() {
    if (!questionText.trim()) { setError('문제 본문을 입력해주세요.'); return }
    if (domain === 'LISTENING' && !audioUrl) { setError('음성 파일을 업로드해주세요.'); return }
    if (qType !== 'essay' && !correctAnswer.trim()) { setError('정답을 입력해주세요.'); return }
    setError('')
    const payload: CreateQuestionPayload = {
      domain: domain as QuestionDomain,
      difficulty,
      cefrLevel,
      subCategory: subCategory.trim() || null,
      contentJson: buildContentJson(),
    }
    startTransition(async () => {
      const res = await createQuestion(payload)
      if (res.error) { setError(res.error); return }
      onCreated()
    })
  }

  const domainColor = DOMAIN_COLOR[domain]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-sm flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">새 공용 문제 출제</h2>
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
                <StyledSelect value={domain} onChange={(v) => setDomain(v as DomainType)} className="w-full">
                  <option value="GRAMMAR">문법 (Grammar)</option>
                  <option value="VOCABULARY">어휘 (Vocabulary)</option>
                  <option value="READING">읽기 (Reading)</option>
                  <option value="WRITING">쓰기 (Writing)</option>
                  <option value="LISTENING">듣기 (Listening)</option>
                </StyledSelect>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CEFR 수준</label>
                <StyledSelect
                  value={cefrLevel}
                  onChange={(v) => {
                    setCefrLevel(v)
                    setDifficulty(CEFR_TO_DIFFICULTY[v] ?? difficulty)
                  }}
                  className="w-full"
                >
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
                    max={10}
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                    className="w-full accent-primary-700"
                  />
                  <span className="text-sm font-bold text-gray-700 w-4">{difficulty}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 듣기: 음성 파일 */}
          {domain === 'LISTENING' && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Volume2 size={14} /> 음성 파일
              </h3>
              <AudioUploadField audioUrl={audioUrl} onChange={setAudioUrl} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">스크립트 (선택)</label>
                <StyledTextarea
                  value={audioScript}
                  onChange={setAudioScript}
                  placeholder="오디오 스크립트/대본을 입력하세요 (학생에게 숨김)..."
                  rows={4}
                />
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
                  type="button"
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

          {/* 지문 (읽기) */}
          {domain === 'READING' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지문 (선택)</label>
              <StyledTextarea
                value={passage}
                onChange={setPassage}
                placeholder="읽기 지문을 입력하세요..."
                rows={5}
              />
              <ImageUploadField imageUrl={passageImageUrl} onChange={setPassageImageUrl} label="지문 이미지 추가" />
            </div>
          )}

          {/* 문제 본문 + AI 분석 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              문제 본문 <span className="text-[#D92916]">*</span>
            </label>
            {qType === 'fill_blank' && (
              <p className="text-xs text-gray-400 mb-1">빈칸은 ____로 표시하세요 (예: I ____ to school.)</p>
            )}
            <StyledTextarea
              value={questionText}
              onChange={setQuestionText}
              placeholder="문제를 입력하세요..."
              rows={3}
            />
            <ImageUploadField imageUrl={questionImageUrl} onChange={setQuestionImageUrl} label="문제 이미지 추가" />

            {/* AI 분석 버튼 */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={questionText.trim().length < 10 || analyzing}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg border border-purple-200 transition-colors"
            >
              {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {analyzing ? 'AI 분석 중...' : 'AI 분석 및 추천 (CEFR · 난이도 · 카테고리)'}
            </button>

            {/* AI 추천 결과 */}
            {aiError && <p className="mt-2 text-xs text-[#D92916]">{aiError}</p>}
            {aiResult && (
              <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700">AI 추천 결과</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyAI}
                    className="flex items-center gap-1 text-xs font-medium text-purple-700 bg-white border border-purple-300 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <CheckCircle2 size={11} />
                    전체 적용
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                    style={{ background: DOMAIN_COLOR[aiResult.domain as DomainType] ?? '#999' }}
                  >
                    {aiResult.domain}
                  </span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white border border-purple-200 text-purple-700">
                    CEFR: {aiResult.cefrLevel}
                  </span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white border border-purple-200 text-purple-700">
                    난이도 Lv{aiResult.difficulty}
                  </span>
                  {aiResult.subCategory && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white border border-purple-200 text-purple-700">
                      {aiResult.subCategory}
                    </span>
                  )}
                </div>
                <p className="text-xs text-purple-600 leading-relaxed">{aiResult.rationale}</p>
              </div>
            )}
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
                      <ImageUploadField
                        imageUrl={optionImages[i]}
                        onChange={(url) => updateOptionImage(i, url)}
                        label={`선택지 ${label} 이미지`}
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
                  type="range"
                  min={50}
                  max={500}
                  step={50}
                  value={wordLimit}
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
            <StyledTextarea
              value={explanation}
              onChange={setExplanation}
              placeholder="정답에 대한 해설을 입력하세요..."
              rows={3}
            />
          </div>

          <div className="h-1 rounded-full w-full" style={{ backgroundColor: domainColor }} />
          {error && <p className="text-sm text-[#D92916] font-medium">{error}</p>}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isPending}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            style={{ backgroundColor: domainColor, borderColor: domainColor }}
          >
            {isPending ? '저장 중...' : '문제 추가'}
          </Button>
        </div>
      </div>
    </div>
  )
}
