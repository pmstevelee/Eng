/**
 * prisma/seed-unit-test-u1.ts
 * 아이비랭귀지스쿨 80-1 Unit Test U1 문제 시드 데이터
 * 주제: 바다 생물 (submarine, lantern fish, jellyfish, blobfish)
 *
 * 실행: npx tsx prisma/seed-unit-test-u1.ts
 */

import { PrismaClient, QuestionDomain } from '../src/generated/prisma'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const prisma = new PrismaClient()

// ── 공통 지문 (Q6~Q10) ─────────────────────────────────────────────────────────
const READING_PASSAGE = `Tim and Lola are in a submarine.
Captain Bob takes them underwater.

Tim sees lantern fish.
They glow in the water.
They look like light bulbs!

Lola sees a jellyfish.
It is big and white.
It looks like a huge mushroom!

"Look at this!" says Lola.
"It is pink and round."
"That is a blobfish," says Captain Bob.
"It looks just like you, Captain Bob!" says Tim.
They all laugh!`

// ── 문제 데이터 ────────────────────────────────────────────────────────────────
const questions = [
  // ── Q1-a: Look and match (① 해파리) ─────────────────────────────────────────
  {
    domain: 'VOCABULARY' as QuestionDomain,
    subCategory: '해양 어휘 - 매칭',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'Look and match. What is ①? (bioluminescent sea creature with tentacles)',
      question_text_ko: '다음 ① 그림에 알맞은 단어를 고르세요.',
      options: ['light bulb', 'flashlight', 'lantern fish', 'jellyfish'],
      correct_answer: 'D',
      explanation: '촉수가 있고 빛을 내는 바다 생물은 해파리(jellyfish)입니다.',
    },
  },

  // ── Q1-b: Look and match (② 전구) ────────────────────────────────────────────
  {
    domain: 'VOCABULARY' as QuestionDomain,
    subCategory: '해양 어휘 - 매칭',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'Look and match. What is ②? (glass bulb with a filament that produces light)',
      question_text_ko: '다음 ② 그림에 알맞은 단어를 고르세요.',
      options: ['light bulb', 'flashlight', 'lantern fish', 'jellyfish'],
      correct_answer: 'A',
      explanation: '필라멘트가 있는 유리 전구는 light bulb(전구)입니다.',
    },
  },

  // ── Q2: Read and fill in the blank (submarine 번역) ──────────────────────────
  {
    domain: 'VOCABULARY' as QuestionDomain,
    subCategory: '해양 어휘 - 빈칸 채우기',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'fill_blank',
      question_text: '잠수함은 수중 선박이다.\n→ A s_______ is an underwater ship.',
      question_text_ko: '한국어 힌트를 보고 빈칸에 알맞은 영어 단어를 쓰세요.',
      correct_answer: 'submarine',
      explanation: '"잠수함"의 영어 표현은 submarine입니다. sub-(아래) + marine(바다)의 합성어입니다.',
    },
  },

  // ── Q3-a: Choose and write – blobfish color ───────────────────────────────────
  {
    domain: 'VOCABULARY' as QuestionDomain,
    subCategory: '해양 어휘 - 단어 선택',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'fill_blank',
      question_text: '<보기> white  pink  big  small\n\nA blobfish is _______ .',
      question_text_ko: '보기에서 알맞은 단어를 골라 빈칸을 채우세요.',
      correct_answer: 'pink',
      explanation: '지문에서 "It is pink and round."라고 했으므로 blobfish는 핑크색입니다.',
    },
  },

  // ── Q3-b: Choose and write – blobfish nose ───────────────────────────────────
  {
    domain: 'VOCABULARY' as QuestionDomain,
    subCategory: '해양 어휘 - 단어 선택',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'fill_blank',
      question_text: '<보기> white  pink  big  small\n\nA blobfish has a _______ nose.',
      question_text_ko: '보기에서 알맞은 단어를 골라 빈칸을 채우세요.',
      correct_answer: 'big',
      explanation: '지문에서 blobfish는 크고 둥근 특징이 있으며, 코가 큰(big) 물고기입니다.',
    },
  },

  // ── Q4: Read and choose the correct answer (look) ────────────────────────────
  {
    domain: 'VOCABULARY' as QuestionDomain,
    subCategory: '어휘 - 문맥 어휘 선택',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text:
        'Read and choose the correct answer.\n\nThis doll ___(e)s like a turtle.\nI ___ at the flowers.',
      question_text_ko: '빈칸에 공통으로 들어갈 알맞은 단어를 고르세요.',
      options: ['see', 'watch', 'look', 'make', 'take'],
      correct_answer: 'C',
      explanation:
        '"look like ~"는 "~처럼 보이다", "look at ~"는 "~을 보다"라는 의미입니다. 두 문장 모두 look이 적절합니다.',
    },
  },

  // ── Q5: Rewrite underlined word with the correct answer (glow) ───────────────
  {
    domain: 'VOCABULARY' as QuestionDomain,
    subCategory: '어휘 - 단어 교정',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'short_answer',
      question_text:
        'Rewrite the sentence by replacing the underlined word with the correct word.\n\nTrees <u>take</u> with many lights.',
      question_text_ko: '밑줄 친 단어를 올바른 단어로 바꾸어 문장을 다시 쓰세요.',
      correct_answer: 'Trees glow with many lights.',
      explanation:
        '"take"는 문맥상 올바르지 않습니다. "glow(빛나다/발광하다)"가 올바른 표현입니다.',
    },
  },

  // ── Q6: Where are Tim and Lola? ──────────────────────────────────────────────
  {
    domain: 'READING' as QuestionDomain,
    subCategory: '독해 - 세부 내용 파악',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'Where are Tim and Lola?',
      question_text_ko: 'Tim과 Lola는 어디에 있나요?',
      passage: READING_PASSAGE,
      options: ['수족관', '잠수함', '놀이 공원', '숲 속', '수영장'],
      correct_answer: 'B',
      explanation:
        '지문 첫 줄 "Tim and Lola are in a submarine."에서 그들이 잠수함 안에 있음을 알 수 있습니다.',
    },
  },

  // ── Q7: What is a feature of lantern fish? ───────────────────────────────────
  {
    domain: 'READING' as QuestionDomain,
    subCategory: '독해 - 세부 내용 파악',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'What is a feature of lantern fish?',
      question_text_ko: '랜턴피시(lantern fish)의 특징은 무엇인가요?',
      passage: READING_PASSAGE,
      options: [
        '다리가 많다.',
        '매우 작다.',
        '전구처럼 보인다.',
        '매우 크다.',
        '푸른 색이다.',
      ],
      correct_answer: 'C',
      explanation:
        '지문에서 "They glow in the water. They look like light bulbs!"라고 했으므로 랜턴피시는 전구처럼 보입니다.',
    },
  },

  // ── Q8: What is true about the story? ────────────────────────────────────────
  {
    domain: 'READING' as QuestionDomain,
    subCategory: '독해 - 내용 일치 판단',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'multiple_choice',
      question_text: 'What is true about the story?',
      question_text_ko: '지문의 내용과 일치하는 것은 무엇인가요?',
      passage: READING_PASSAGE,
      options: [
        'Tim이 Captain Bob을 물속으로 데리고 갔다.',
        'lantern fish는 물 위에서 빛이 난다.',
        'jellyfish는 크기가 작다.',
        'jellyfish는 버섯처럼 보인다.',
        'jellyfish는 여러 가지 색을 가진다.',
      ],
      correct_answer: 'D',
      explanation:
        '지문에서 "It looks like a huge mushroom!"이라고 했으므로 jellyfish는 버섯처럼 보입니다.',
    },
  },

  // ── Q9-a: True or False – Tim looks like blobfish ────────────────────────────
  {
    domain: 'READING' as QuestionDomain,
    subCategory: '독해 - O/X 판별',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'fill_blank',
      question_text:
        'Check O for true or X for false.\n\nTim은 blobfish처럼 생겼다. ( )',
      question_text_ko: '지문의 내용과 일치하면 O, 틀리면 X를 쓰세요.',
      passage: READING_PASSAGE,
      correct_answer: 'X',
      explanation:
        '지문에서 "It looks just like you, Captain Bob!"이라고 했으므로 blobfish처럼 생긴 것은 Tim이 아니라 Captain Bob입니다.',
    },
  },

  // ── Q9-b: True or False – blobfish is red ────────────────────────────────────
  {
    domain: 'READING' as QuestionDomain,
    subCategory: '독해 - O/X 판별',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'fill_blank',
      question_text:
        'Check O for true or X for false.\n\nblobfish는 붉은 색이다. ( )',
      question_text_ko: '지문의 내용과 일치하면 O, 틀리면 X를 쓰세요.',
      passage: READING_PASSAGE,
      correct_answer: 'X',
      explanation:
        '지문에서 "It is pink and round."라고 했으므로 blobfish는 붉은색이 아니라 핑크색입니다.',
    },
  },

  // ── Q10: Write the correct sentence – blobfish feature ───────────────────────
  {
    domain: 'READING' as QuestionDomain,
    subCategory: '독해 - 내용 확인 서술',
    difficulty: 1,
    cefrLevel: 'A1',
    contentJson: {
      type: 'short_answer',
      question_text:
        'Read the passage. Then write the correct sentence which shows a feature of blobfish.',
      question_text_ko: '지문을 읽고, blobfish의 특징을 나타내는 올바른 문장을 쓰세요.',
      passage: READING_PASSAGE,
      correct_answer: 'It is pink and round.',
      explanation:
        '지문에서 blobfish의 특징을 설명하는 문장은 "It is pink and round."입니다.',
    },
  },
]

// ── 메인 실행 ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌊 Unit Test U1 문제 시드 데이터 등록 시작...\n')

  // ── 학원 조회 ────────────────────────────────────────────────────────────────
  const academy = await prisma.academy.findFirst({
    where: { name: '해피잉글리시 어학원' },
  })
  if (!academy) {
    console.error('❌ 학원을 찾을 수 없습니다. 먼저 npm run db:seed 를 실행하세요.')
    process.exit(1)
  }

  // ── 기존에 academyId 없이 등록된 U1 문제 삭제 ────────────────────────────────
  const deleted = await prisma.question.deleteMany({
    where: {
      academyId: null,
      cefrLevel: 'A1',
      subCategory: { in: [
        '해양 어휘 - 매칭',
        '해양 어휘 - 빈칸 채우기',
        '해양 어휘 - 단어 선택',
        '어휘 - 문맥 어휘 선택',
        '어휘 - 단어 교정',
        '독해 - 세부 내용 파악',
        '독해 - 내용 일치 판단',
        '독해 - O/X 판별',
        '독해 - 내용 확인 서술',
      ]},
    },
  })
  if (deleted.count > 0) {
    console.log(`🗑️  기존 academyId 미설정 문제 ${deleted.count}개 삭제 완료\n`)
  }

  // ── 교사 조회 (문제 생성자) ──────────────────────────────────────────────────
  const teacher = await prisma.user.findFirst({
    where: { academyId: academy.id, role: 'TEACHER' },
  })

  let created = 0

  for (const q of questions) {
    await prisma.question.create({
      data: {
        academy: { connect: { id: academy.id } },
        ...(teacher ? { creator: { connect: { id: teacher.id } } } : {}),
        domain: q.domain,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        cefrLevel: q.cefrLevel,
        contentJson: q.contentJson,
        statsJson: {
          attempt_count: 0,
          correct_count: 0,
          correct_rate: 0,
        },
      },
    })
    created++
    console.log(`  ✅ [${created}/${questions.length}] ${q.subCategory} - "${q.contentJson.question_text.slice(0, 40)}..."`)
  }

  console.log(`\n🎉 완료! 총 ${created}개 문제가 등록되었습니다.`)
  console.log(`   학원: ${academy.name} (${academy.id})`)
  console.log('   (Unit Test U1 - 바다 생물 주제: submarine, lantern fish, jellyfish, blobfish)\n')
}

main()
  .catch((e) => {
    console.error('❌ 오류:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
