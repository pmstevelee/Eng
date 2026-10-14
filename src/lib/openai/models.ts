// OpenAI 모델 설정 — 환경변수로 교체 가능, 미설정 시 기본값 사용
// 운영(Vercel)에서 바꾼 경우 재배포해야 반영된다.

/** 기본 텍스트 모델 (채점·문제 생성·리포트·단어 보강 등) */
export const AI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

/** 이미지 입력이 필요한 요청용 모델 (지문 이미지가 있는 유사문제 생성) */
export const AI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o'
