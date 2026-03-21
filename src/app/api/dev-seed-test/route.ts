/**
 * 개발용 테스트 데이터 생성 API (테스트 완료 후 삭제 예정)
 * GET /api/dev-seed-test
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '개발 환경에서만 사용 가능합니다.' }, { status: 403 })
  }

  try {
    // 1. 교사 & 학원 조회
    const teacher = await prisma.user.findFirst({
      where: { role: 'TEACHER', isDeleted: false },
      select: { id: true, academyId: true },
    })
    if (!teacher || !teacher.academyId) {
      return NextResponse.json({ error: '교사 계정이 없습니다.' }, { status: 400 })
    }

    // 2. 학생 User 조회
    const studentUser = await prisma.user.findFirst({
      where: { role: 'STUDENT', isDeleted: false },
      select: { id: true },
    })
    if (!studentUser) {
      return NextResponse.json({ error: '학생 계정이 없습니다.' }, { status: 400 })
    }

    // 3. Student 레코드 upsert
    const student = await prisma.student.upsert({
      where: { userId: studentUser.id },
      update: {},
      create: { userId: studentUser.id },
      select: { id: true },
    })

    // 4. 기존 시드 테스트 정리 (중복 방지)
    const existing = await prisma.test.findFirst({
      where: { title: '[테스트] 영어 레벨 진단 샘플', academyId: teacher.academyId },
      select: { id: true },
    })
    if (existing) {
      // question_responses 먼저 삭제 (FK 제약 조건)
      const sessions = await prisma.testSession.findMany({
        where: { testId: existing.id },
        select: { id: true },
      })
      if (sessions.length > 0) {
        await prisma.questionResponse.deleteMany({
          where: { sessionId: { in: sessions.map((s) => s.id) } },
        })
      }
      await prisma.testSession.deleteMany({ where: { testId: existing.id } })
      await prisma.test.delete({ where: { id: existing.id } })
    }

    // 5. 샘플 문제 4개 생성 (각 유형 1개씩)
    const q1 = await prisma.question.create({
      data: {
        academyId: teacher.academyId,
        createdBy: teacher.id,
        domain: 'GRAMMAR',
        subCategory: '시제',
        difficulty: 2,
        cefrLevel: 'B1',
        contentJson: {
          type: 'multiple_choice',
          question_text: 'Choose the correct form of the verb to complete the sentence:\n\nShe _______ to school every day by bus.',
          question_text_ko: '문장을 완성하는 올바른 동사 형태를 고르세요.',
          options: ['go', 'goes', 'going', 'gone'],
          correct_answer: 'B',
          explanation: '"She"는 3인칭 단수이므로 현재 시제에서 동사에 -s를 붙입니다.',
        },
      },
    })

    const q2 = await prisma.question.create({
      data: {
        academyId: teacher.academyId,
        createdBy: teacher.id,
        domain: 'VOCABULARY',
        subCategory: '동의어',
        difficulty: 2,
        cefrLevel: 'B1',
        contentJson: {
          type: 'fill_blank',
          question_text: 'Fill in the blank with the correct word:\n\nThe scientist made an important ___________ that changed our understanding of the universe.',
          question_text_ko: '빈칸에 알맞은 단어를 쓰세요.',
          correct_answer: 'discovery',
          explanation: '"discovery"는 "새로운 사실이나 물질을 발견하는 것"을 의미합니다.',
        },
      },
    })

    const q3 = await prisma.question.create({
      data: {
        academyId: teacher.academyId,
        createdBy: teacher.id,
        domain: 'READING',
        subCategory: '독해',
        difficulty: 3,
        cefrLevel: 'B2',
        contentJson: {
          type: 'multiple_choice',
          question_text: 'According to the passage, what is the main reason bees are important to the ecosystem?',
          question_text_ko: '지문에 따르면, 벌이 생태계에 중요한 주된 이유는 무엇인가요?',
          passage: `Bees are among the most important creatures on Earth. As pollinators, they play a crucial role in the reproduction of flowering plants. When bees collect nectar from flowers, they inadvertently transfer pollen from one flower to another, enabling fertilization and the production of seeds and fruits.

Without bees, approximately one-third of the food we eat would not exist. Many fruits, vegetables, and nuts depend on bee pollination to grow. Almonds, for example, are entirely dependent on honeybee pollination. Similarly, crops such as apples, berries, cucumbers, and avocados rely heavily on bees.

Beyond food production, bees support biodiversity. The plants they pollinate provide habitat and food for countless other animals. Scientists estimate that bee populations have declined by nearly 30% in recent decades due to habitat loss, pesticide use, and climate change — making conservation efforts more urgent than ever.`,
          options: [
            'They produce honey that humans consume',
            'They pollinate plants, supporting food production and biodiversity',
            'They protect crops from harmful insects',
            'They help spread seeds through the wind',
          ],
          correct_answer: 'B',
          explanation: '지문 첫 두 단락에서 벌의 수분 역할과 식량 생산, 생물다양성 기여가 설명되어 있습니다.',
        },
      },
    })

    const q4 = await prisma.question.create({
      data: {
        academyId: teacher.academyId,
        createdBy: teacher.id,
        domain: 'WRITING',
        subCategory: '서술',
        difficulty: 3,
        cefrLevel: 'B2',
        contentJson: {
          type: 'essay',
          question_text: 'Write a short paragraph (80–150 words) about the following topic:\n\n"Technology has made our lives easier, but it has also created new problems." Do you agree or disagree? Support your opinion with specific examples.',
          question_text_ko: '다음 주제에 대해 80~150자 분량의 짧은 문단을 작성하세요.\n\n"기술은 우리의 삶을 더 편리하게 만들었지만, 새로운 문제들도 만들어냈습니다." 동의하시나요, 동의하지 않으시나요? 구체적인 예시를 들어 의견을 뒷받침하세요.',
          word_limit: 150,
        },
      },
    })

    // 6. 테스트 생성 (제한 시간 10분)
    const questionIds = [q1.id, q2.id, q3.id, q4.id]
    const test = await prisma.test.create({
      data: {
        academyId: teacher.academyId,
        createdBy: teacher.id,
        title: '[테스트] 영어 레벨 진단 샘플',
        type: 'LEVEL_TEST',
        status: 'PUBLISHED',
        timeLimitMin: 10,
        instructions: '각 문제를 꼼꼼히 읽고 답하세요.\n• 객관식은 가장 적절한 답을 선택하세요.\n• 빈칸 채우기는 정확한 단어를 입력하세요.\n• 읽기 문제는 지문을 먼저 읽은 후 문제를 푸세요.\n• 쓰기는 주어진 글자수 범위 내에서 작성하세요.',
        questionOrder: questionIds,
        totalScore: 100,
      },
    })

    // 7. 학생에게 TestSession 배포
    const session = await prisma.testSession.create({
      data: {
        testId: test.id,
        studentId: student.id,
        status: 'NOT_STARTED',
        timeLimitMin: 10,
      },
    })

    return NextResponse.json({
      ok: true,
      message: '테스트 데이터 생성 완료!',
      sessionId: session.id,
      testTitle: test.title,
      questions: questionIds.length,
      studentUrl: `/student/tests/${session.id}`,
    })
  } catch (err) {
    console.error('seed error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
