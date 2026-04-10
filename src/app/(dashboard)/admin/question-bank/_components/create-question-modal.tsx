'use client'

import { useState, useTransition } from 'react'
import { Loader2, Sparkles, CheckCircle2, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createQuestion, analyzeQuestionWithAI } from '../actions'
import type { CreateQuestionPayload, AIAnalysisResult } from '../actions'
import type { QuestionDomain } from '@/generated/prisma'

// ── 상수 ─────────────────────────────────────────────────────────────────────

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
  LISTENING: '#1FAF54',
}

const CEFR_LEVELS = [
  'Pre-A1', 'A1 하', 'A1 상', 'A2 하', 'A2 상',
  'B1 하', 'B1 상', 'B2 하', 'B2 상', 'C1+',
]

const CEFR_TO_DIFFICULTY: Record<string, number> = {
  'Pre-A1': 1, 'A1 하': 2, 'A1 상': 3, 'A2 하': 4, 'A2 상': 5,
  'B1 하': 6, 'B1 상': 7, 'B2 하': 8, 'B2 상': 9, 'C1+': 10,
}

const DIFFICULTY_TO_CEFR: Record<number, string> = {
  1: 'Pre-A1', 2: 'A1 하', 3: 'A1 상', 4: 'A2 하', 5: 'A2 상',
  6: 'B1 하', 7: 'B1 상', 8: 'B2 하', 9: 'B2 상', 10: 'C1+',
}

const ANSWER_LETTERS = ['A', 'B', 'C', 'D']

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

type Props = {
  onClose: () => void
  onCreated: () => void
}

export default function CreateQuestionModal({ onClose, onCreated }: Props) {
  // 폼 상태
  const [domain, setDomain] = useState<QuestionDomain>('GRAMMAR')
  const [subCategory, setSubCategory] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctAnswer, setCorrectAnswer] = useState('A')
  const [explanation, setExplanation] = useState('')
  const [cefrLevel, setCefrLevel] = useState('A1 하')
  const [difficulty, setDifficulty] = useState(2)
  const [audioUrl, setAudioUrl] = useState('')

  // AI 분석 상태
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null)
  const [aiError, setAiError] = useState('')
  const [analyzing, startAnalysis] = useTransition()
  const [saving, startSave] = useTransition()
  const [saveError, setSaveError] = useState('')

  function handleOptionChange(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)))
  }

  function handleCefrChange(level: string) {
    setCefrLevel(level)
    setDifficulty(CEFR_TO_DIFFICULTY[level] ?? 1)
  }

  function handleDifficultyChange(diff: number) {
    setDifficulty(diff)
    setCefrLevel(DIFFICULTY_TO_CEFR[diff] ?? 'A1 하')
  }

  function handleApplyAI() {
    if (!aiResult) return
    setDomain(aiResult.domain)
    setCefrLevel(aiResult.cefrLevel)
    setDifficulty(aiResult.difficulty)
    if (aiResult.subCategory) setSubCategory(aiResult.subCategory)
  }

  function handleAnalyze() {
    setAiError('')
    setAiResult(null)
    startAnalysis(async () => {
      const res = await analyzeQuestionWithAI(questionText, domain)
      if (res.error) {
        setAiError(res.error)
        return
      }
      if (res.result) setAiResult(res.result)
    })
  }

  function handleSave() {
    setSaveError('')
    const filledOptions = options.filter((o) => o.trim())
    const payload: CreateQuestionPayload = {
      domain,
      difficulty,
      cefrLevel,
      subCategory: subCategory.trim() || null,
      questionText: questionText.trim(),
      options: filledOptions,
      correctAnswer,
      explanation: explanation.trim(),
      audioUrl: audioUrl.trim() || null,
    }
    startSave(async () => {
      const res = await createQuestion(payload)
      if (res.error) {
        setSaveError(res.error)
        return
      }
      onCreated()
    })
  }

  const canAnalyze = questionText.trim().length > 10
  const canSave =
    questionText.trim().length > 0 &&
    options.filter((o) => o.trim()).length >= 2 &&
    !!correctAnswer

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-gray-900">새 공용 문제 출제</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 영역 + 세부 카테고리 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                영역
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as QuestionDomain)}
                className="mt-1 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white"
              >
                {Object.entries(DOMAIN_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                세부 카테고리
              </label>
              <Input
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                placeholder="예: 시제, 관계사, 주제 파악..."
                className="mt-1 h-10 text-sm"
              />
            </div>
          </div>

          {/* 문제 텍스트 + AI 분석 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              문제 텍스트
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={4}
              placeholder="문제를 입력하세요..."
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            />
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze || analyzing}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg border border-purple-200 transition-colors"
            >
              {analyzing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {analyzing ? 'AI 분석 중...' : 'AI 분석 및 추천'}
            </button>
          </div>

          {/* AI 추천 결과 */}
          {aiError && <p className="text-xs text-red-500">{aiError}</p>}
          {aiResult && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-purple-600" />
                  <span className="text-xs font-semibold text-purple-700">AI 추천 결과</span>
                </div>
                <button
                  onClick={handleApplyAI}
                  className="flex items-center gap-1 text-xs font-medium text-purple-700 bg-white border border-purple-300 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <CheckCircle2 size={11} />
                  전체 적용
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ background: DOMAIN_COLOR[aiResult.domain] }}
                >
                  {DOMAIN_LABEL[aiResult.domain]}
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

          {/* 오디오 URL (듣기 영역) */}
          {domain === 'LISTENING' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Volume2 size={12} /> 오디오 URL
              </label>
              <Input
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="오디오 파일 URL..."
                className="mt-1 h-10 text-sm"
              />
            </div>
          )}

          {/* 보기 (클릭으로 정답 선택) */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              보기
            </label>
            <div className="mt-2 space-y-2">
              {options.map((opt, idx) => {
                const letter = ANSWER_LETTERS[idx]
                const isCorrect = correctAnswer === letter
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectAnswer(letter)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isCorrect
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      title="클릭하여 정답으로 설정"
                    >
                      {letter}
                    </button>
                    <input
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`보기 ${letter}`}
                      className="flex-1 h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                )
              })}
            </div>
            <p className="mt-1 text-xs text-gray-400">보기 번호를 클릭하면 정답으로 설정됩니다.</p>
          </div>

          {/* CEFR + 난이도 (상호 연동) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                CEFR 레벨
              </label>
              <select
                value={cefrLevel}
                onChange={(e) => handleCefrChange(e.target.value)}
                className="mt-1 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white"
              >
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                난이도
              </label>
              <select
                value={difficulty}
                onChange={(e) => handleDifficultyChange(Number(e.target.value))}
                className="mt-1 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white"
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Lv{i + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 해설 */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              해설
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={3}
              placeholder="한국어 해설을 입력하세요..."
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            />
          </div>

          {/* 저장 버튼 */}
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
            {saveError && <p className="text-xs text-red-500 mr-auto">{saveError}</p>}
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              취소
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : '문제 저장'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
