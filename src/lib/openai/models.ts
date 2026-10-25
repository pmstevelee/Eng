// OpenAI 모델 설정 — 환경변수로 교체 가능, 미설정 시 기본값 사용
// 운영(Vercel)에서 바꾼 경우 재배포해야 반영된다.

/** 기본 텍스트 모델 (채점·문제 생성·리포트·단어 보강 등) */
export const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

/**
 * 관리자 콘텐츠 제작용 모델 (문법 개념 정리·원고 분석·강의 스크립트).
 * 학생 수만큼 반복 호출되지 않으므로 더 좋은 모델을 따로 지정할 수 있다. 미설정 시 AI_MODEL.
 */
export const AI_CONTENT_MODEL = process.env.OPENAI_CONTENT_MODEL || AI_MODEL

/** 이미지 입력이 필요한 요청용 모델 (지문 이미지가 있는 유사문제 생성) */
export const AI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o'

/**
 * 추론형 모델(gpt-5·o 계열)인지. 이 모델들은 max_tokens·temperature(기본값 외)를 거부(400)하고
 * 출력 한도 안에 추론 토큰까지 쓰므로 요청 파라미터를 다르게 줘야 한다.
 */
export function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/.test(model) && !model.includes('chat')
}

/**
 * 모델에 맞는 출력 길이·온도 파라미터.
 * max_tokens는 추론형 모델에서 거부되므로 모든 모델이 받는 max_completion_tokens를 쓴다.
 */
export function completionParams(
  model: string,
  opts: { maxTokens: number; temperature?: number },
): { max_completion_tokens: number; temperature?: number; reasoning_effort?: 'minimal' } {
  if (isReasoningModel(model)) {
    // 추론 토큰 몫을 더해 출력이 잘리지 않게 하고, 단순 생성 작업이라 추론은 최소로
    return { max_completion_tokens: opts.maxTokens + 2000, reasoning_effort: 'minimal' }
  }
  return {
    max_completion_tokens: opts.maxTokens,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  }
}

/** 설정한 모델이 요청을 거부(400·404)할 때 한 번 더 시도할 기본 모델 */
export const AI_FALLBACK_MODEL = 'gpt-4o-mini'
