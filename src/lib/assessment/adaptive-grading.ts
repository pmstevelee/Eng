import 'server-only'

// 적응형 레벨 테스트 채점·기록 헬퍼
// 학생 응시(student/tests/[sessionId]/adaptive-actions.ts)와 비회원 응시(lib/placement)가 함께 사용한다.
// ('use server' 파일에서 export하면 공개 서버 액션이 되므로 별도 server-only 모듈로 분리)

import type { QuestionContentJson } from '@/components/shared/question-bank-client'
import { getWritingPromptByLevel, type QuestionHistoryItem } from '@/lib/assessment/adaptive-test-engine'
import { isAnswerMatch } from '@/lib/assessment/answer-checker'
import {
  buildWritingGradingResponseFormat,
  buildWritingGradingSystemPrompt,
  buildWritingGradingUserPrompt,
  countWords,
  normalizeWritingGradingReport,
  type WritingGradingReport,
} from '@/lib/ai/writing-grading'
import { scoreToLevel, LEVEL_TO_CEFR } from '@/lib/constants/levels'
import { recordLevelTestUsage } from '@/lib/questions/usage-tracker'
import { updateQuestionQuality } from '@/lib/questions/quality-updater'
import { trackAiUsage } from '@/lib/usage/tracker'

/**
 * 객관식·단답형 문항 서버 채점.
 * essay 등 자동 채점 대상이 아니면 null.
 */
export function gradeAdaptiveResponse(content: QuestionContentJson, answer: string): boolean | null {
  if (content.type === 'essay') {
    return null // AI가 별도 채점
  } else if (content.type === 'word_bank' && content.sentences) {
    try {
      const studentAnswers: Record<string, string> = JSON.parse(answer)
      return content.sentences.every(
        (s) =>
          (studentAnswers[s.label] ?? '').toLowerCase().trim() ===
          s.correct_answer.toLowerCase().trim(),
      )
    } catch {
      return false
    }
  } else if (content.type === 'question_set' && content.sub_questions) {
    try {
      const studentAnswers: Record<string, string> = JSON.parse(answer)
      return content.sub_questions.every(
        (sq) =>
          (studentAnswers[sq.label] ?? '').toUpperCase().trim() ===
          sq.correct_answer.toUpperCase().trim(),
      )
    } catch {
      return false
    }
  } else if (content.correct_answer) {
    // multiple_choice, fill_blank, short_answer, reading_comprehension 등 모두 동일하게 채점
    return isAnswerMatch(answer, content.correct_answer, content.options)
  }
  return null
}

/**
 * 적응형 테스트 쓰기 답안을 AI(GPT-4o-mini)로 채점해 쓰기 레벨을 산출한다.
 * - 여러 개의 쓰기 답안은 각각 채점 후 overallScore 평균 → scoreToLevel로 변환
 * - AI 실패/키 미설정 시 null 반환 → 호출부에서 통계적 추정값으로 폴백
 * - 사용량은 best-effort로만 기록(레벨 테스트 완료를 한도로 막지 않음)
 */
export async function gradeAdaptiveWriting(
  writingAnswers: string[],
  estimatedLevel: number,
  academyId: string,
): Promise<{ level: number; score: number; reports: WritingGradingReport[] } | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const essays = writingAnswers.filter((a) => a && a.trim().length > 0)
  if (essays.length === 0) return null

  const level = Math.max(1, Math.min(10, estimatedLevel))
  const cefrLevel = LEVEL_TO_CEFR[level] ?? 'A2 하'
  const promptInfo = getWritingPromptByLevel(level)

  const graded = await Promise.all(
    essays.map(async (essay) => {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: buildWritingGradingSystemPrompt() },
              {
                role: 'user',
                content: buildWritingGradingUserPrompt({
                  cefrLevel,
                  writingPrompt: promptInfo.prompt,
                  targetWordCount: null,
                  studentSubmission: essay,
                }),
              },
            ],
            response_format: buildWritingGradingResponseFormat(),
            temperature: 0.3,
          }),
        })
        if (!response.ok) return null
        const data = (await response.json()) as {
          choices: Array<{ message: { content: string } }>
        }
        const content = data.choices[0]?.message?.content
        if (!content) return null
        // AI가 배점 합계/오류 없음 표시 등 프롬프트 지시를 어길 수 있으므로 서버에서 재검증한다.
        return normalizeWritingGradingReport(JSON.parse(content) as WritingGradingReport, countWords(essay))
      } catch {
        return null
      }
    }),
  )

  const reports = graded.filter((r): r is WritingGradingReport => r !== null)
  if (reports.length === 0) return null

  const avgScore = Math.round(
    reports.reduce((s, r) => s + (r.overallScore ?? 0), 0) / reports.length,
  )

  // 사용량 기록 (비차단)
  for (let i = 0; i < reports.length; i++) {
    trackAiUsage(academyId, 'WRITING').catch(() => {})
  }

  return { level: scoreToLevel(avgScore), score: avgScore, reports }
}

/**
 * 출제된 문제의 사용 이력 기록 + 품질 통계 갱신 (비동기, 응답 지연 없음)
 * - question_usage_log: 학원별 1년 중복 방지에 사용
 * - usageCount/qualityScore: 문제 선택 시 순환·품질 판단에 사용
 */
export function recordAdaptiveUsage(
  academyId: string,
  testId: string,
  history: QuestionHistoryItem[],
): void {
  const questionIds = Array.from(new Set(history.map((h) => h.questionId)))
  recordLevelTestUsage(academyId, testId, questionIds).catch((err) =>
    console.error('[adaptive] 사용 이력 기록 실패:', err),
  )
  for (const qId of questionIds) {
    updateQuestionQuality(qId).catch(console.error)
  }
}
