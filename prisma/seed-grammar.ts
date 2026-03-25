/**
 * prisma/seed-grammar.ts
 * Smart Grammar Test L1-L6 문법 문제 60개 등록 스크립트
 *
 * 실행: npm run seed:grammar
 */

import { PrismaClient, QuestionDomain } from '../src/generated/prisma'
import * as dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

// ── MCQ 컨텐츠 타입 (컴포넌트 표준 포맷) ─────────────────────────────────────
interface McqContent {
  type: 'multiple_choice'
  question_text: string
  options: string[]       // 레터 프리픽스 없이 순수 텍스트 (예: '책상 위에')
  correct_answer: string  // 'A' | 'B' | 'C' | 'D'
  explanation?: string
}

interface GrammarQuestion {
  domain: QuestionDomain
  subCategory: string
  difficulty: number
  cefrLevel: string
  contentJson: McqContent
}

// ── Smart Grammar Test L1 (A1, difficulty 1) ────────────────────────────────
// 주제: 관사 a/an, be동사, 복수형, have got, 명령문, 전치사(장소), can/can't
const LEVEL1_QUESTIONS: GrammarQuestion[] = [
  {
    domain: 'GRAMMAR',
    subCategory: '관사(a/an)',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'I have ___ umbrella in my bag.',
      options: ['a', 'an', 'the', '(없음)'],
      correct_answer: 'B',
      explanation: '모음 소리(u-)로 시작하는 명사 앞에는 관사 "an"을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'be동사',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'She ___ my best friend.',
      options: ['am', 'are', 'is', 'be'],
      correct_answer: 'C',
      explanation: '3인칭 단수(She) 주어에는 be동사 "is"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '복수형',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'There are two ___ on the table.',
      options: ['box', 'boxs', 'boxes', 'boxies'],
      correct_answer: 'C',
      explanation: '-x로 끝나는 명사의 복수형은 -es를 붙여 "boxes"가 됩니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'have got',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'He ___ a red schoolbag.',
      options: ['have got', 'has got', 'have get', 'has get'],
      correct_answer: 'B',
      explanation: '3인칭 단수(He) 주어에는 "has got"을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '명령문',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: '___ quiet! The baby is sleeping.',
      options: ['Be', 'Are', 'Is', 'Do'],
      correct_answer: 'A',
      explanation: '명령문은 동사원형으로 시작합니다. be동사 명령문은 "Be"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: "can/can't",
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: "A fish ___ fly. It can swim.",
      options: ['can', "can't", 'cans', 'is can'],
      correct_answer: 'B',
      explanation: "물고기는 날 수 없으므로 불가능을 나타내는 \"can't\"를 사용합니다.",
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '전치사(장소)',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'The cat is ___ the chair.',
      options: ['in', 'on', 'under', 'at'],
      correct_answer: 'B',
      explanation: '표면 위에 있을 때는 전치사 "on"을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '관사(a/an) - 2',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: '___ elephant is a very large animal.',
      options: ['A', 'An', 'The', '(없음)'],
      correct_answer: 'B',
      explanation: 'elephant는 모음 소리(e-)로 시작하므로 "An"을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'be동사 부정',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: "They ___ at school today. It's a holiday.",
      options: ['is not', 'not are', "aren't", 'am not'],
      correct_answer: 'C',
      explanation: "복수 주어(They)의 be동사 부정형은 \"aren't\"입니다.",
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'can 의문문',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: '___ you ride a bike?',
      options: ['Do', 'Are', 'Can', 'Have'],
      correct_answer: 'C',
      explanation: '능력을 묻는 의문문에는 조동사 "Can"을 사용합니다.',
    },
  },
]

// ── Smart Grammar Test L2 (A1, difficulty 2) ────────────────────────────────
// 주제: Who's/What's, 소유격, have got(전인칭), can, there is/are, Whose, 현재진행형
const LEVEL2_QUESTIONS: GrammarQuestion[] = [
  {
    domain: 'GRAMMAR',
    subCategory: 'there is/there are',
    difficulty: 2,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: '___ three books on the desk.',
      options: ['There is', 'There are', 'It is', 'They are'],
      correct_answer: 'B',
      explanation: '복수 명사(three books) 앞에는 "There are"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '소유격(\'s)',
    difficulty: 2,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'This is ___ pencil. She uses it every day.',
      options: ['Mary', 'Marys', "Mary's", 'of Mary'],
      correct_answer: 'C',
      explanation: "사람 이름 뒤에 's를 붙여 소유격을 만듭니다.",
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'have got(복수)',
    difficulty: 2,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'We ___ two cats and a dog.',
      options: ['has got', 'have got', 'got', 'have get'],
      correct_answer: 'B',
      explanation: '1인칭 복수(We) 주어에는 "have got"을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '현재진행형',
    difficulty: 2,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'Look! She ___ a song on the stage.',
      options: ['sing', 'sings', 'is singing', 'are singing'],
      correct_answer: 'C',
      explanation: '지금 진행 중인 동작(Look!)은 현재진행형 "is singing"으로 표현합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'Whose',
    difficulty: 2,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: "___ bag is this? — It's Tom's.",
      options: ['Who', 'What', 'Which', 'Whose'],
      correct_answer: 'D',
      explanation: '소유를 묻는 의문사는 "Whose"입니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'How many',
    difficulty: 2,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: '___ students are in the class? — Twenty.',
      options: ['How much', 'How many', 'How often', 'How long'],
      correct_answer: 'B',
      explanation: '셀 수 있는 명사(students)의 수량을 물을 때 "How many"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: "What's/Who's",
    difficulty: 2,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: "___ your favourite subject? — It's Science.",
      options: ["Who's", "What's", "Where's", "How's"],
      correct_answer: 'B',
      explanation: "사물이나 과목에 대해 물을 때 \"What's(= What is)\"를 사용합니다.",
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: "can't(부정)",
    difficulty: 2,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'He ___ speak French. He has never studied it.',
      options: ['can', 'cans', "can't", 'cannot to'],
      correct_answer: 'C',
      explanation: "불가능이나 능력이 없음을 나타낼 때 \"can't\"를 사용합니다.",
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '현재시제(3인칭)',
    difficulty: 2,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'She ___ English every day after school.',
      options: ['study', 'studies', 'is study', 'studys'],
      correct_answer: 'B',
      explanation: '3인칭 단수(She) 현재시제에서 -y로 끝나는 동사는 y를 i로 바꾸고 -es를 붙입니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'there is 의문문',
    difficulty: 2,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: '___ a supermarket near here? — Yes, there is.',
      options: ['Is there', 'Are there', 'There is', 'Does there'],
      correct_answer: 'A',
      explanation: '"There is"의 의문문은 "Is there ~?"입니다.',
    },
  },
]

// ── Smart Grammar Test L3 (A2, difficulty 2) ────────────────────────────────
// 주제: 소유대명사, 비교급/최상급, 과거시제(was/were), must/mustn't, some/any, 시간전치사, 목적격 대명사
const LEVEL3_QUESTIONS: GrammarQuestion[] = [
  {
    domain: 'GRAMMAR',
    subCategory: '소유대명사',
    difficulty: 2,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: "This is not your pen. It's ___.",
      options: ['my', 'mine', 'me', 'I'],
      correct_answer: 'B',
      explanation: '소유를 나타내는 독립 소유대명사는 "mine(나의 것)"입니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '비교급',
    difficulty: 2,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'Tom is ___ than Bill.',
      options: ['tall', 'more tall', 'taller', 'tallest'],
      correct_answer: 'C',
      explanation: '1음절 형용사(tall)의 비교급은 -er을 붙여 "taller"가 됩니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '최상급',
    difficulty: 2,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'She is the ___ student in the class.',
      options: ['good', 'better', 'best', 'most good'],
      correct_answer: 'C',
      explanation: 'good의 최상급은 불규칙 형태인 "best"입니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '과거시제(was/were)',
    difficulty: 2,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'They ___ very happy at the party yesterday.',
      options: ['was', 'were', 'are', 'be'],
      correct_answer: 'B',
      explanation: '복수 주어(They)의 be동사 과거형은 "were"입니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: "must/mustn't",
    difficulty: 2,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: "You ___ talk in the library. It's very quiet.",
      options: ['must', "mustn't", 'should', 'can'],
      correct_answer: 'B',
      explanation: "금지를 나타낼 때 \"mustn't\"를 사용합니다.",
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'some/any',
    difficulty: 2,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'Is there ___ milk in the fridge?',
      options: ['some', 'any', 'a', 'many'],
      correct_answer: 'B',
      explanation: '의문문에서는 불가산명사 앞에 "any"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '시간 전치사(on)',
    difficulty: 2,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'The party is ___ Friday evening.',
      options: ['in', 'at', 'on', 'for'],
      correct_answer: 'C',
      explanation: '요일(day) 앞에는 전치사 "on"을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '목적격 대명사',
    difficulty: 2,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'Can you help ___ with this problem?',
      options: ['I', 'my', 'mine', 'me'],
      correct_answer: 'D',
      explanation: '동사의 목적어 자리에는 목적격 대명사 "me"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '현재진행형(right now)',
    difficulty: 2,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'He ___ TV right now. Please be quiet.',
      options: ['watch', 'watches', 'is watching', 'watching'],
      correct_answer: 'C',
      explanation: '"right now"는 지금 이 순간의 동작을 나타내므로 현재진행형 "is watching"을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '전치사(between)',
    difficulty: 2,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'The post office is ___ the bank and the school.',
      options: ['next to', 'between', 'behind', 'in front of'],
      correct_answer: 'B',
      explanation: '두 장소의 사이에 있을 때는 "between A and B" 구문을 사용합니다.',
    },
  },
]

// ── Smart Grammar Test L4 (A2, difficulty 3) ────────────────────────────────
// 주제: 빈도부사, 과거시제, be going to, will, should, 부정대명사, a lot of, 과거진행형, too
const LEVEL4_QUESTIONS: GrammarQuestion[] = [
  {
    domain: 'GRAMMAR',
    subCategory: '빈도 부사',
    difficulty: 3,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'Sally ___ her homework on Sunday evenings.',
      options: ['usually does', 'usually do', 'does usually', 'do usually'],
      correct_answer: 'A',
      explanation: '3인칭 단수(Sally)에는 동사에 -s를 붙이며, 빈도 부사(usually)는 일반동사 앞에 위치합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '과거시제(불규칙)',
    difficulty: 3,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'We ___ to the cinema last Saturday.',
      options: ['go', 'goes', 'went', 'goed'],
      correct_answer: 'C',
      explanation: 'go의 과거형은 불규칙 형태인 "went"입니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'be going to',
    difficulty: 3,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'I ___ visit my grandparents this weekend. I already planned it.',
      options: ['will', 'am going to', 'go to', 'going to'],
      correct_answer: 'B',
      explanation: '이미 계획된 미래는 "be going to"로 표현합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'will(즉흥 결정)',
    difficulty: 3,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: "Don't worry. I ___ help you with the homework.",
      options: ['am going to', 'going to', 'will', 'would'],
      correct_answer: 'C',
      explanation: '즉흥적인 결정이나 약속은 "will"로 표현합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'should(조언)',
    difficulty: 3,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'You look very tired. You ___ go to bed early tonight.',
      options: ['must', 'should', 'will', 'are going to'],
      correct_answer: 'B',
      explanation: '조언이나 권유를 나타낼 때 "should"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '부정대명사(nothing)',
    difficulty: 3,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'There is ___ in the fridge. I need to go shopping.',
      options: ['anything', 'something', 'nothing', 'everything'],
      correct_answer: 'C',
      explanation: '부정문의 의미(아무것도 없다)를 긍정문 형태로 표현할 때 "nothing"을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'a lot of',
    difficulty: 3,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'She drinks ___ water every day. At least eight glasses.',
      options: ['a little', 'a few', 'much', 'a lot of'],
      correct_answer: 'D',
      explanation: '"a lot of"는 셀 수 있는/없는 명사 모두에 쓰이며 "많은"을 의미합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '과거진행형',
    difficulty: 3,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'I ___ a book when she called me.',
      options: ['read', 'was reading', 'were reading', 'am reading'],
      correct_answer: 'B',
      explanation: '과거의 특정 시점에 진행 중이던 동작은 과거진행형 "was reading"으로 표현합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'too/very',
    difficulty: 3,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'This bag is ___ heavy for me to carry.',
      options: ['very', 'enough', 'too', 'so'],
      correct_answer: 'C',
      explanation: '"too + 형용사 + to부정사"는 "~하기에 너무 ...하다"의 의미로 부정적 결과를 나타냅니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: "소유격(apostrophe 's)",
    difficulty: 3,
    cefrLevel: 'A2',
    contentJson: {
      type: 'multiple_choice',
      question_text: "___ dog is very friendly. Everyone likes him.",
      options: ['My sisters', "My sister's", 'Mine sister', 'Of my sister'],
      correct_answer: 'B',
      explanation: "소유를 나타낼 때 명사 뒤에 's를 붙입니다.",
    },
  },
]

// ── Smart Grammar Test L5 (B1, difficulty 4) ────────────────────────────────
// 주제: 현재완료, 관계절(who/which), 1종가정법, 동명사, have to, 과거진행 vs 단순과거, as...as, 부사, too/enough, 조동사
const LEVEL5_QUESTIONS: GrammarQuestion[] = [
  {
    domain: 'GRAMMAR',
    subCategory: '현재완료(ever)',
    difficulty: 4,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: '___ you ever visited Paris?',
      options: ['Did', 'Do', 'Have', 'Are'],
      correct_answer: 'C',
      explanation: '"ever"와 함께 경험을 묻는 의문문에는 현재완료 "Have"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '관계절(which)',
    difficulty: 4,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'The book ___ I borrowed from the library was very interesting.',
      options: ['who', 'what', 'where', 'which'],
      correct_answer: 'D',
      explanation: '사물(The book)을 선행사로 하는 관계대명사는 "which"(또는 that)입니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '1종 가정법(If절)',
    difficulty: 4,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'If it ___ tomorrow, we will cancel the picnic.',
      options: ['rain', 'rains', 'will rain', 'rained'],
      correct_answer: 'B',
      explanation: '1종 가정법(If절)에서는 현재시제를 사용합니다. "If it rains, ..."',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '동명사(enjoy)',
    difficulty: 4,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'She enjoys ___ new languages in her free time.',
      options: ['learn', 'to learn', 'learning', 'learned'],
      correct_answer: 'C',
      explanation: 'enjoy 뒤에는 동명사(-ing)가 옵니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'have to(의무)',
    difficulty: 4,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: "You ___ wear a uniform at this school. It's the rule.",
      options: ['should', 'have to', 'might', 'would'],
      correct_answer: 'B',
      explanation: '규칙으로 정해진 의무는 "have to"로 표현합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '과거진행형 vs 단순과거',
    difficulty: 4,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'While I ___ TV, the doorbell rang.',
      options: ['watched', 'watch', 'was watching', 'were watching'],
      correct_answer: 'C',
      explanation: '"While" 절에서 진행 중이던 동작(I was watching)과 그것을 방해한 사건(rang)을 함께 표현합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'as...as',
    difficulty: 4,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'He is ___ his older brother.',
      options: ['as tall than', 'as tall as', 'tall as', 'more tall as'],
      correct_answer: 'B',
      explanation: '동등 비교는 "as + 형용사/부사 + as" 구조를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '부사 형성(-ly)',
    difficulty: 4,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'She speaks English very ___.',
      options: ['fluent', 'fluently', 'fluence', 'more fluent'],
      correct_answer: 'B',
      explanation: '동사를 수식하는 부사는 형용사 + -ly 형태입니다. "fluent → fluently"',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: 'too/enough',
    difficulty: 4,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'This coffee is not hot ___. Can you warm it up?',
      options: ['too', 'very', 'enough', 'quite'],
      correct_answer: 'C',
      explanation: '"not + 형용사 + enough"는 "충분히 ~하지 않다"는 의미입니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '조동사(May - 허락)',
    difficulty: 4,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: '___ I borrow your pen for a moment?',
      options: ['Must', 'Should', 'Will', 'May'],
      correct_answer: 'D',
      explanation: '정중하게 허락을 구할 때 "May I...?"를 사용합니다.',
    },
  },
]

// ── Smart Grammar Test L6 (B1, difficulty 5) ────────────────────────────────
// 주제: 수동태, 2종가정법, 현재완료(since/for), 관계절(where), must vs don't have to, 시간절(when), 간접화법, 1종가정법, 연어
const LEVEL6_QUESTIONS: GrammarQuestion[] = [
  {
    domain: 'GRAMMAR',
    subCategory: '수동태(현재)',
    difficulty: 5,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'English ___ all over the world.',
      options: ['speaks', 'is spoken', 'is speaking', 'was spoken'],
      correct_answer: 'B',
      explanation: '현재시제 수동태는 "is/are + 과거분사" 구조입니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '2종 가정법',
    difficulty: 5,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'If I ___ you, I would study harder for the exam.',
      options: ['am', 'was', 'were', 'had been'],
      correct_answer: 'C',
      explanation: '2종 가정법 If절에서 be동사는 주어와 관계없이 "were"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '현재완료(since)',
    difficulty: 5,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'I have lived in this city ___ 2015.',
      options: ['for', 'since', 'during', 'from'],
      correct_answer: 'B',
      explanation: '특정 시점(연도, 날짜) 이후부터 지속을 나타낼 때 "since"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '현재완료 vs 과거시제',
    difficulty: 5,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: '___ you see that new film last weekend?',
      options: ['Have', 'Did', 'Do', 'Are'],
      correct_answer: 'B',
      explanation: '"last weekend"과 같은 명확한 과거 시간 표현이 있으면 단순과거(Did)를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '관계절(where)',
    difficulty: 5,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'This is the town ___ I was born.',
      options: ['which', 'that', 'where', 'who'],
      correct_answer: 'C',
      explanation: '장소를 선행사로 하여 "~한 곳"을 표현할 때 관계부사 "where"를 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: "don't have to",
    difficulty: 5,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: "It's Sunday. You ___ go to school today.",
      options: ["mustn't", "don't have to", "shouldn't", "can't"],
      correct_answer: 'B',
      explanation: '"don\'t have to"는 불필요(~할 필요 없다)를 나타내고, "mustn\'t"는 금지를 나타냅니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '시간절(when)',
    difficulty: 5,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'I will call you when I ___ home tonight.',
      options: ['will get', 'get', 'got', 'getting'],
      correct_answer: 'B',
      explanation: 'when이 이끄는 시간절에서는 미래의 일도 현재시제로 표현합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '간접화법(시제 일치)',
    difficulty: 5,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'She said she ___ tired after the long trip.',
      options: ['is', 'be', 'was', 'were'],
      correct_answer: 'C',
      explanation: '간접화법에서는 시제를 한 단계 과거로 바꿉니다. is → was',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '1종 가정법(주절)',
    difficulty: 5,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'If you study hard, you ___ pass the exam.',
      options: ['would', 'will', 'might to', 'should'],
      correct_answer: 'B',
      explanation: '1종 가정법(If + 현재시제)의 주절에는 "will"을 사용합니다.',
    },
  },
  {
    domain: 'GRAMMAR',
    subCategory: '동사 연어(make)',
    difficulty: 5,
    cefrLevel: 'B1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'She ___ a mistake in the test and lost two points.',
      options: ['did', 'had', 'made', 'took'],
      correct_answer: 'C',
      explanation: '"make a mistake(실수하다)"는 고정된 연어 표현입니다.',
    },
  },
]

// ── 전체 문제 배열 ────────────────────────────────────────────────────────────
const SMART_GRAMMAR_QUESTIONS: GrammarQuestion[] = [
  ...LEVEL1_QUESTIONS,
  ...LEVEL2_QUESTIONS,
  ...LEVEL3_QUESTIONS,
  ...LEVEL4_QUESTIONS,
  ...LEVEL5_QUESTIONS,
  ...LEVEL6_QUESTIONS,
]

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔤 Smart Grammar Test L1-L6 문법 문제 등록 시작...')
  console.log(`   총 ${SMART_GRAMMAR_QUESTIONS.length}개 문제 (레벨당 10개 × 6레벨)`)

  // 학원 조회 (해피잉글리시 어학원)
  const academy = await prisma.academy.findFirst({
    where: { name: '해피잉글리시 어학원' },
  })

  if (!academy) {
    throw new Error(
      '학원을 찾을 수 없습니다. 먼저 "npm run db:seed"를 실행하여 기본 데이터를 생성해 주세요.'
    )
  }

  console.log(`\n✅ 학원 확인: ${academy.name} (ID: ${academy.id})`)

  // 문제 생성자 (첫 번째 TEACHER 조회)
  const teacher = await prisma.user.findFirst({
    where: { academyId: academy.id, role: 'TEACHER' },
  })

  let created = 0
  let skipped = 0

  for (const q of SMART_GRAMMAR_QUESTIONS) {
    // 중복 체크 (academyId + domain + subCategory + difficulty + cefrLevel)
    const existing = await prisma.question.findFirst({
      where: {
        academyId: academy.id,
        domain: q.domain,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        cefrLevel: q.cefrLevel,
      },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.question.create({
      data: {
        academyId: academy.id,
        domain: q.domain,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        cefrLevel: q.cefrLevel,
        contentJson: q.contentJson,
        createdBy: teacher?.id ?? null,
        statsJson: { attempt_count: 0, correct_count: 0, correct_rate: 0 },
      },
    })
    created++
  }

  console.log(`\n📊 결과:`)
  console.log(`   ✅ 신규 등록: ${created}개`)
  console.log(`   ⏭️  중복 건너뜀: ${skipped}개`)
  console.log(`   📝 총 처리: ${created + skipped}개`)

  const levelSummary = [
    { level: 'L1 (A1, 난이도 1)', count: LEVEL1_QUESTIONS.length },
    { level: 'L2 (A1, 난이도 2)', count: LEVEL2_QUESTIONS.length },
    { level: 'L3 (A2, 난이도 2)', count: LEVEL3_QUESTIONS.length },
    { level: 'L4 (A2, 난이도 3)', count: LEVEL4_QUESTIONS.length },
    { level: 'L5 (B1, 난이도 4)', count: LEVEL5_QUESTIONS.length },
    { level: 'L6 (B1, 난이도 5)', count: LEVEL6_QUESTIONS.length },
  ]
  console.log('\n📚 레벨별 문제 수:')
  levelSummary.forEach(({ level, count }) => console.log(`   ${level}: ${count}문제`))

  const totalGrammar = await prisma.question.count({
    where: { academyId: academy.id, domain: 'GRAMMAR' },
  })
  console.log(`\n🎯 현재 문제뱅크 문법 문제 총 ${totalGrammar}개`)
  console.log('\n✨ Smart Grammar 문법 문제 등록 완료!')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
