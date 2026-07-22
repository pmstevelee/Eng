'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { Volume2, ChevronLeft, ChevronRight, RotateCcw, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LoadingOverlay } from '@/components/shared/loading-overlay'
import { recordProgress } from '@/app/(dashboard)/student/words/_actions'
import { speakEnglish } from '@/lib/words/speech'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface WordCard {
  word: {
    id: string
    term: string
    meaning: string
    definition: string | null
    partOfSpeech: string | null
    example: string | null
    audioUrl: string | null
    cefrLevel: number
  }
  progress: { id: string; stage: string }
  order: number
}

interface Props {
  setId: string
  initialCards: WordCard[]
  totalWords: number
  masteredWords: number
}

// ─── 단일 플래시카드 ──────────────────────────────────────────────────────────

function FlashCard({
  card,
  onKnow,
  onUnknow,
  isAnimating,
}: {
  card: WordCard
  onKnow: () => void
  onUnknow: () => void
  isAnimating: boolean
}) {
  const [isFlipped, setIsFlipped] = useState(false)
  const dragX = useMotionValue(0)
  const dragOpacity = useTransform(dragX, [-120, 0, 120], [0.4, 1, 0.4])
  const dragRotate = useTransform(dragX, [-200, 0, 200], [-15, 0, 15])
  const knowBg = useTransform(dragX, [0, 120], ['rgba(126,84,247,0)', 'rgba(126,84,247,0.15)'])
  const unknowBg = useTransform(dragX, [-120, 0], ['rgba(217,41,22,0.15)', 'rgba(217,41,22,0)'])

  // 카드가 바뀌면 앞면으로 초기화
  useEffect(() => {
    setIsFlipped(false)
    dragX.set(0)
  }, [card.word.id, dragX])

  function speak() {
    void speakEnglish(card.word.term)
  }

  function flip() {
    if (!isAnimating) setIsFlipped((f) => !f)
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (isAnimating) return
    if (info.offset.x > 80) onKnow()
    else if (info.offset.x < -80) onUnknow()
    else animate(dragX, 0, { type: 'spring', stiffness: 300, damping: 30 })
  }

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      {/* 스와이프 힌트 배경 */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none z-10"
        style={{ background: knowBg }}
      />
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none z-10"
        style={{ background: unknowBg }}
      />

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        style={{ x: dragX, opacity: dragOpacity, rotate: dragRotate }}
        onDragEnd={handleDragEnd}
        className="cursor-grab active:cursor-grabbing"
      >
        <div
          className="relative"
          style={{ perspective: 1000 }}
          onClick={flip}
          onKeyDown={(e) => { if (e.key === 'Enter') flip() }}
          role="button"
          tabIndex={0}
          aria-label={isFlipped ? '카드 앞면으로 돌아가기' : '카드 뒤집기 (뜻 보기)'}
        >
          <motion.div
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            className="relative w-full"
          >
            {/* 앞면 */}
            <Card
              className="w-full border border-[#7854F7]/20 bg-white dark:bg-gray-900 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 shadow-sm"
              style={{
                backfaceVisibility: 'hidden',
                aspectRatio: '3/4',
                minHeight: 360,
              }}
            >
              {card.word.partOfSpeech && (
                <span className="text-xs font-medium text-[#7854F7] bg-[#7854F7]/10 px-3 py-1 rounded-full">
                  {card.word.partOfSpeech}
                </span>
              )}
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white text-center leading-tight">
                {card.word.term}
              </h2>
              <button
                onClick={(e) => { e.stopPropagation(); speak() }}
                aria-label="발음 듣기"
                className="p-2 rounded-full text-[#7854F7] hover:bg-[#7854F7]/10 transition-colors"
              >
                <Volume2 className="w-6 h-6" />
              </button>
              <p className="text-xs text-gray-400 mt-auto">탭하여 뜻 보기</p>
            </Card>

            {/* 뒷면 */}
            <Card
              className="absolute inset-0 w-full border border-[#7854F7]/20 bg-white dark:bg-gray-900 rounded-2xl p-8 flex flex-col items-start justify-center gap-3 shadow-sm overflow-auto"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                aspectRatio: '3/4',
                minHeight: 360,
              }}
            >
              <div className="w-full">
                <p className="text-xs font-medium text-[#7854F7] mb-1">한국어 뜻</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white leading-snug">
                  {card.word.meaning}
                </p>
              </div>
              {card.word.definition && (
                <div className="w-full">
                  <p className="text-xs font-medium text-gray-400 mb-1">영영 풀이</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {card.word.definition}
                  </p>
                </div>
              )}
              {card.word.example && (
                <div className="w-full border-l-2 border-[#7854F7]/30 pl-3 mt-1">
                  <p className="text-xs font-medium text-gray-400 mb-1">예문</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 italic leading-relaxed">
                    {card.word.example}
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── 라운드 종료 화면 ─────────────────────────────────────────────────────────

function RoundDone({
  unknownCards,
  setId,
  onRetry,
}: {
  unknownCards: WordCard[]
  setId: string
  onRetry: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <LoadingOverlay show={isPending} />
      <div className="w-16 h-16 rounded-full bg-[#7854F7]/10 flex items-center justify-center">
        <RotateCcw className="w-8 h-8 text-[#7854F7]" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          라운드 완료!
        </h2>
        {unknownCards.length > 0 ? (
          <p className="text-gray-500 text-sm">
            <span className="font-semibold text-[#D92916]">{unknownCards.length}개</span> 단어를 다시 학습할 수 있어요.
          </p>
        ) : (
          <p className="text-gray-500 text-sm">모든 단어를 알고 있어요! 🎉</p>
        )}
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {unknownCards.length > 0 && (
          <Button
            onClick={onRetry}
            disabled={isPending}
            variant="outline"
            className="h-14 border-[#7854F7] text-[#7854F7] hover:bg-[#7854F7]/5 rounded-xl"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            모르는 단어 다시 학습 ({unknownCards.length}개)
          </Button>
        )}
        <Button
          onClick={() => startTransition(() => router.push(`/student/words/${setId}/recall`))}
          disabled={isPending}
          className="h-14 bg-[#7854F7] hover:bg-[#7854F7]/90 text-white rounded-xl"
        >
          리콜 단계로
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => startTransition(() => router.push('/student/words'))}
          disabled={isPending}
          className="text-gray-500 h-10"
        >
          단어 허브로 돌아가기
        </Button>
      </div>
    </div>
  )
}

// ─── 메인 클라이언트 컴포넌트 ─────────────────────────────────────────────────

export function FlashcardClient({ setId, initialCards, totalWords, masteredWords: initialMastered }: Props) {
  const router = useRouter()
  const [isNavigating, startNavigating] = useTransition()
  const [deck, setDeck] = useState<WordCard[]>(initialCards)
  const [index, setIndex] = useState(0)
  const [unknownCards, setUnknownCards] = useState<WordCard[]>([])
  const [isDone, setIsDone] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [direction, setDirection] = useState(0)
  const [masteredWords, setMasteredWords] = useState(initialMastered)
  const pendingRef = useRef<Promise<unknown> | null>(null)

  const total = deck.length
  const current = deck[index]

  // 키보드 단축키
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isAnimating || isDone) return
      if (e.key === ' ' || e.key === 'Tab') { e.preventDefault(); advance(0) }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleKnow() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleUnknow() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnimating, isDone, index, deck])

  // 카드 기록 + 이동
  async function submitAndAdvance(quality: 2 | 4, know: boolean) {
    if (isAnimating || !current) return
    setIsAnimating(true)
    setDirection(know ? 1 : -1)

    if (!know) {
      setUnknownCards((prev) => [...prev, current])
    }

    // 낙관적 업데이트: 비동기 기록 (결과 기다리지 않음)
    pendingRef.current = recordProgress({
      wordId: current.word.id,
      stage: 'FLASHCARD',
      quality,
      isCorrect: know,
    })

    setTimeout(() => {
      const next = index + 1
      if (next >= total) {
        setIsDone(true)
      } else {
        setIndex(next)
      }
      setIsAnimating(false)
    }, 300)
  }

  // Tab/Space: 카드를 앞면 보여주는 것만 (플립은 카드 내부에서)
  function advance(_: number) {
    // no-op here; flip is handled inside FlashCard
  }

  const handleKnow = useCallback(() => submitAndAdvance(4, true), [index, current, isAnimating])
  const handleUnknow = useCallback(() => submitAndAdvance(2, false), [index, current, isAnimating])

  function handleRetry() {
    setDeck(unknownCards)
    setIndex(0)
    setUnknownCards([])
    setIsDone(false)
  }

  // 세트 전체 진행 표시 영역 (항상 렌더)
  const SetProgress = () => (
    <div className="mb-4 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500">세트 전체 학습 진행</span>
        <span className="text-xs font-semibold text-[#7854F7]">{masteredWords} / {totalWords} 마스터</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#1FAF54] rounded-full transition-all duration-500"
          style={{ width: totalWords > 0 ? `${(masteredWords / totalWords) * 100}%` : '0%' }}
        />
      </div>
    </div>
  )

  if (total === 0) {
    return (
      <div className="flex flex-col gap-4">
        <SetProgress />
        {masteredWords >= totalWords && totalWords > 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-[#1FAF54]/10 flex items-center justify-center">
              <span className="text-3xl">🎉</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">세트 완료!</h2>
            <p className="text-gray-500 text-sm">이 세트의 모든 단어를 마스터했습니다.</p>
            <Button
              onClick={() => startNavigating(() => router.push('/student/words'))}
              disabled={isNavigating}
              className="h-12 bg-[#7854F7] hover:bg-[#7854F7]/90 text-white rounded-xl px-8"
            >
              단어 허브로 돌아가기
            </Button>
            <LoadingOverlay show={isNavigating} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
            <p className="text-gray-500">현재 단계에서 학습할 단어가 없습니다.</p>
            <p className="text-xs text-gray-400">다음 단계(리콜/스펠)로 진행하거나 복습하세요.</p>
          </div>
        )}
      </div>
    )
  }

  if (isDone) {
    return (
      <div className="flex flex-col gap-4">
        <SetProgress />
        <RoundDone
          unknownCards={unknownCards}
          setId={setId}
          onRetry={handleRetry}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-[80vh] pb-8">
      {/* 세트 전체 진행 */}
      <SetProgress />

      {/* 현재 라운드 진행바 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-[#0C2340] dark:text-white">
            {index + 1} / {total}
          </span>
          <span className="text-xs text-gray-400">플래시카드</span>
        </div>
        <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#7854F7] rounded-full"
            initial={false}
            animate={{ width: `${((index + 1) / total) * 100}%` }}
            transition={{ ease: 'easeOut', duration: 0.3 }}
          />
        </div>
      </div>

      {/* 카드 영역 */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current?.word.id}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 60 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full"
          >
            {current && (
              <FlashCard
                card={current}
                onKnow={handleKnow}
                onUnknow={handleUnknow}
                isAnimating={isAnimating}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-3 mt-6">
        <Button
          onClick={handleUnknow}
          disabled={isAnimating}
          variant="outline"
          className="flex-1 h-14 rounded-xl border-[#D92916]/30 text-[#D92916] hover:bg-[#D92916]/5 font-semibold text-base"
          aria-label="모른다 (왼쪽 화살표)"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          모른다
        </Button>
        <Button
          onClick={handleKnow}
          disabled={isAnimating}
          className="flex-1 h-14 rounded-xl bg-[#7854F7] hover:bg-[#7854F7]/90 text-white font-semibold text-base"
          aria-label="안다 (오른쪽 화살표)"
        >
          안다
          <ChevronRight className="w-5 h-5 ml-1" />
        </Button>
      </div>

      {/* 키보드 힌트 */}
      <p className="text-center text-xs text-gray-400 mt-3">
        Space · Tab: 뒤집기 &nbsp;|&nbsp; ←: 모른다 &nbsp;|&nbsp; →: 안다
      </p>
    </div>
  )
}
