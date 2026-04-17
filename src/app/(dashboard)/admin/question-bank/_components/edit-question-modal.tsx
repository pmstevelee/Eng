'use client'

import { useState, useTransition, useRef } from 'react'
import {
  X,
  ImagePlus,
  Loader2,
  Volume2,
  Mic,
  Plus,
  Trash2,
} from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateQuestion } from '../actions'
import type { AdminQuestionRow, UpdateQuestionPayload, QuestionContentJson, WordBankSentence, SentenceOrderItem, SubQuestion } from '../actions'
import type { QuestionDomain } from '@/generated/prisma'

// ── 타입 ──────────────────────────────────────────────────────────────────────

type QuestionType = 'multiple_choice' | 'fill_blank' | 'short_answer' | 'essay' | 'word_bank' | 'question_set' | 'sentence_order'
type DomainType = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING' | 'LISTENING'

// UI 내에서 words를 string으로 관리 (저장 시 string[]로 변환)
type EditSentenceOrderItem = {
  label: string
  display_text: string
  words: string
  correct_answer: string
  image_url?: string | null
}

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

const TABS: { key: QuestionType; label: string }[] = [
  { key: 'multiple_choice', label: '객관식' },
  { key: 'fill_blank', label: '빈칸' },
  { key: 'short_answer', label: '단답형' },
  { key: 'essay', label: '서술형' },
  { key: 'word_bank', label: '단어박스' },
  { key: 'sentence_order', label: '순서맞추기' },
  { key: 'question_set', label: '복합 문제' },
]

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
  question: AdminQuestionRow
  onClose: () => void
  onSaved: (updated: AdminQuestionRow) => void
}

export default function EditQuestionModal({ question, onClose, onSaved }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // 기본 정보
  const [domain, setDomain] = useState<DomainType>(question.domain as DomainType)
  const [subCategory, setSubCategory] = useState(question.subCategory ?? '')
  const [difficulty, setDifficulty] = useState(question.difficulty)
  const [cefrLevel, setCefrLevel] = useState(
    question.cefrLevel ?? (CEFR_LEVELS.find((_, i) => i + 1 === question.difficulty) ?? 'A1 상')
  )

  // 문제 유형
  const [qType, setQType] = useState<QuestionType>(question.questionType as QuestionType)

  // 문제 내용
  const [questionText, setQuestionText] = useState(question.questionText)
  const [questionTextKo, setQuestionTextKo] = useState(question.questionTextKo ?? '')
  const [questionImageUrl, setQuestionImageUrl] = useState<string | null>(question.questionImageUrl)

  // 지문 (읽기)
  const [passage, setPassage] = useState(question.passage ?? '')
  const [passageImageUrl, setPassageImageUrl] = useState<string | null>(question.passageImageUrl)

  // 오디오 (듣기)
  const [audioUrl, setAudioUrl] = useState<string | null>(question.audioUrl)
  const [audioScript, setAudioScript] = useState(question.audioScript ?? '')

  // 선택지
  const [options, setOptions] = useState<string[]>(
    question.options.length > 0 ? [...question.options] : ['', '', '', '', '']
  )
  const [optionImages, setOptionImages] = useState<(string | null)[]>(
    question.optionImages.length > 0
      ? [...question.optionImages]
      : [null, null, null, null, null]
  )
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer)

  // 서술형
  const [wordLimit, setWordLimit] = useState(question.wordLimit ?? 200)

  // 단어박스형
  const [wordBankInput, setWordBankInput] = useState(
    question.wordBank.length > 0 ? question.wordBank.join(', ') : ''
  )
  const [sentences, setSentences] = useState<WordBankSentence[]>(
    question.sentences.length > 0
      ? question.sentences
      : [
          { label: 'a', text: '', correct_answer: '' },
          { label: 'b', text: '', correct_answer: '' },
          { label: 'c', text: '', correct_answer: '' },
        ]
  )

  // 복합 문제
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>(
    question.subQuestions.length > 0
      ? question.subQuestions
      : [
          { label: '1', question_text: '', options: ['', '', ''], option_images: [null, null, null], correct_answer: '' },
          { label: '2', question_text: '', options: ['', '', ''], option_images: [null, null, null], correct_answer: '' },
        ]
  )

  // 문장 순서 맞추기
  const [orderSentences, setOrderSentences] = useState<EditSentenceOrderItem[]>(
    question.orderSentences.length > 0
      ? question.orderSentences.map((s) => ({
          label: s.label,
          display_text: s.display_text,
          words: Array.isArray(s.words) ? s.words.join(', ') : String(s.words),
          correct_answer: s.correct_answer,
          image_url: s.image_url,
        }))
      : [{ label: 'A', display_text: '', words: '', correct_answer: '' }]
  )

  // 해설
  const [explanation, setExplanation] = useState(question.explanation)

  const updateOption = (i: number, val: string) => {
    const next = [...options]; next[i] = val; setOptions(next)
  }
  const updateOptionImage = (i: number, url: string | null) => {
    const next = [...optionImages]; next[i] = url; setOptionImages(next)
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
    if (qType === 'word_bank') {
      const wordBankArr = wordBankInput
        .split(/[,，\s]+/)
        .map((w) => w.trim())
        .filter(Boolean)
      const validSentences = sentences.filter((s) => s.text.trim())
      return { ...base, word_bank: wordBankArr, sentences: validSentences }
    }
    if (qType === 'sentence_order') {
      return {
        ...base,
        order_sentences: orderSentences
          .filter((item) => item.display_text.trim())
          .map((item) => ({
            label: item.label,
            display_text: item.display_text,
            words: item.words
              .split(/[,，\s]+/)
              .map((w) => w.trim())
              .filter(Boolean),
            correct_answer: item.correct_answer.trim(),
            image_url: item.image_url || undefined,
          })),
      }
    }
    if (qType === 'question_set') {
      return {
        ...base,
        audio_url: audioUrl || undefined,
        audio_script: audioScript || undefined,
        passage: passage || undefined,
        passage_image_url: passageImageUrl || undefined,
        sub_questions: subQuestions
          .filter((sq) => sq.question_text.trim())
          .map((sq) => ({
            label: sq.label,
            question_text: sq.question_text,
            options: sq.options,
            option_images: sq.option_images?.some((img) => img !== null) ? sq.option_images : undefined,
            correct_answer: sq.correct_answer,
          })),
      }
    }
    return {
      ...base,
      passage: passage || undefined,
      passage_image_url: passageImageUrl || undefined,
      word_limit: wordLimit,
    }
  }

  function handleSubmit() {
    if (!questionText.trim()) { setError('문제 본문을 입력해주세요.'); return }
    if (domain === 'LISTENING' && qType !== 'question_set' && !audioUrl) { setError('음성 파일을 업로드해주세요.'); return }
    if (qType === 'word_bank') {
      if (!wordBankInput.trim()) { setError('단어 박스에 단어를 입력해주세요.'); return }
      const validSentences = sentences.filter((s) => s.text.trim())
      if (validSentences.length === 0) { setError('문장을 최소 1개 이상 입력해주세요.'); return }
      if (validSentences.some((s) => !s.correct_answer.trim())) { setError('모든 문장의 정답을 입력해주세요.'); return }
    } else if (qType === 'sentence_order') {
      const validItems = orderSentences.filter((item) => item.display_text.trim())
      if (validItems.length === 0) { setError('문장을 최소 1개 이상 입력해주세요.'); return }
      if (validItems.some((item) => !item.words.trim())) { setError('모든 문장에 단어를 입력해주세요.'); return }
      if (validItems.some((item) => !item.correct_answer.trim())) { setError('모든 문장의 정답 순서를 입력해주세요.'); return }
    } else if (qType === 'question_set') {
      const validSubs = subQuestions.filter((sq) => sq.question_text.trim())
      if (validSubs.length === 0) { setError('소문제를 최소 1개 이상 입력해주세요.'); return }
      if (validSubs.some((sq) => !sq.correct_answer)) { setError('모든 소문제의 정답을 선택해주세요.'); return }
    } else if (qType !== 'essay' && !correctAnswer.trim()) { setError('정답을 입력해주세요.'); return }

    setError('')
    const payload: UpdateQuestionPayload = {
      domain: domain as QuestionDomain,
      difficulty,
      cefrLevel,
      subCategory: subCategory.trim() || null,
      contentJson: buildContentJson(),
    }
    startTransition(async () => {
      const res = await updateQuestion(question.id, payload)
      if (res.error) { setError(res.error); return }
      onSaved({
        ...question,
        domain: domain as QuestionDomain,
        difficulty,
        cefrLevel,
        subCategory: subCategory.trim() || null,
        questionType: qType,
        questionText,
        questionTextKo: questionTextKo || null,
        questionImageUrl,
        options: qType === 'multiple_choice' ? options : [],
        optionImages: qType === 'multiple_choice' ? optionImages : [],
        correctAnswer: qType === 'essay' ? '' : correctAnswer,
        explanation,
        audioUrl,
        audioScript: audioScript || null,
        passage: passage || null,
        passageImageUrl,
        wordBank: wordBankInput.split(/[,，\s]+/).map((w) => w.trim()).filter(Boolean),
        sentences,
        subQuestions,
        orderSentences: orderSentences.map((s) => ({
          ...s,
          words: s.words.split(/[,，\s]+/).map((w) => w.trim()).filter(Boolean),
        })),
        wordLimit,
      })
    })
  }

  const domainColor = DOMAIN_COLOR[domain]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-sm flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">공용 문제 수정</h2>
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

          {/* 문제 본문 */}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">선택지 (A~E)</label>
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

          {/* 단어박스형 */}
          {qType === 'word_bank' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  단어 박스 <span className="text-[#D92916]">*</span>
                </label>
                <p className="text-xs text-gray-400 mb-1">단어를 쉼표 또는 띄어쓰기로 구분해 입력하세요 (예: eat, freeze, wear)</p>
                <Input
                  value={wordBankInput}
                  onChange={(e) => setWordBankInput(e.target.value)}
                  placeholder="eat, freeze, wear, brush, shop, walk"
                />
                {wordBankInput.trim() && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {wordBankInput.split(/[,，\s]+/).filter(Boolean).map((w, i) => (
                      <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEF4FF] text-[#1865F2] border border-[#1865F2]/20">
                        {w.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    문장 목록 <span className="text-[#D92916]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextLabel = String.fromCharCode(97 + sentences.length)
                      setSentences([...sentences, { label: nextLabel, text: '', correct_answer: '' }])
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#1865F2] hover:text-blue-700"
                  >
                    <Plus size={13} />문장 추가
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-2">빈칸은 ____로 표시하세요 (예: I was ____ my teeth.)</p>
                <div className="space-y-3">
                  {sentences.map((s, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                          {s.label}
                        </span>
                        <Input
                          value={s.text}
                          onChange={(e) => {
                            const next = [...sentences]
                            next[i] = { ...next[i], text: e.target.value }
                            setSentences(next)
                          }}
                          placeholder="문장을 입력하세요 (예: I was ____ my teeth when my dad called.)"
                          className="flex-1"
                        />
                        {sentences.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSentences(sentences.filter((_, idx) => idx !== i))}
                            className="text-gray-300 hover:text-[#D92916] transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pl-8">
                        <span className="text-xs text-gray-500 shrink-0">정답:</span>
                        <Input
                          value={s.correct_answer}
                          onChange={(e) => {
                            const next = [...sentences]
                            next[i] = { ...next[i], correct_answer: e.target.value }
                            setSentences(next)
                          }}
                          placeholder="올바른 형태로 입력 (예: brushing)"
                          className="flex-1 h-9 text-sm"
                        />
                      </div>
                      <div className="pl-8">
                        <ImageUploadField
                          imageUrl={s.image_url ?? null}
                          onChange={(url) => {
                            const next = [...sentences]
                            next[i] = { ...next[i], image_url: url }
                            setSentences(next)
                          }}
                          label="힌트 이미지 추가 (선택)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 문장 순서 맞추기 */}
          {qType === 'sentence_order' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  문장 목록 <span className="text-[#D92916]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const nextLabel = String.fromCharCode(65 + orderSentences.length)
                    setOrderSentences([...orderSentences, { label: nextLabel, display_text: '', words: '', correct_answer: '' }])
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#1865F2] hover:text-blue-700"
                >
                  <Plus size={13} />문장 추가
                </button>
              </div>
              <p className="text-xs text-gray-400 -mt-2">
                표시 문장: 빈칸을 ___ 로 표시 | 단어: 쉼표로 구분 | 정답: 올바른 순서를 띄어쓰기로 구분
              </p>
              <div className="space-y-4">
                {orderSentences.map((item, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                        {item.label}
                      </span>
                      {orderSentences.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setOrderSentences(orderSentences.filter((_, idx) => idx !== i))}
                          className="text-gray-300 hover:text-[#D92916] transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">표시 문장 (빈칸 포함)</label>
                      <Input
                        value={item.display_text}
                        onChange={(e) => {
                          const next = [...orderSentences]
                          next[i] = { ...next[i], display_text: e.target.value }
                          setOrderSentences(next)
                        }}
                        placeholder="예: A: ___ ___ ___? / B: No, they aren't."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">단어 박스 (쉼표로 구분)</label>
                      <Input
                        value={item.words}
                        onChange={(e) => {
                          const next = [...orderSentences]
                          next[i] = { ...next[i], words: e.target.value }
                          setOrderSentences(next)
                        }}
                        placeholder="예: Are, those, melons"
                      />
                      {item.words.trim() && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {item.words.split(/[,，\s]+/).filter(Boolean).map((w, wi) => (
                            <span key={wi} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEF4FF] text-[#1865F2] border border-[#1865F2]/20">
                              {w.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">정답 순서 (띄어쓰기로 구분)</label>
                      <Input
                        value={item.correct_answer}
                        onChange={(e) => {
                          const next = [...orderSentences]
                          next[i] = { ...next[i], correct_answer: e.target.value }
                          setOrderSentences(next)
                        }}
                        placeholder="예: Are those melons"
                      />
                    </div>
                    <ImageUploadField
                      imageUrl={item.image_url ?? null}
                      onChange={(url) => {
                        const next = [...orderSentences]
                        next[i] = { ...next[i], image_url: url }
                        setOrderSentences(next)
                      }}
                      label="힌트 이미지 추가 (선택)"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 복합 문제 */}
          {qType === 'question_set' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <Volume2 size={14} /> 음성 파일 (선택 — 듣기 기반일 때)
                </label>
                <AudioUploadField audioUrl={audioUrl} onChange={setAudioUrl} />
                {audioUrl && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">스크립트 (선택)</label>
                    <StyledTextarea value={audioScript} onChange={setAudioScript} placeholder="오디오 스크립트를 입력하세요 (학생에게 숨김)..." rows={3} />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">지문 (선택 — 읽기/문법/어휘 기반일 때)</label>
                <StyledTextarea value={passage} onChange={setPassage} placeholder="공유 지문을 입력하세요..." rows={4} />
                <ImageUploadField imageUrl={passageImageUrl} onChange={setPassageImageUrl} label="지문 이미지 추가" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    소문제 목록 <span className="text-[#D92916]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSubQuestions([
                      ...subQuestions,
                      { label: String(subQuestions.length + 1), question_text: '', options: ['', '', ''], option_images: [null, null, null], correct_answer: '' },
                    ])}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#1865F2] hover:text-blue-700"
                  >
                    <Plus size={13} />소문제 추가
                  </button>
                </div>
                <div className="space-y-4">
                  {subQuestions.map((sq, qi) => (
                    <div key={qi} className="rounded-xl border border-gray-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-700">소문제 {sq.label}</span>
                        {subQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSubQuestions(subQuestions.filter((_, idx) => idx !== qi))}
                            className="text-gray-300 hover:text-[#D92916] transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      <Input
                        value={sq.question_text}
                        onChange={(e) => {
                          const next = [...subQuestions]
                          next[qi] = { ...next[qi], question_text: e.target.value }
                          setSubQuestions(next)
                        }}
                        placeholder="질문을 입력하세요"
                      />
                      <div className="space-y-2">
                        {sq.options.map((opt, oi) => {
                          const letter = String.fromCharCode(65 + oi)
                          const isCorrect = sq.correct_answer === letter
                          return (
                            <div key={oi} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...subQuestions]
                                  next[qi] = { ...next[qi], correct_answer: isCorrect ? '' : letter }
                                  setSubQuestions(next)
                                }}
                                className={`w-7 h-7 rounded-full text-xs font-bold border-2 shrink-0 transition-all ${
                                  isCorrect
                                    ? 'border-[#1FAF54] bg-[#1FAF54] text-white'
                                    : 'border-gray-200 text-gray-400 hover:border-[#1FAF54] hover:text-[#1FAF54]'
                                }`}
                                title="클릭하여 정답 선택"
                              >
                                {letter}
                              </button>
                              <Input
                                value={opt}
                                onChange={(e) => {
                                  const next = [...subQuestions]
                                  const newOpts = [...next[qi].options]
                                  newOpts[oi] = e.target.value
                                  next[qi] = { ...next[qi], options: newOpts }
                                  setSubQuestions(next)
                                }}
                                placeholder={`선택지 ${letter}`}
                                className="flex-1"
                              />
                              <ImageUploadField
                                imageUrl={sq.option_images?.[oi] ?? null}
                                onChange={(url) => {
                                  const next = [...subQuestions]
                                  const newImgs = [...(next[qi].option_images ?? [null, null, null])]
                                  newImgs[oi] = url
                                  next[qi] = { ...next[qi], option_images: newImgs }
                                  setSubQuestions(next)
                                }}
                                label=""
                              />
                            </div>
                          )
                        })}
                        <div className="flex gap-2 pt-1">
                          {sq.options.length < 5 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...subQuestions]
                                next[qi] = {
                                  ...next[qi],
                                  options: [...next[qi].options, ''],
                                  option_images: [...(next[qi].option_images ?? []), null],
                                }
                                setSubQuestions(next)
                              }}
                              className="text-xs text-gray-400 hover:text-[#1865F2]"
                            >
                              + 선택지 추가
                            </button>
                          )}
                          {sq.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...subQuestions]
                                next[qi] = {
                                  ...next[qi],
                                  options: next[qi].options.slice(0, -1),
                                  option_images: (next[qi].option_images ?? []).slice(0, -1),
                                }
                                setSubQuestions(next)
                              }}
                              className="text-xs text-gray-400 hover:text-[#D92916]"
                            >
                              - 선택지 제거
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {sq.correct_answer ? `정답: ${sq.correct_answer}` : '원 버튼을 클릭해 정답을 선택하세요.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
            {isPending ? <><Loader2 size={14} className="animate-spin mr-1.5" />저장 중...</> : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
