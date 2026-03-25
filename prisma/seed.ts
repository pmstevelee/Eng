/**
 * 개발 테스트용 시드 데이터 생성 스크립트
 * 실행: npm run db:seed  또는  npx prisma db seed
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '../src/generated/prisma'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const prisma = new PrismaClient()

// ─── 유틸 ──────────────────────────────────────────────────────────────────────
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const weightedStatus = () => {
  const r = Math.random()
  if (r < 0.70) return 'PRESENT'
  if (r < 0.85) return 'ABSENT'
  if (r < 0.95) return 'LATE'
  return 'EXCUSED'
}

function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function getLast30Weekdays(): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(9, 0, 0, 0)
  let d = new Date(today)
  while (dates.length < 30) {
    d = new Date(d.getTime() - 24 * 60 * 60 * 1000)
    if (isWeekday(d)) dates.push(new Date(d))
  }
  return dates
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

async function getOrCreateAuthUser(email: string, password: string): Promise<string> {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (!error && created.user) return created.user.id
  if (error?.message.includes('already') || error?.code === 'email_exists') {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
    const existing = list?.users.find((u) => u.email === email)
    if (existing) return existing.id
  }
  throw new Error(`Auth 생성 실패 (${email}): ${error?.message ?? '알 수 없는 오류'}`)
}

// ─── 요금제 ────────────────────────────────────────────────────────────────────
const SUBSCRIPTION_PLANS = [
  {
    name: 'BASIC',
    displayName: '베이직',
    monthlyPrice: 300000,
    yearlyPrice: 3000000,
    maxStudents: 50,
    maxTeachers: 3,
    featuresJson: { features: ['레벨 테스트', '학생 관리', '기본 리포트'] },
  },
  {
    name: 'STANDARD',
    displayName: '스탠다드',
    monthlyPrice: 500000,
    yearlyPrice: 5000000,
    maxStudents: 150,
    maxTeachers: 5,
    featuresJson: {
      features: ['레벨 테스트', '학생 관리', '상세 리포트', 'AI 분석', '출석 관리'],
    },
  },
  {
    name: 'PREMIUM',
    displayName: '프리미엄',
    monthlyPrice: 800000,
    yearlyPrice: 8000000,
    maxStudents: -1,
    maxTeachers: -1,
    featuresJson: {
      features: [
        '레벨 테스트',
        '학생 관리',
        '상세 리포트',
        'AI 분석',
        '출석 관리',
        '무제한 학생/교사',
        '커스텀 테스트',
        '우선 지원',
      ],
    },
  },
  {
    name: 'ENTERPRISE',
    displayName: '엔터프라이즈',
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxStudents: -1,
    maxTeachers: -1,
    featuresJson: {
      features: ['프리미엄 전체 기능', '전담 매니저', 'API 연동', '맞춤형 기능 개발', '별도 협의'],
    },
  },
]

// ─── 학원 ──────────────────────────────────────────────────────────────────────
const ACADEMY_DATA = {
  name: '해피잉글리시 어학원',
  businessName: '해피잉글리시 어학원',
  address: '서울시 강남구 역삼동 234-56 행복빌딩 3층',
  phone: '02-555-1234',
}

// ─── 학생 이름 ─────────────────────────────────────────────────────────────────
const STUDENT_NAMES = [
  '이서연', '김민서', '박준혁', '최유진', '정하은',
  '강현우', '윤소희', '임지훈', '한예린', '오준서',
  '신다은', '문현진', '양수빈', '배지원', '노은서',
  '심민재', '전채원', '송태양', '류하린', '고시온',
]

// ─── 사용자 정의 ───────────────────────────────────────────────────────────────
type UserDef = {
  email: string
  password: string
  name: string
  role: 'SUPER_ADMIN' | 'ACADEMY_OWNER' | 'TEACHER' | 'STUDENT'
  noAcademy?: boolean
}

const USER_DEFS: UserDef[] = [
  { email: 'admin@edulevel.com',    password: 'password123', name: '시스템관리자', role: 'SUPER_ADMIN',   noAcademy: true },
  { email: 'owner@happy-english.com', password: 'password123', name: '홍길동',    role: 'ACADEMY_OWNER' },
  { email: 'teacher1@happy-english.com', password: 'password123', name: '김지수', role: 'TEACHER' },
  { email: 'teacher2@happy-english.com', password: 'password123', name: '박민준', role: 'TEACHER' },
  ...STUDENT_NAMES.map((name, i) => ({
    email: `student${i + 1}@happy-english.com`,
    password: 'password123',
    name,
    role: 'STUDENT' as const,
  })),
]

// ─── 문제 뱅크 (80문제: 영역별 20문제) ───────────────────────────────────────────
type QuestionDef = {
  domain: 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING'
  subCategory: string
  difficulty: number
  cefrLevel: string
  contentJson: Record<string, unknown>
}

const QUESTIONS: QuestionDef[] = [
  // ══════════════════════════════════════════════════════════════════════════════
  // GRAMMAR (20문제)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    domain: 'GRAMMAR', subCategory: '현재 시제', difficulty: 1, cefrLevel: 'A1',
    contentJson: {
      type: 'mcq',
      question: 'She ___ to school every day.',
      options: ['A. goes', 'B. go', 'C. going', 'D. gone'],
      correctAnswer: 'A',
      explanation: '3인칭 단수 현재형에는 동사에 -s/-es를 붙입니다. She goes.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '관사', difficulty: 1, cefrLevel: 'A1',
    contentJson: {
      type: 'mcq',
      question: 'I saw ___ elephant at the zoo yesterday.',
      options: ['A. a', 'B. an', 'C. the', 'D. -'],
      correctAnswer: 'B',
      explanation: '"elephant"는 모음(e)으로 시작하므로 부정관사 "an"을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '비교급/최상급', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'This is ___ movie I have ever seen.',
      options: ['A. the most boring', 'B. more boring', 'C. most boring', 'D. the more boring'],
      correctAnswer: 'A',
      explanation: '최상급 앞에는 반드시 정관사 "the"가 옵니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '과거진행형', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'They ___ dinner when the phone rang.',
      options: ['A. were having', 'B. had', 'C. have had', 'D. are having'],
      correctAnswer: 'A',
      explanation: '과거의 특정 시점에 진행 중이던 동작은 과거진행형(was/were + -ing)으로 나타냅니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '주어-동사 수일치', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'The news ___ very shocking to everyone.',
      options: ['A. was', 'B. were', 'C. are', 'D. be'],
      correctAnswer: 'A',
      explanation: '"news"는 -s로 끝나지만 단수 명사이므로 단수 동사 "was"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '현재완료', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'I ___ never ___ sushi before. It was delicious!',
      options: ['A. have / tried', 'B. had / tried', 'C. have / try', 'D. did / try'],
      correctAnswer: 'A',
      explanation: '과거부터 현재까지의 경험을 나타낼 때 현재완료(have/has + p.p.)를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '수동태', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'The Eiffel Tower ___ in 1889.',
      options: ['A. was built', 'B. built', 'C. has built', 'D. is built'],
      correctAnswer: 'A',
      explanation: '과거의 수동 행위는 "was/were + 과거분사"로 나타냅니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '1종 가정법', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'If it rains tomorrow, we ___ the picnic.',
      options: ['A. will cancel', 'B. would cancel', 'C. cancel', 'D. cancelled'],
      correctAnswer: 'A',
      explanation: '1종 가정법(실현 가능한 조건): If + 현재형, will + 동사원형.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '간접화법', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'She said, "I am tired." → She said that she ___ tired.',
      options: ['A. was', 'B. is', 'C. were', 'D. be'],
      correctAnswer: 'A',
      explanation: '간접화법에서 주절이 과거형이면 종속절의 현재형은 과거형으로 바뀝니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '관계절', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'The teacher ___ taught me last year was very kind.',
      options: ['A. who', 'B. which', 'C. whose', 'D. whom'],
      correctAnswer: 'A',
      explanation: '사람을 선행사로 하는 주격 관계대명사는 "who"입니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '동명사/부정사', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'He decided ___ a new language.',
      options: ['A. to learn', 'B. learning', 'C. learn', 'D. learned'],
      correctAnswer: 'A',
      explanation: '"decide"는 목적어로 to부정사를 취합니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '조동사', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'You ___ be more careful. This is dangerous.',
      options: ['A. should', 'B. can', 'C. might', 'D. will'],
      correctAnswer: 'A',
      explanation: '"should"는 충고나 권유를 나타냅니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '2종 가정법', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: 'If I ___ more time, I would travel around the world.',
      options: ['A. had', 'B. have', 'C. would have', 'D. will have'],
      correctAnswer: 'A',
      explanation: '2종 가정법(반사실적 현재 조건): If + 과거형, would + 동사원형.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '3종 가정법', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: 'If she had left earlier, she ___ the train.',
      options: ['A. would have caught', 'B. would catch', 'C. had caught', 'D. caught'],
      correctAnswer: 'A',
      explanation: '3종 가정법(반사실적 과거): If + had + p.p., would have + p.p.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '현재완료 진행형', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: 'She ___ for this company for ten years.',
      options: ['A. has been working', 'B. is working', 'C. has worked', 'D. worked'],
      correctAnswer: 'A',
      explanation: '과거에 시작해 현재까지 계속되는 동작 강조에는 현재완료 진행형을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '도치구문', difficulty: 5, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: 'Not only ___ late, but he also forgot his homework.',
      options: ['A. was he', 'B. he was', 'C. is he', 'D. he is'],
      correctAnswer: 'A',
      explanation: '"Not only"가 문두에 올 때 주어와 동사가 도치됩니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '분사구문', difficulty: 5, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: '___ her homework, she went out to play.',
      options: ['A. Having finished', 'B. Finishing', 'C. Finished', 'D. To finish'],
      correctAnswer: 'A',
      explanation: '주절의 행동보다 먼저 일어난 행동을 분사구문으로 나타낼 때 "Having + p.p."를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '가산/불가산 명사', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'There is ___ milk in the fridge.',
      options: ['A. a little', 'B. a few', 'C. many', 'D. a couple of'],
      correctAnswer: 'A',
      explanation: '"milk"는 불가산 명사이므로 "a little"을 사용합니다. "a few"와 "many"는 가산 복수명사에 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '질문 부가의문문', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: "It's a beautiful day, ___ it?",
      options: ["A. isn't", 'B. is', "C. doesn't", "D. wasn't"],
      correctAnswer: 'A',
      explanation: '부가의문문은 주절이 긍정이면 부정형, 주절의 동사(be)에 맞춰 만듭니다.',
    },
  },
  {
    domain: 'GRAMMAR', subCategory: '전치사', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'My birthday is ___ March 15th.',
      options: ['A. on', 'B. in', 'C. at', 'D. by'],
      correctAnswer: 'A',
      explanation: '특정 날짜 앞에는 전치사 "on"을 사용합니다.',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // VOCABULARY (20문제)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    domain: 'VOCABULARY', subCategory: '동의어', difficulty: 1, cefrLevel: 'A1',
    contentJson: {
      type: 'mcq',
      question: 'Which word has the SAME meaning as "happy"?',
      options: ['A. joyful', 'B. angry', 'C. tired', 'D. cold'],
      correctAnswer: 'A',
      explanation: '"joyful" means very happy and pleased.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '반의어', difficulty: 1, cefrLevel: 'A1',
    contentJson: {
      type: 'mcq',
      question: 'Which word is the OPPOSITE of "ancient"?',
      options: ['A. modern', 'B. old', 'C. historical', 'D. famous'],
      correctAnswer: 'A',
      explanation: '"ancient" means very old. Its opposite is "modern," which means belonging to the present time.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '문맥 어휘', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'She has a very ___ personality; she always makes everyone laugh.',
      options: ['A. cheerful', 'B. selfish', 'C. serious', 'D. lazy'],
      correctAnswer: 'A',
      explanation: '"Cheerful" means noticeably happy and optimistic, fitting someone who makes others laugh.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '콜로케이션', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'You should ___ a decision before the deadline.',
      options: ['A. make', 'B. do', 'C. take', 'D. have'],
      correctAnswer: 'A',
      explanation: '"Make a decision" is the correct collocation in English.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '단어 뜻', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'What does "exhausted" mean?',
      options: ['A. extremely tired', 'B. very happy', 'C. slightly worried', 'D. very hungry'],
      correctAnswer: 'A',
      explanation: '"Exhausted" means completely drained of energy or strength.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '동의어', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'Which word is closest in meaning to "significant"?',
      options: ['A. important', 'B. tiny', 'C. confusing', 'D. ordinary'],
      correctAnswer: 'A',
      explanation: '"Significant" means important or large enough to have an effect.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '문맥 어휘', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'The scientist made a(n) ___ discovery that changed the field of medicine.',
      options: ['A. groundbreaking', 'B. ordinary', 'C. minor', 'D. useless'],
      correctAnswer: 'A',
      explanation: '"Groundbreaking" means innovative or pioneering, fitting for an important discovery.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '콜로케이션', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'She worked very hard to ___ her goal of becoming a doctor.',
      options: ['A. achieve', 'B. win', 'C. earn', 'D. gain'],
      correctAnswer: 'A',
      explanation: '"Achieve a goal" is the correct collocation.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '반의어', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'Which word is the OPPOSITE of "generous"?',
      options: ['A. stingy', 'B. kind', 'C. brave', 'D. clever'],
      correctAnswer: 'A',
      explanation: '"Stingy" (인색한) is the opposite of "generous" (관대한).',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '숙어/표현', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'If someone "breaks the ice," what do they do?',
      options: [
        'A. say or do something to make people feel comfortable',
        'B. destroy something made of ice',
        'C. leave a party early',
        'D. avoid a difficult topic',
      ],
      correctAnswer: 'A',
      explanation: '"Break the ice" is an idiom meaning to say or do something to relieve social tension.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '단어 형성', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      question: 'The prefix "un-" in "unexpected" means:',
      options: ['A. not', 'B. very', 'C. again', 'D. before'],
      correctAnswer: 'A',
      explanation: 'The prefix "un-" means "not." "Unexpected" = not expected.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '문맥 어휘', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: 'The new policy was ___ among employees, leading to many complaints.',
      options: ['A. controversial', 'B. popular', 'C. efficient', 'D. mandatory'],
      correctAnswer: 'A',
      explanation: '"Controversial" means causing disagreement or strong opinions.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '숙어/표현', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: 'To "bite off more than you can chew" means:',
      options: [
        'A. to take on more responsibility than you can handle',
        'B. to eat food that is too large',
        'C. to speak without thinking',
        'D. to work very efficiently',
      ],
      correctAnswer: 'A',
      explanation: 'This idiom describes taking on more than you are capable of doing.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '동의어', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: 'Which word best replaces "ambiguous" in the sentence: "The instructions were ambiguous"?',
      options: ['A. unclear', 'B. detailed', 'C. strict', 'D. simple'],
      correctAnswer: 'A',
      explanation: '"Ambiguous" means open to more than one interpretation, similar to "unclear."',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '전문 어휘', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: 'A person who studies the stars and planets is called an:',
      options: ['A. astronomer', 'B. astrologer', 'C. archaeologist', 'D. anthropologist'],
      correctAnswer: 'A',
      explanation: 'An astronomer studies celestial objects such as stars, planets, and galaxies scientifically.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '단어 형성', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'What is the noun form of "decide"?',
      options: ['A. decision', 'B. decisive', 'C. decisively', 'D. decided'],
      correctAnswer: 'A',
      explanation: 'The noun form of "decide" is "decision."',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '콜로케이션', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'Which verb goes with "homework"?',
      options: ['A. do', 'B. make', 'C. play', 'D. take'],
      correctAnswer: 'A',
      explanation: 'The correct collocation is "do homework," not "make homework."',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '문맥 어휘', difficulty: 5, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: 'The government needs to ___ the issue of climate change immediately.',
      options: ['A. address', 'B. ignore', 'C. avoid', 'D. admire'],
      correctAnswer: 'A',
      explanation: '"Address an issue" means to deal with or give attention to a problem.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '숙어/표현', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      question: 'What does "under the weather" mean?',
      options: [
        'A. feeling sick or unwell',
        'B. standing in the rain',
        'C. checking the weather forecast',
        'D. being very cold',
      ],
      correctAnswer: 'A',
      explanation: '"Under the weather" is a common idiom meaning feeling ill or not well.',
    },
  },
  {
    domain: 'VOCABULARY', subCategory: '반의어', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      question: 'Choose the OPPOSITE of "transparent":',
      options: ['A. opaque', 'B. clear', 'C. visible', 'D. obvious'],
      correctAnswer: 'A',
      explanation: '"Opaque" (불투명한) is the opposite of "transparent" (투명한).',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // READING (20문제 - 지문 4개 × 5문제)
  // ══════════════════════════════════════════════════════════════════════════════

  // 지문 1: 일상 생활 (A2 수준 - 초급)
  {
    domain: 'READING', subCategory: '일상생활 지문', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      passage: `My name is Emma, and I am a student. I wake up at 7:00 every morning. First, I eat breakfast with my family. I usually have toast and orange juice. Then I walk to school. School starts at 8:30. I have five classes every day. My favorite subject is English because I love reading stories. After school, I go home and do my homework. In the evening, I watch TV or read books. I go to bed at 9:30. I like my daily routine because it helps me stay organized.`,
      question: 'What time does Emma go to school?',
      options: [
        'A. She walks to school and it starts at 8:30.',
        'B. She drives to school at 7:00.',
        'C. She takes a bus to school at 9:00.',
        'D. She goes to school at 10:00.',
      ],
      correctAnswer: 'A',
      explanation: 'The passage says "Then I walk to school. School starts at 8:30."',
    },
  },
  {
    domain: 'READING', subCategory: '일상생활 지문', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      passage: `My name is Emma, and I am a student. I wake up at 7:00 every morning. First, I eat breakfast with my family. I usually have toast and orange juice. Then I walk to school. School starts at 8:30. I have five classes every day. My favorite subject is English because I love reading stories. After school, I go home and do my homework. In the evening, I watch TV or read books. I go to bed at 9:30. I like my daily routine because it helps me stay organized.`,
      question: "Why is English Emma's favorite subject?",
      options: [
        'A. Because she loves reading stories.',
        'B. Because it is easy.',
        'C. Because her teacher is kind.',
        'D. Because she is good at grammar.',
      ],
      correctAnswer: 'A',
      explanation: 'The passage states "My favorite subject is English because I love reading stories."',
    },
  },
  {
    domain: 'READING', subCategory: '일상생활 지문', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      passage: `My name is Emma, and I am a student. I wake up at 7:00 every morning. First, I eat breakfast with my family. I usually have toast and orange juice. Then I walk to school. School starts at 8:30. I have five classes every day. My favorite subject is English because I love reading stories. After school, I go home and do my homework. In the evening, I watch TV or read books. I go to bed at 9:30. I like my daily routine because it helps me stay organized.`,
      question: 'What does Emma do in the evening?',
      options: [
        'A. She watches TV or reads books.',
        'B. She does her homework.',
        'C. She plays sports outside.',
        'D. She calls her friends.',
      ],
      correctAnswer: 'A',
      explanation: '"In the evening, I watch TV or read books."',
    },
  },
  {
    domain: 'READING', subCategory: '일상생활 지문', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      passage: `My name is Emma, and I am a student. I wake up at 7:00 every morning. First, I eat breakfast with my family. I usually have toast and orange juice. Then I walk to school. School starts at 8:30. I have five classes every day. My favorite subject is English because I love reading stories. After school, I go home and do my homework. In the evening, I watch TV or read books. I go to bed at 9:30. I like my daily routine because it helps me stay organized.`,
      question: 'What does the word "organized" mean in this context?',
      options: [
        'A. Having a planned and structured life.',
        'B. Being very busy.',
        'C. Feeling tired.',
        'D. Waking up late.',
      ],
      correctAnswer: 'A',
      explanation: '"Organized" here means having things planned in a structured way.',
    },
  },
  {
    domain: 'READING', subCategory: '일상생활 지문', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'mcq',
      passage: `My name is Emma, and I am a student. I wake up at 7:00 every morning. First, I eat breakfast with my family. I usually have toast and orange juice. Then I walk to school. School starts at 8:30. I have five classes every day. My favorite subject is English because I love reading stories. After school, I go home and do my homework. In the evening, I watch TV or read books. I go to bed at 9:30. I like my daily routine because it helps me stay organized.`,
      question: 'How many classes does Emma have each day?',
      options: ['A. Five', 'B. Three', 'C. Six', 'D. Four'],
      correctAnswer: 'A',
      explanation: '"I have five classes every day."',
    },
  },

  // 지문 2: 건강한 식사 (B1 수준 - 중급)
  {
    domain: 'READING', subCategory: '건강/생활 지문', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      passage: `Eating a balanced diet is essential for maintaining good health. Nutritionists recommend eating a variety of foods, including fruits, vegetables, whole grains, and lean proteins. Many people, however, tend to eat too much processed food, which is high in sugar, salt, and unhealthy fats. These foods can lead to serious health problems such as obesity, heart disease, and diabetes. To improve your diet, start by making small changes: replace sugary drinks with water, add one extra serving of vegetables per day, and choose whole-grain bread instead of white bread. Over time, these small steps can make a significant difference to your overall health and energy levels.`,
      question: 'What is the main purpose of this passage?',
      options: [
        'A. To advise readers on how to improve their diet.',
        'B. To describe different types of diseases.',
        'C. To explain how to cook healthy meals.',
        'D. To discuss the history of nutrition science.',
      ],
      correctAnswer: 'A',
      explanation: 'The passage provides advice on eating better and making small dietary changes.',
    },
  },
  {
    domain: 'READING', subCategory: '건강/생활 지문', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      passage: `Eating a balanced diet is essential for maintaining good health. Nutritionists recommend eating a variety of foods, including fruits, vegetables, whole grains, and lean proteins. Many people, however, tend to eat too much processed food, which is high in sugar, salt, and unhealthy fats. These foods can lead to serious health problems such as obesity, heart disease, and diabetes. To improve your diet, start by making small changes: replace sugary drinks with water, add one extra serving of vegetables per day, and choose whole-grain bread instead of white bread. Over time, these small steps can make a significant difference to your overall health and energy levels.`,
      question: 'Which health problems are mentioned in the passage?',
      options: [
        'A. Obesity, heart disease, and diabetes.',
        'B. Cancer, arthritis, and asthma.',
        'C. Stress, anxiety, and depression.',
        'D. Allergies, headaches, and insomnia.',
      ],
      correctAnswer: 'A',
      explanation: 'The passage mentions "obesity, heart disease, and diabetes" as consequences of a poor diet.',
    },
  },
  {
    domain: 'READING', subCategory: '건강/생활 지문', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      passage: `Eating a balanced diet is essential for maintaining good health. Nutritionists recommend eating a variety of foods, including fruits, vegetables, whole grains, and lean proteins. Many people, however, tend to eat too much processed food, which is high in sugar, salt, and unhealthy fats. These foods can lead to serious health problems such as obesity, heart disease, and diabetes. To improve your diet, start by making small changes: replace sugary drinks with water, add one extra serving of vegetables per day, and choose whole-grain bread instead of white bread. Over time, these small steps can make a significant difference to your overall health and energy levels.`,
      question: 'The word "essential" in the first sentence is closest in meaning to:',
      options: ['A. necessary', 'B. optional', 'C. difficult', 'D. expensive'],
      correctAnswer: 'A',
      explanation: '"Essential" means absolutely necessary or indispensable.',
    },
  },
  {
    domain: 'READING', subCategory: '건강/생활 지문', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      passage: `Eating a balanced diet is essential for maintaining good health. Nutritionists recommend eating a variety of foods, including fruits, vegetables, whole grains, and lean proteins. Many people, however, tend to eat too much processed food, which is high in sugar, salt, and unhealthy fats. These foods can lead to serious health problems such as obesity, heart disease, and diabetes. To improve your diet, start by making small changes: replace sugary drinks with water, add one extra serving of vegetables per day, and choose whole-grain bread instead of white bread. Over time, these small steps can make a significant difference to your overall health and energy levels.`,
      question: 'According to the passage, what is ONE practical change you can make to eat healthier?',
      options: [
        'A. Replace sugary drinks with water.',
        'B. Stop eating all carbohydrates.',
        'C. Exercise for two hours every day.',
        'D. Take vitamin supplements daily.',
      ],
      correctAnswer: 'A',
      explanation: 'The passage specifically suggests "replace sugary drinks with water" as a small change.',
    },
  },
  {
    domain: 'READING', subCategory: '건강/생활 지문', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'mcq',
      passage: `Eating a balanced diet is essential for maintaining good health. Nutritionists recommend eating a variety of foods, including fruits, vegetables, whole grains, and lean proteins. Many people, however, tend to eat too much processed food, which is high in sugar, salt, and unhealthy fats. These foods can lead to serious health problems such as obesity, heart disease, and diabetes. To improve your diet, start by making small changes: replace sugary drinks with water, add one extra serving of vegetables per day, and choose whole-grain bread instead of white bread. Over time, these small steps can make a significant difference to your overall health and energy levels.`,
      question: 'What does the passage suggest about changing your diet?',
      options: [
        'A. Small changes made gradually can lead to big improvements.',
        'B. You need to change everything at once for results.',
        'C. Only experts can help you improve your diet.',
        'D. Diet changes are not very effective for health.',
      ],
      correctAnswer: 'A',
      explanation: '"Over time, these small steps can make a significant difference."',
    },
  },

  // 지문 3: 도시 소개 (B1/B2 수준 - 고급)
  {
    domain: 'READING', subCategory: '사회/문화 지문', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      passage: `Tokyo, the capital of Japan, is one of the world's most fascinating cities. With a population of over 13 million people, it is among the most densely populated urban areas on the planet. Despite its size, Tokyo is remarkably clean, safe, and efficient. The city's public transportation system is considered one of the best in the world, with trains and subways running on time to the minute. Tokyo is also a city of contrasts: ancient temples and shrines stand alongside gleaming skyscrapers, and traditional markets coexist with cutting-edge technology stores. Visitors are often struck by the blend of the old and new, making Tokyo a truly unique destination for travelers from around the globe.`,
      question: 'What is the main idea of this passage?',
      options: [
        'A. Tokyo is a unique city that combines ancient traditions with modern life.',
        'B. Tokyo has the best public transportation in the world.',
        'C. Tokyo is overcrowded and difficult to navigate.',
        'D. Tokyo is only interesting for technology lovers.',
      ],
      correctAnswer: 'A',
      explanation: 'The passage describes Tokyo as a "city of contrasts" mixing old and new, making it unique.',
    },
  },
  {
    domain: 'READING', subCategory: '사회/문화 지문', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      passage: `Tokyo, the capital of Japan, is one of the world's most fascinating cities. With a population of over 13 million people, it is among the most densely populated urban areas on the planet. Despite its size, Tokyo is remarkably clean, safe, and efficient. The city's public transportation system is considered one of the best in the world, with trains and subways running on time to the minute. Tokyo is also a city of contrasts: ancient temples and shrines stand alongside gleaming skyscrapers, and traditional markets coexist with cutting-edge technology stores. Visitors are often struck by the blend of the old and new, making Tokyo a truly unique destination for travelers from around the globe.`,
      question: 'The word "coexist" in the passage most likely means:',
      options: [
        'A. exist at the same time and in the same place',
        'B. replace one another',
        'C. compete against each other',
        'D. grow quickly',
      ],
      correctAnswer: 'A',
      explanation: '"Coexist" = to exist together at the same time/place.',
    },
  },
  {
    domain: 'READING', subCategory: '사회/문화 지문', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      passage: `Tokyo, the capital of Japan, is one of the world's most fascinating cities. With a population of over 13 million people, it is among the most densely populated urban areas on the planet. Despite its size, Tokyo is remarkably clean, safe, and efficient. The city's public transportation system is considered one of the best in the world, with trains and subways running on time to the minute. Tokyo is also a city of contrasts: ancient temples and shrines stand alongside gleaming skyscrapers, and traditional markets coexist with cutting-edge technology stores. Visitors are often struck by the blend of the old and new, making Tokyo a truly unique destination for travelers from around the globe.`,
      question: 'What surprises many visitors to Tokyo?',
      options: [
        'A. The combination of ancient and modern elements.',
        'B. The high cost of living.',
        'C. The large number of foreign tourists.',
        'D. The lack of green spaces.',
      ],
      correctAnswer: 'A',
      explanation: '"Visitors are often struck by the blend of the old and new."',
    },
  },
  {
    domain: 'READING', subCategory: '사회/문화 지문', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      passage: `Tokyo, the capital of Japan, is one of the world's most fascinating cities. With a population of over 13 million people, it is among the most densely populated urban areas on the planet. Despite its size, Tokyo is remarkably clean, safe, and efficient. The city's public transportation system is considered one of the best in the world, with trains and subways running on time to the minute. Tokyo is also a city of contrasts: ancient temples and shrines stand alongside gleaming skyscrapers, and traditional markets coexist with cutting-edge technology stores. Visitors are often struck by the blend of the old and new, making Tokyo a truly unique destination for travelers from around the globe.`,
      question: 'Which word best describes Tokyo\'s trains and subways?',
      options: ['A. punctual', 'B. crowded', 'C. expensive', 'D. slow'],
      correctAnswer: 'A',
      explanation: '"Running on time to the minute" describes punctual (정시 운행) transportation.',
    },
  },
  {
    domain: 'READING', subCategory: '사회/문화 지문', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'mcq',
      passage: `Tokyo, the capital of Japan, is one of the world's most fascinating cities. With a population of over 13 million people, it is among the most densely populated urban areas on the planet. Despite its size, Tokyo is remarkably clean, safe, and efficient. The city's public transportation system is considered one of the best in the world, with trains and subways running on time to the minute. Tokyo is also a city of contrasts: ancient temples and shrines stand alongside gleaming skyscrapers, and traditional markets coexist with cutting-edge technology stores. Visitors are often struck by the blend of the old and new, making Tokyo a truly unique destination for travelers from around the globe.`,
      question: 'Which statement is NOT supported by the passage?',
      options: [
        "A. Tokyo's population is decreasing rapidly.",
        'B. Tokyo is one of the most densely populated cities.',
        'C. Tokyo has ancient temples and modern skyscrapers.',
        'D. Tokyo is considered clean and safe.',
      ],
      correctAnswer: 'A',
      explanation: 'The passage does not mention any decrease in population. It says population is over 13 million.',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // WRITING (20문제 - 다양한 쓰기 과제)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    domain: 'WRITING', subCategory: '일상 주제', difficulty: 1, cefrLevel: 'A1',
    contentJson: {
      type: 'essay',
      prompt: 'Write 3-5 sentences about yourself. Include your name, age, where you live, and one hobby.',
      wordLimit: 60,
      guidelines: '간단한 자기 소개를 영어로 써보세요. 자신의 이름, 나이, 거주지, 취미를 포함하세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '일상 주제', difficulty: 1, cefrLevel: 'A1',
    contentJson: {
      type: 'essay',
      prompt: 'Describe your bedroom. What furniture is in it? What do you like about it?',
      wordLimit: 60,
      guidelines: '자신의 방을 묘사하는 글을 써보세요. 가구와 좋아하는 점을 포함하세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '일상/경험', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'essay',
      prompt: 'What did you do last weekend? Write about your activities. Use past tense verbs.',
      wordLimit: 80,
      guidelines: '지난 주말에 무엇을 했는지 과거 시제를 사용하여 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '일상/경험', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'essay',
      prompt: 'Write about your favorite food. What is it? How is it made? Why do you like it?',
      wordLimit: 80,
      guidelines: '좋아하는 음식에 대해 설명하는 글을 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '일상/경험', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'essay',
      prompt: 'Describe a person you admire. Who is it? Why do you admire them?',
      wordLimit: 100,
      guidelines: '존경하는 사람에 대해 설명하는 글을 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '의견/주장', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'essay',
      prompt: 'Do you think students should have more homework or less homework? Give reasons for your opinion.',
      wordLimit: 120,
      guidelines: '숙제의 양에 대한 자신의 의견을 이유와 함께 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '의견/주장', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'essay',
      prompt: 'Is it better to live in a city or in the countryside? Write a paragraph supporting your view.',
      wordLimit: 120,
      guidelines: '도시와 시골 생활 중 어디가 더 나은지에 대한 의견을 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '설명문', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'essay',
      prompt: 'Explain how to make your favorite dish. Use sequence words like "first," "next," "then," and "finally."',
      wordLimit: 130,
      guidelines: '좋아하는 요리 만드는 방법을 순서에 맞게 설명하는 글을 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '설명문', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'essay',
      prompt: 'Describe a memorable trip or journey you have taken. What made it special?',
      wordLimit: 130,
      guidelines: '기억에 남는 여행에 대해 설명하는 글을 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '의견/주장', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'essay',
      prompt: '"Social media does more harm than good for young people." Do you agree or disagree? Support your argument with examples.',
      wordLimit: 180,
      guidelines: '소셜 미디어가 청소년에게 미치는 영향에 대해 찬성 또는 반대 의견을 논리적으로 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '의견/주장', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'essay',
      prompt: 'Should schools teach financial literacy as a required subject? Write an argumentative paragraph.',
      wordLimit: 180,
      guidelines: '금융 교육을 학교 필수 과목으로 가르쳐야 하는지에 대한 주장을 펴보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '창의 쓰기', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'essay',
      prompt: 'Write a short story that begins with: "It was a rainy afternoon when everything changed..."',
      wordLimit: 150,
      guidelines: '주어진 첫 문장으로 시작하는 짧은 이야기를 창작해보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '편지/이메일', difficulty: 3, cefrLevel: 'B1',
    contentJson: {
      type: 'essay',
      prompt: 'Write a friendly email to a pen pal in another country. Introduce yourself and ask them 3 questions.',
      wordLimit: 130,
      guidelines: '외국 펜팔에게 자기소개와 질문 3가지를 포함한 이메일을 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '창의 쓰기', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'essay',
      prompt: 'If you could change one thing about your school, what would it be and why? Write a persuasive essay.',
      wordLimit: 200,
      guidelines: '학교에서 바꾸고 싶은 한 가지를 설득력 있게 주장하는 에세이를 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '비교 쓰기', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'essay',
      prompt: 'Compare traditional classroom learning with online learning. Discuss the advantages and disadvantages of each.',
      wordLimit: 200,
      guidelines: '전통적인 교실 수업과 온라인 학습을 비교하는 글을 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '의견/주장', difficulty: 5, cefrLevel: 'B2',
    contentJson: {
      type: 'essay',
      prompt: '"Artificial intelligence will eventually replace most human jobs." Critically evaluate this statement.',
      wordLimit: 250,
      guidelines: 'AI가 인간의 일자리를 대체할 것이라는 주장을 비판적으로 평가하는 에세이를 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '설명문', difficulty: 5, cefrLevel: 'B2',
    contentJson: {
      type: 'essay',
      prompt: 'Explain the causes and effects of climate change, and suggest practical solutions individuals can take.',
      wordLimit: 250,
      guidelines: '기후 변화의 원인과 결과를 설명하고 개인이 실천할 수 있는 해결책을 제시하세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '일상/경험', difficulty: 1, cefrLevel: 'A1',
    contentJson: {
      type: 'essay',
      prompt: 'Write 3 sentences about your favorite animal. What is it? Why do you like it?',
      wordLimit: 50,
      guidelines: '좋아하는 동물에 대해 3문장으로 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '편지/이메일', difficulty: 4, cefrLevel: 'B2',
    contentJson: {
      type: 'essay',
      prompt: 'Write a formal email to a university admissions office requesting information about their English language programs.',
      wordLimit: 180,
      guidelines: '대학 입학처에 영어 프로그램에 대한 정보를 요청하는 공식 이메일을 써보세요.',
    },
  },
  {
    domain: 'WRITING', subCategory: '창의 쓰기', difficulty: 2, cefrLevel: 'A2',
    contentJson: {
      type: 'essay',
      prompt: 'Write about your dream job. What is it? What do you do in this job? Why do you want it?',
      wordLimit: 100,
      guidelines: '꿈의 직업에 대해 설명하는 글을 써보세요.',
    },
  },
]

// ─── 배지 정의 ────────────────────────────────────────────────────────────────
const BADGE_DEFS = [
  { code: 'FIRST_TEST',     name: '첫 테스트',      description: '첫 번째 테스트를 완료했습니다!' },
  { code: 'PERFECT_SCORE',  name: '만점 달성',      description: '테스트에서 100점을 받았습니다!' },
  { code: 'STREAK_3',       name: '3일 연속',       description: '3일 연속으로 학습을 완료했습니다.' },
  { code: 'STREAK_7',       name: '7일 연속',       description: '7일 연속으로 학습을 완료했습니다.' },
  { code: 'STREAK_14',      name: '14일 연속',      description: '14일 연속으로 학습을 완료했습니다.' },
  { code: 'STREAK_30',      name: '30일 연속',      description: '30일 연속으로 학습을 완료했습니다.' },
  { code: 'STREAK_100',     name: '100일 연속',     description: '100일 연속으로 학습을 완료했습니다!' },
  { code: 'SPEED_DEMON',    name: '스피드 챔피언',  description: '시간 내에 테스트를 빠르게 완료했습니다.' },
  { code: 'LEVEL_UP',       name: '레벨 업',        description: '레벨이 올라갔습니다!' },
  { code: 'MASTER',         name: '마스터',         description: '모든 영역에서 우수한 성적을 달성했습니다.' },
  { code: 'WEEKLY_GOAL',    name: '주간 목표 달성', description: '이번 주 학습 목표를 달성했습니다.' },
  { code: 'MISSION_COMPLETE', name: '미션 완료',    description: '오늘의 미션을 완료했습니다.' },
] as const

// ─── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 해피잉글리시 어학원 시드 데이터 생성을 시작합니다...\n')

  // ── 1. 요금제 ────────────────────────────────────────────────────────────────
  console.log('📦 요금제 초기화...')
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: { displayName: plan.displayName, monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice, maxStudents: plan.maxStudents, maxTeachers: plan.maxTeachers, featuresJson: plan.featuresJson },
      create: plan,
    })
  }
  console.log('  ✅ 요금제 4종 완료\n')

  // ── 2. 학원 생성 ──────────────────────────────────────────────────────────────
  let academy = await prisma.academy.findFirst({ where: { name: ACADEMY_DATA.name } })
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  if (!academy) {
    academy = await prisma.academy.create({
      data: {
        ...ACADEMY_DATA,
        planType: 'STANDARD',
        subscriptionPlan: 'STANDARD',
        inviteCode: generateInviteCode(),
        subscriptionStatus: 'ACTIVE',
        subscriptionStartedAt: new Date(),
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        trialEndsAt,
        maxStudents: 150,
        maxTeachers: 5,
      },
    })
    console.log(`✅ 학원 생성: ${academy.name} (초대코드: ${academy.inviteCode})`)
  } else {
    console.log(`ℹ️  기존 학원 사용: ${academy.name}`)
  }

  // ── 3. 사용자 생성 ────────────────────────────────────────────────────────────
  console.log('\n👤 사용자 생성...')
  const createdUsers: Record<string, string> = {} // email → DB id

  for (const u of USER_DEFS) {
    try {
      const authId = await getOrCreateAuthUser(u.email, u.password)
      await prisma.user.upsert({
        where: { id: authId },
        update: { role: u.role, academyId: u.noAcademy ? null : academy.id, name: u.name, isActive: true },
        create: {
          id: authId,
          email: u.email,
          name: u.name,
          role: u.role,
          academyId: u.noAcademy ? null : academy.id,
          agreedTerms: true,
          agreedPrivacy: true,
        },
      })
      createdUsers[u.email] = authId

      const roleLabel = { SUPER_ADMIN: '시스템관리자', ACADEMY_OWNER: '학원장', TEACHER: '교사', STUDENT: '학생' }[u.role]
      console.log(`  ✅ ${roleLabel.padEnd(8)} | ${u.name.padEnd(6)} (${u.email})`)
    } catch (err) {
      console.error(`  ❌ 생성 실패 (${u.email}):`, err)
    }
  }

  // 학원장 연결
  const ownerEmail = 'owner@happy-english.com'
  const ownerId = createdUsers[ownerEmail]
  if (ownerId && !academy.ownerId) {
    await prisma.academy.update({ where: { id: academy.id }, data: { ownerId } })
    console.log('\n  ✅ 학원장 연결 완료')
  }

  // ── 4. Student 레코드 생성 ─────────────────────────────────────────────────
  const studentEmails = USER_DEFS.filter(u => u.role === 'STUDENT').map(u => u.email)
  const studentRecords: Record<string, string> = {} // email → student.id

  for (const email of studentEmails) {
    const userId = createdUsers[email]
    if (!userId) continue
    const student = await prisma.student.upsert({
      where: { userId },
      update: {},
      create: { userId, currentLevel: randomInt(1, 5) },
    })
    studentRecords[email] = student.id
  }

  // ── 5. 반 생성 ────────────────────────────────────────────────────────────────
  console.log('\n🏫 반 생성...')
  const teacher1Id = createdUsers['teacher1@happy-english.com']
  const teacher2Id = createdUsers['teacher2@happy-english.com']

  const classDefs = [
    { name: '초급반', levelRange: '1-2', teacherId: teacher1Id, scheduleJson: { days: ['월', '수', '금'], time: '14:00-15:30' } },
    { name: '중급반', levelRange: '3',   teacherId: teacher2Id, scheduleJson: { days: ['화', '목'],    time: '15:00-16:30' } },
    { name: '고급반', levelRange: '4-5', teacherId: teacher1Id, scheduleJson: { days: ['월', '수'],    time: '16:00-17:30' } },
  ]

  const createdClasses: { id: string; name: string; levelRange: string | null }[] = []
  for (const cd of classDefs) {
    let cls = await prisma.class.findFirst({ where: { academyId: academy.id, name: cd.name } })
    if (!cls) {
      cls = await prisma.class.create({
        data: { academyId: academy.id, ...cd },
      })
    }
    createdClasses.push(cls)
    console.log(`  ✅ ${cls.name} (Level ${cls.levelRange ?? '?'})`)
  }

  const [beginnerClass, intermediateClass, advancedClass] = createdClasses

  // ── 6. 학생 반 배분 (초급 8, 중급 7, 고급 5) ───────────────────────────────
  console.log('\n📋 학생 배분...')
  const allStudentEmails = studentEmails.slice() // 20명
  const distributions: { cls: typeof beginnerClass; count: number; levelRange: [number, number] }[] = [
    { cls: beginnerClass,    count: 8, levelRange: [1, 2] },
    { cls: intermediateClass, count: 7, levelRange: [3, 3] },
    { cls: advancedClass,     count: 5, levelRange: [4, 5] },
  ]

  for (const { cls, count, levelRange } of distributions) {
    const batch = allStudentEmails.splice(0, count)
    for (const email of batch) {
      const userId = createdUsers[email]
      const studentId = studentRecords[email]
      if (!userId || !studentId) continue

      const level = randomInt(levelRange[0], levelRange[1])
      await prisma.student.update({
        where: { id: studentId },
        data: { classId: cls.id, currentLevel: level },
      })

      await prisma.enrollment.upsert({
        where: { studentId_classId: { studentId, classId: cls.id } },
        update: {},
        create: { studentId, classId: cls.id, academyId: academy.id },
      })
    }
    console.log(`  ✅ ${cls.name}: ${count}명 배분 완료`)
  }

  // ── 7. 문제 뱅크 생성 (80문제) ─────────────────────────────────────────────
  console.log('\n📝 문제 뱅크 생성 (80문제)...')
  const questionIds: string[] = []

  for (const q of QUESTIONS) {
    const existing = await prisma.question.findFirst({
      where: {
        academyId: academy.id,
        domain: q.domain,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
      },
    })
    if (existing) {
      questionIds.push(existing.id)
      continue
    }
    const created = await prisma.question.create({
      data: {
        academyId: academy.id,
        domain: q.domain,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        cefrLevel: q.cefrLevel,
        contentJson: q.contentJson,
        createdBy: teacher1Id ?? null,
        statsJson: { timesUsed: 0, avgScore: null },
      },
    })
    questionIds.push(created.id)
  }

  const grammarQIds   = questionIds.slice(0, 20)
  const vocabQIds     = questionIds.slice(20, 40)
  const readingQIds   = questionIds.slice(40, 60)
  const writingQIds   = questionIds.slice(60, 80)

  console.log(`  ✅ 문법 20문제, 어휘 20문제, 읽기 20문제, 쓰기 20문제`)

  // ── 8. 테스트 생성 (반별 1개) ──────────────────────────────────────────────
  console.log('\n📄 테스트 생성...')

  const testDefs = [
    {
      cls: beginnerClass,
      title: '[초급반] 1학기 레벨 테스트',
      type: 'LEVEL_TEST' as const,
      levelRange: '1-2',
      timeLimitMin: 40,
      instructions: '각 문제를 잘 읽고 답을 선택하세요. 시간은 40분입니다.',
      qIds: [...grammarQIds.slice(0, 5), ...vocabQIds.slice(0, 5), ...readingQIds.slice(0, 5), ...writingQIds.slice(0, 5)],
    },
    {
      cls: intermediateClass,
      title: '[중급반] 1학기 레벨 테스트',
      type: 'LEVEL_TEST' as const,
      levelRange: '3',
      timeLimitMin: 50,
      instructions: '각 문제를 잘 읽고 답을 선택하세요. 시간은 50분입니다.',
      qIds: [...grammarQIds.slice(5, 12), ...vocabQIds.slice(5, 12), ...readingQIds.slice(5, 12), ...writingQIds.slice(5, 9)],
    },
    {
      cls: advancedClass,
      title: '[고급반] 1학기 레벨 테스트',
      type: 'LEVEL_TEST' as const,
      levelRange: '4-5',
      timeLimitMin: 60,
      instructions: '각 문제를 잘 읽고 답을 선택하세요. 시간은 60분입니다.',
      qIds: [...grammarQIds.slice(12, 18), ...vocabQIds.slice(12, 18), ...readingQIds.slice(12, 18), ...writingQIds.slice(15, 21)],
    },
  ]

  const createdTests: { id: string; classId: string | null; scoreRange: [number, number] }[] = []
  const scoreRanges: [number, number][] = [[40, 72], [55, 82], [68, 97]]

  for (let i = 0; i < testDefs.length; i++) {
    const td = testDefs[i]
    let test = await prisma.test.findFirst({
      where: { academyId: academy.id, title: td.title },
    })
    if (!test) {
      test = await prisma.test.create({
        data: {
          academyId: academy.id,
          title: td.title,
          type: td.type,
          status: 'PUBLISHED',
          levelRange: td.levelRange,
          classId: td.cls.id,
          totalScore: 100,
          timeLimitMin: td.timeLimitMin,
          instructions: td.instructions,
          questionOrder: td.qIds,
          createdBy: teacher1Id!,
        },
      })
    }
    createdTests.push({ id: test.id, classId: td.cls.id, scoreRange: scoreRanges[i] })
    console.log(`  ✅ ${td.title}`)
  }

  // ── 9. 테스트 세션 생성 (학생별 랜덤 점수) ────────────────────────────────
  console.log('\n📊 테스트 세션 생성...')
  let sessionCount = 0

  for (const { id: testId, classId, scoreRange } of createdTests) {
    // 해당 반의 학생 목록 가져오기
    const classStudents = await prisma.student.findMany({ where: { classId: classId! } })

    for (const student of classStudents) {
      const existing = await prisma.testSession.findFirst({
        where: { testId, studentId: student.id },
      })
      if (existing) continue

      const totalScore = randomInt(scoreRange[0], scoreRange[1])
      const grammarScore  = randomInt(Math.round(totalScore * 0.2), Math.round(totalScore * 0.3))
      const vocabScore    = randomInt(Math.round(totalScore * 0.2), Math.round(totalScore * 0.3))
      const readingScore  = randomInt(Math.round(totalScore * 0.2), Math.round(totalScore * 0.3))
      const writingScore  = Math.max(0, totalScore - grammarScore - vocabScore - readingScore)

      const startedAt = new Date(Date.now() - randomInt(1, 20) * 24 * 60 * 60 * 1000)
      const completedAt = new Date(startedAt.getTime() + randomInt(20, 55) * 60 * 1000)

      await prisma.testSession.create({
        data: {
          testId,
          studentId: student.id,
          score: totalScore,
          grammarScore,
          vocabularyScore: vocabScore,
          readingScore,
          writingScore,
          startedAt,
          completedAt,
          status: 'GRADED',
          currentQuestionIdx: 20,
          lastSavedAt: completedAt,
        },
      })
      sessionCount++
    }
  }
  console.log(`  ✅ 테스트 세션 ${sessionCount}개 생성 완료`)

  // ── 10. 출석 데이터 생성 (최근 30 평일) ────────────────────────────────────
  console.log('\n📅 출석 데이터 생성 (최근 30 평일)...')
  const weekdays = getLast30Weekdays()
  let attendanceCount = 0

  const allStudents = await prisma.student.findMany({
    where: { class: { academyId: academy.id } },
    include: { class: true },
  })

  for (const student of allStudents) {
    if (!student.classId) continue
    for (const date of weekdays) {
      try {
        await prisma.attendance.upsert({
          where: {
            studentId_classId_date: {
              studentId: student.id,
              classId: student.classId,
              date,
            },
          },
          update: {},
          create: {
            studentId: student.id,
            classId: student.classId,
            date,
            status: weightedStatus() as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
          },
        })
        attendanceCount++
      } catch {
        // 중복 무시
      }
    }
  }
  console.log(`  ✅ 출석 레코드 ${attendanceCount}개 생성 완료`)

  // ── 11. 배지 생성 ─────────────────────────────────────────────────────────
  console.log('\n🏅 배지 생성...')
  const badgeIds: Record<string, string> = {}

  for (const b of BADGE_DEFS) {
    const badge = await prisma.badge.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description },
      create: {
        code: b.code,
        name: b.name,
        description: b.description,
        academyId: academy.id,
        criteria: { description: b.description },
      },
    })
    badgeIds[b.code] = badge.id
  }
  console.log(`  ✅ 배지 ${BADGE_DEFS.length}종 생성 완료`)

  // ── 12. 배지 수여 (랜덤) ──────────────────────────────────────────────────
  console.log('\n🎖️  배지 수여...')
  let badgeEarningCount = 0

  const studentsForBadge = await prisma.student.findMany({
    where: { class: { academyId: academy.id } },
  })

  for (const student of studentsForBadge) {
    // 첫 테스트 배지: 테스트 세션이 있는 학생 모두
    const sessions = await prisma.testSession.findMany({ where: { studentId: student.id } })
    if (sessions.length > 0) {
      await prisma.badgeEarning.upsert({
        where: { studentId_badgeId: { studentId: student.id, badgeId: badgeIds['FIRST_TEST'] } },
        update: {},
        create: { studentId: student.id, badgeId: badgeIds['FIRST_TEST'] },
      }).catch(() => {})
      badgeEarningCount++
    }

    // 만점 배지: 점수 95점 이상인 세션이 있는 학생
    const highScore = sessions.find(s => (s.score ?? 0) >= 95)
    if (highScore) {
      await prisma.badgeEarning.upsert({
        where: { studentId_badgeId: { studentId: student.id, badgeId: badgeIds['PERFECT_SCORE'] } },
        update: {},
        create: { studentId: student.id, badgeId: badgeIds['PERFECT_SCORE'] },
      }).catch(() => {})
      badgeEarningCount++
    }

    // 랜덤 배지 수여 (30% 확률)
    const randomBadges = ['STREAK_3', 'STREAK_7', 'WEEKLY_GOAL', 'MISSION_COMPLETE', 'LEVEL_UP', 'SPEED_DEMON']
    for (const badgeCode of randomBadges) {
      if (Math.random() < 0.3) {
        await prisma.badgeEarning.upsert({
          where: { studentId_badgeId: { studentId: student.id, badgeId: badgeIds[badgeCode] } },
          update: {},
          create: { studentId: student.id, badgeId: badgeIds[badgeCode] },
        }).catch(() => {})
        badgeEarningCount++
      }
    }
  }
  console.log(`  ✅ 배지 수여 ${badgeEarningCount}건 완료`)

  // ── 13. 학습 스트릭 생성 ──────────────────────────────────────────────────
  console.log('\n🔥 학습 스트릭 생성...')
  for (const student of studentsForBadge) {
    const currentStreak  = randomInt(0, 30)
    const longestStreak  = randomInt(currentStreak, Math.min(currentStreak + randomInt(0, 20), 100))
    const totalDays      = randomInt(longestStreak, longestStreak + randomInt(0, 30))
    const lastActivity   = new Date(Date.now() - randomInt(0, 3) * 24 * 60 * 60 * 1000)

    await prisma.studentStreak.upsert({
      where: { studentId: student.id },
      update: { currentStreak, longestStreak, totalDays, lastActivityDate: lastActivity },
      create: { studentId: student.id, currentStreak, longestStreak, totalDays, lastActivityDate: lastActivity },
    })
  }
  console.log(`  ✅ 스트릭 ${studentsForBadge.length}명 완료`)

  // ── 14. 스킬 평가 (영역별) ─────────────────────────────────────────────────
  console.log('\n📈 스킬 평가 생성...')
  const domains: ('GRAMMAR' | 'VOCABULARY' | 'READING' | 'WRITING')[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING']
  let skillCount = 0

  for (const student of studentsForBadge) {
    const studentUser = await prisma.student.findUnique({ where: { id: student.id } })
    const baseLevel = studentUser?.currentLevel ?? 1
    for (const domain of domains) {
      const level = Math.max(1, Math.min(5, baseLevel + randomInt(-1, 1)))
      const score = randomInt(50, 100)
      await prisma.skillAssessment.create({
        data: {
          studentId: student.id,
          domain,
          level,
          score,
          notes: `${domain} 영역 평가 완료`,
          assessedAt: new Date(Date.now() - randomInt(1, 15) * 24 * 60 * 60 * 1000),
        },
      })
      skillCount++
    }
  }
  console.log(`  ✅ 스킬 평가 ${skillCount}건 완료`)

  // ── 15. 공지사항 ──────────────────────────────────────────────────────────
  console.log('\n📢 공지사항 생성...')
  const announcementDefs = [
    { title: '3월 레벨 테스트 안내', content: '이번 달 레벨 테스트는 3월 마지막 주에 진행됩니다. 각 반별 일정을 확인해주세요.', target: 'ALL_STUDENTS' as const },
    { title: '4월 개강 안내', content: '4월 개강은 4월 7일(월)부터 시작합니다. 학습 자료는 미리 배부될 예정입니다.', target: 'ALL_STUDENTS' as const },
    { title: '[초급반] 추가 수업 안내', content: '초급반 학생들을 위한 보충 수업이 매주 토요일 오전 10시에 진행됩니다.', target: 'CLASS' as const, classId: beginnerClass.id },
    { title: '[고급반] 모의고사 일정', content: '고급반 학생들은 4월 중 모의고사에 참여하게 됩니다. 준비를 철저히 해주세요.', target: 'CLASS' as const, classId: advancedClass.id },
  ]

  const ownerUser = await prisma.user.findFirst({ where: { email: 'owner@happy-english.com' } })
  let announcementCount = 0
  for (const a of announcementDefs) {
    if (!ownerUser) continue
    const existing = await prisma.announcement.findFirst({
      where: { academyId: academy.id, title: a.title },
    })
    if (existing) continue
    await prisma.announcement.create({
      data: {
        academyId: academy.id,
        authorId: ownerUser.id,
        title: a.title,
        content: a.content,
        target: a.target,
        classId: a.classId ?? null,
        isPublished: true,
      },
    })
    announcementCount++
  }
  console.log(`  ✅ 공지사항 ${announcementCount}개 완료`)

  // ── 결과 출력 ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(65))
  console.log('🎉 시드 데이터 생성 완료!')
  console.log('═'.repeat(65))
  console.log('\n📋 테스트 계정 목록 (비밀번호: password123)')
  console.log('─'.repeat(65))
  console.log('역할          이름        이메일')
  console.log('─'.repeat(65))
  console.log('시스템관리자  시스템관리자  admin@edulevel.com')
  console.log('학원장        홍길동        owner@happy-english.com')
  console.log('교사 1        김지수        teacher1@happy-english.com')
  console.log('교사 2        박민준        teacher2@happy-english.com')
  console.log('학생 1~20     이서연 등     student1~20@happy-english.com')
  console.log('─'.repeat(65))
  console.log(`\n🏫 학원: ${academy.name}`)
  console.log(`🔑 초대 코드: ${academy.inviteCode}`)
  console.log('\n반 구성:')
  console.log('  • 초급반 (Level 1-2): student1~8  | 담당: 김지수')
  console.log('  • 중급반 (Level 3)  : student9~15 | 담당: 박민준')
  console.log('  • 고급반 (Level 4-5): student16~20 | 담당: 김지수')
  console.log('\n문제 뱅크: 문법 20 + 어휘 20 + 읽기 20 + 쓰기 20 = 80문제')
  console.log('✨ 로그인 후 데이터를 확인하세요!\n')
}

main()
  .catch((e) => {
    console.error('\n❌ 오류 발생:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
