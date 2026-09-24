// 학부모 알림 템플릿 정의 (templateKey · 변수 · 문구)
// - 알림톡은 카카오 검수를 통과한 문구·변수와 "정확히" 일치해야 발송된다.
//   문구를 바꾸면 docs/alimtalk-templates.md 와 카카오 템플릿도 함께 재검수할 것.
// - 알림톡 템플릿 ID가 설정되지 않은 경우 같은 문구를 SMS/LMS로 보낸다.

export type TemplateKey =
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_REMINDER'
  | 'PLACEMENT_TEST_LINK'
  | 'PLACEMENT_TEST_RESULT'

type TemplateDef<V extends string> = {
  label: string
  /** 템플릿 ID를 읽을 환경변수 이름 */
  templateIdEnv: string
  variables: readonly V[]
  /** #{변수} 치환 전 원문 (카카오 검수 문구와 동일) */
  body: string
}

export const NOTIFICATION_TEMPLATES = {
  APPOINTMENT_CONFIRMED: {
    label: '상담 예약 확정',
    templateIdEnv: 'SOLAPI_TEMPLATE_APPOINTMENT_CONFIRMED',
    variables: ['학원명', '학생명', '일시', '학원연락처'],
    body: [
      '[#{학원명}] 상담 예약 안내',
      '',
      '안녕하세요, #{학원명}입니다.',
      '#{학생명} 학생의 상담 예약이 확정되었습니다.',
      '',
      '■ 일시: #{일시}',
      '',
      '일정 변경이 필요하시면 아래 번호로 연락 부탁드립니다.',
      '☎ #{학원연락처}',
    ].join('\n'),
  },
  APPOINTMENT_REMINDER: {
    label: '상담 전날 리마인드',
    templateIdEnv: 'SOLAPI_TEMPLATE_APPOINTMENT_REMINDER',
    variables: ['학원명', '학생명', '일시'],
    body: [
      '[#{학원명}] 상담 일정 안내',
      '',
      '안녕하세요, #{학원명}입니다.',
      '내일 예정된 #{학생명} 학생의 상담 일정을 안내드립니다.',
      '',
      '■ 일시: #{일시}',
      '',
      '변동 사항이 있으시면 학원으로 연락 부탁드립니다.',
    ].join('\n'),
  },
  PLACEMENT_TEST_LINK: {
    label: '레벨테스트 안내',
    templateIdEnv: 'SOLAPI_TEMPLATE_PLACEMENT_TEST_LINK',
    variables: ['학원명', '학생명', '응시링크', '마감일'],
    body: [
      '[#{학원명}] 레벨테스트 안내',
      '',
      '안녕하세요, #{학원명}입니다.',
      '#{학생명} 학생의 영어 레벨테스트 응시 링크를 보내드립니다.',
      '',
      '■ 응시 링크: #{응시링크}',
      '■ 응시 마감: #{마감일}',
      '',
      '약 30~40분이 소요되니 조용한 환경에서 응시해 주세요.',
    ].join('\n'),
  },
  PLACEMENT_TEST_RESULT: {
    label: '레벨테스트 결과 안내',
    templateIdEnv: 'SOLAPI_TEMPLATE_PLACEMENT_TEST_RESULT',
    variables: ['학원명', '학생명', '결과링크'],
    body: [
      '[#{학원명}] 레벨테스트 결과 안내',
      '',
      '안녕하세요, #{학원명}입니다.',
      '#{학생명} 학생의 레벨테스트 결과 리포트를 보내드립니다.',
      '',
      '■ 결과 보기: #{결과링크}',
      '',
      '결과에 대해 궁금하신 점은 학원으로 문의해 주세요.',
    ].join('\n'),
  },
} as const satisfies Record<TemplateKey, TemplateDef<string>>

export type TemplateVariables<K extends TemplateKey> = Record<
  (typeof NOTIFICATION_TEMPLATES)[K]['variables'][number],
  string
>

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  APPOINTMENT_CONFIRMED: NOTIFICATION_TEMPLATES.APPOINTMENT_CONFIRMED.label,
  APPOINTMENT_REMINDER: NOTIFICATION_TEMPLATES.APPOINTMENT_REMINDER.label,
  PLACEMENT_TEST_LINK: NOTIFICATION_TEMPLATES.PLACEMENT_TEST_LINK.label,
  PLACEMENT_TEST_RESULT: NOTIFICATION_TEMPLATES.PLACEMENT_TEST_RESULT.label,
}

export function isTemplateKey(v: string): v is TemplateKey {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_TEMPLATES, v)
}

/** #{변수} 치환 */
export function renderTemplate(key: TemplateKey, variables: Record<string, string>): string {
  return NOTIFICATION_TEMPLATES[key].body.replace(/#\{([^}]+)\}/g, (m, name: string) => variables[name] ?? m)
}

/** SOLAPI kakaoOptions.variables 형식: { "#{변수}": "값" } */
export function toKakaoVariables(key: TemplateKey, variables: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const name of NOTIFICATION_TEMPLATES[key].variables) result[`#{${name}}`] = variables[name] ?? ''
  return result
}
